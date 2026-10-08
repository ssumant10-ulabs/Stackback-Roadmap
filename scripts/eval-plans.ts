/** Plans read out of an orders file, asserted.
 *
 *  Three rules the file has to encode, all of them things the old single-median answer got
 *  wrong on a real merchant:
 *
 *  1. A 100g bag and a 1kg bag do not reorder at the same rate, and averaging them gives a
 *     cadence that is wrong for both.
 *  2. Prepaid and AutoPay are not the same product. Prepaid is a fixed run bought upfront.
 *     AutoPay runs until the customer stops it, so it has no run length at all.
 *  3. A split that is not real is noise. Two bands whose gaps land on the same offered
 *     frequency are one plan, and saying so is the answer.
 *
 *  Run: npx tsx scripts/eval-plans.ts
 */
import { AUTOPAY_CYCLES, analyse, packSize, planRates, readOrders } from "../lib/help/orders";
import { autopayRate, ladderFor, writeBands } from "../lib/help/questions";

let fails = 0;
const ok = (c: boolean, what: string) => { if (!c) { fails++; console.log(`  FAIL  ${what}`); } else console.log(`  ok    ${what}`); };
const eq = (a: unknown, b: unknown, what: string) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${what} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

console.log("\nReading a pack size off a title");
eq(packSize("Chicken Pumpkin Fresh Dog Food - 100g / 1 Pack")?.grams, 100, "grams");
eq(packSize("Karupatti Mittai - 250 gms")?.grams, 250, "gms with a space");
eq(packSize("Cold Brew Concentrate 1 L")?.grams, 1000, "a litre is a thousand");
eq(packSize("Protein Powder 2kg")?.grams, 2000, "kilos");
eq(packSize("Gut Booster - 60 g Soft Chews")?.grams, 60, "grams before other words");
eq(packSize("Trial Pack")?.grams, undefined, "no number, no size");
eq(packSize("Daily Sachets 30 count")?.grams, 30, "a count is a size on its own scale");

/** Build an export where two bands reorder differently. */
function file(parts: { email: string; day: number; title: string }[]): string {
  const head = "Name,Email,Created at,Lineitem name,Lineitem quantity,Lineitem price";
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  return [head, ...parts.map((p, i) => {
    const d = new Date(base + p.day * 86_400_000).toISOString().slice(0, 10);
    return `#${1000 + i},${p.email},${d},${p.title},1,500`;
  })].join("\n");
}

console.log("\nTwo pack sizes that reorder differently");
/* 100g every 14 days, 1kg every 60. One median over both lands near 30, which is wrong for
   both bands and is exactly what the single-answer version produced. */
const rows: { email: string; day: number; title: string }[] = [];
for (let c = 0; c < 20; c++) for (let k = 0; k < 6; k++) rows.push({ email: `s${c}@x.com`, day: k * 14, title: "Daily Pack 100g" });
for (let c = 0; c < 20; c++) for (let k = 0; k < 4; k++) rows.push({ email: `l${c}@x.com`, day: k * 60, title: "Family Pack 1kg" });
const two = analyse(readOrders(file(rows)).rows);
eq(two.plans.length, 2, "two plans");
eq(two.plans.map((p) => p.label), ["Smaller packs", "Larger packs"], "named by size, smaller first");
eq(two.plans.map((p) => p.everyDays), [14, 60], "each band gets its own cadence");
ok(two.plans[0].medianGap === 14 && two.plans[1].medianGap === 60, "off their own customers' gaps");
ok(two.plans[0].sizes.includes("100g") && two.plans[1].sizes.includes("1kg"), "and the sizes are named");
ok(two.plans[0].products[0].includes("100g"), "with the products that are in the band");
/* The whole point. One median over both bands can only ever be right for one of them —
   here it lands on the smaller band, because that band has more intervals in it, and is
   wrong by a month and a half for every customer buying the big bag. */
ok(two.plans.some((p) => p.everyDays !== two.suggestEveryDays),
  `the single averaged cadence (${two.suggestEveryDays} days) is wrong for at least one band, which is why the split exists`);
ok(two.suggestEveryDays === 14 && two.plans[1].everyDays === 60,
  "and here it is the larger-pack customers it is wrong for");

console.log("\nPrepaid has runs, AutoPay does not");
for (const p of two.plans) {
  ok(p.prepaidRuns.length > 0, `${p.label}: prepaid has fixed runs (${p.prepaidRuns.join(", ")})`);
  ok(p.autopayCycles === AUTOPAY_CYCLES && AUTOPAY_CYCLES === 12,
    `${p.label}: AutoPay is 12 cycles, a year at this cadence rather than a commitment`);
}
eq(two.plans[0].prepaidRuns, [6, 13, 26], "fortnightly prepaid runs cover three months, six and a year");
eq(two.plans[1].prepaidRuns, [2, 3, 6], "and two-monthly runs are shorter in count for the same cover");

console.log("\nWhat AutoPay is discounted at");
/* The second-highest rung, not the floor. AutoPay is open-ended — it bills until the
   customer stops it — so in practice it is the longest commitment on the page, and pricing
   it at the bottom tells a customer the honest move is the shortest prepaid run instead. It
   stays below the top rung, because twelve deliveries paid upfront is worth more than a
   mandate that can be cancelled next month. */
eq(autopayRate([15, 18, 20]), 18, "a 15/18/20 ladder gives AutoPay 18, not 15");
eq(autopayRate([10, 15, 20]), 15, "and 10/15/20 gives 15");
eq(autopayRate([5, 10, 15, 18, 20]), 18, "on a five-rung ladder it is still one below the top");
eq(autopayRate([10, 20]), 10, "with two rungs the second-highest is the lower one");
eq(autopayRate([20]), 20, "with one rate there is nothing to choose");
/* A ladder that repeats a rate must not collapse the gap to nothing. */
eq(autopayRate([15, 15, 20]), 15, "a repeated rung counts once");
eq(autopayRate([]), 0, "no ladder, no rate");
ok(autopayRate([15, 18, 20]) < Math.max(15, 18, 20), "it is always below the best prepaid rate");
ok(autopayRate([15, 18, 20]) > Math.min(15, 18, 20), "and always above the worst");

console.log("\nA split that is not real is not offered");
const same: { email: string; day: number; title: string }[] = [];
for (let c = 0; c < 20; c++) for (let k = 0; k < 5; k++) same.push({ email: `s${c}@x.com`, day: k * 30, title: "Small 100g" });
for (let c = 0; c < 20; c++) for (let k = 0; k < 5; k++) same.push({ email: `l${c}@x.com`, day: k * 31, title: "Large 500g" });
const one = analyse(readOrders(file(same)).rows);
eq(one.plans.length, 1, "30 and 31 days is one plan, not two");
eq(one.plans[0].label, "All products", "and it says so");
ok(one.warnings.some((w) => /much the same rate/.test(w)), "and the file says why rather than going quiet");

console.log("\nNothing to split on");
const nosize: { email: string; day: number; title: string }[] = [];
for (let c = 0; c < 20; c++) for (let k = 0; k < 4; k++) nosize.push({ email: `c${c}@x.com`, day: k * 30, title: "Mystery Box" });
const plain = analyse(readOrders(file(nosize)).rows);
eq(plain.plans.length, 1, "titles with no size give one plan");
eq(plain.plans[0].everyDays, 30, "at the cadence the whole file shows");
eq(analyse([]).plans.length, 0, "an empty file proposes nothing at all");

console.log("\nThe ladder is built from rates the store actually ran");
/* The bug this guards: one 100%-off order set the top of the ladder, the widget priced
   every delivery at zero and printed "100% OFF" on a client's preview. */
const D = (bands: { pct: number; orders: number }[], orders: number) =>
  ({ orders, share: 0, medianPct: null, maxPct: Math.max(...bands.map((b) => b.pct), 0), bands, codes: [] });

eq(planRates(D([{ pct: 10, orders: 40 }, { pct: 15, orders: 30 }, { pct: 100, orders: 1 }], 71)).join(),
   "10,15", "a single 100% order never reaches the ladder");
eq(planRates(D([{ pct: 10, orders: 40 }, { pct: 90, orders: 40 }], 80)).join(),
   "10", "nor does a well-used rate above the ceiling");
ok(!planRates(D([{ pct: 100, orders: 1 }], 1)).includes(100), "even when it is the only rate in the file");
eq(planRates(D([{ pct: 12, orders: 2 }], 4)).join(), "12",
   "a thin file falls back to its rates rather than to nothing");
eq(planRates(D([], 0)).length, 0, "a file with no discounts proposes no ladder");

console.log("\nEvery run offered gets a rung");
const lad = ladderFor([3, 6, 12], [10, 20]);
eq(Object.keys(lad).length, 3, "three runs, three rungs");
eq(lad[3], 10, "the shortest run takes the lowest accepted rate");
eq(lad[12], 20, "the longest takes the highest");
ok(lad[6] > lad[3] && lad[6] < lad[12], "and the middle sits between them");
eq(writeBands(ladderFor([3, 6], [15])).split(",").map((x) => x.split(":")[1]).join(),
   "15,15", "one accepted rate is flat, not an invented slope");
eq(Object.keys(ladderFor([3, 6], [])).length, 0, "no rates, no ladder");
/* The two surfaces that disagreed: the document reads the ladder, the widget falls back to
   discount_max. They must land on the same number for the longest run. */
const runs = [3, 6, 12], rates = [10, 20];
eq(ladderFor(runs, rates)[runs[runs.length - 1]], rates[rates.length - 1],
   "the document's deepest rung is the widget's fallback rate");

console.log(fails ? `\n${fails} FAILED\n` : "\nAll plan assertions pass.\n");
process.exit(fails ? 1 : 0);
