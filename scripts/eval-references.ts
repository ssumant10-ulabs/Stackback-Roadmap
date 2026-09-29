/** The references panel, held to the live pilot data rather than to invented examples.
 *
 *  The references kept reading "not logged" for stores whose plan columns were filled in,
 *  which is the worst failure this screen has: it tells a merchant on a call that we have
 *  no comparable, while the comparable sits in the sheet. The cause every time was a cell
 *  shape the parser had not met, and the fix every time was invented from one example.
 *
 *  So the fixture is not examples. It is every filled-in Discount margin / Frequency pair
 *  in the live Pilots tab, read out of the running app on 2026-09-28, with what each one
 *  means written beside it. A parser change that loses one of these fails here.
 *
 *  Run: npx tsx scripts/eval-references.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDiscounts, parsePlans } from "../lib/help/references";
import { categoryIdFor } from "../lib/help/categories";

const fx = JSON.parse(readFileSync(join(__dirname, "fixtures/pilot-plans.json"), "utf8"));

/** What each cell means, as `days:runs` per plan, in the order the cell says them.
 *  An empty `days` is a run ladder with no cadence named; an empty run list is a cadence
 *  with no ladder. Both are real cells and neither is a parse failure. */
const PLANS: string[] = [
  "30:", "30:3,6,9", "30:3,6", "30:3,6,12", "30:3,6", "30:3,6", "7:3,6",
  "7:3,6|30:3,6", "7:4,8|30:3", "30:6,12|60:3,6|90:2,4", "7:6|30:3", "30:3",
  "7:2,4|30:2", "30:3,6,12", "30:6", "14:24,48|30:6,12|60:6,12", "30:3,6,12",
  "30:3,6,12|14:3,6,12", "30:3,6", "30:12", "7:6,12|30:6", ":2,3,4", "30:3,6,12",
  "7:6,12", "30:3,6,12", "30:2,4,6", "30:3,6,12", "30:3", "30:3,6|14:3,6,12",
  "30:3,6", "30:3,6,12", "30:12", "30:3,6", "30:2,3,4",
  "7:3,6,9,12|14:3,6,9,12|30:3,6,9,12", "30:3,6", "30:", "30:3,6", "14:3,6,12",
];

/** The top of each store's band, which is the number the drawer prints as "up to N% off". */
const MAXPCT: number[] = [
  25, 25, 15, 20, 15, 20, 20, 20, 20, 35, 7, 8, 6, 12.52, 6, 10, 20, 15, 15, 20,
  36, 15, 15, 18, 12, 15, 25, 15, 20, 20, 10, 15, 15, 25, 12.5, 5, 10, 15, 10,
];

const show = (p: { everyDays: number[]; deliveries: number[] }[]) =>
  p.map((x) => `${x.everyDays.join("/")}:${x.deliveries.join(",")}`).join("|");

let bad = 0;
interface Row { name: string; category: string; discountMargin: string; frequency: string }
/* Only the rows with both plan columns filled: the other sixteen are stores nobody has set
   up yet, and asserting a parse of an empty cell asserts nothing. */
const filled = (fx.rows as Row[]).filter((r) => r.discountMargin && r.frequency);
filled.forEach((row, i) => {
  const { category: cat, discountMargin: pct, frequency: freq } = row;
  const got = show(parsePlans(freq));
  if (got !== PLANS[i]) { bad++; console.log(`FREQ  row ${i + 1}  ${JSON.stringify(freq)}\n      want ${PLANS[i]}\n      got  ${got}`); }
  const d = parseDiscounts(pct);
  const max = d.length ? Math.max(...d) : null;
  if (max !== MAXPCT[i]) { bad++; console.log(`PCT   row ${i + 1}  ${JSON.stringify(pct)}  want ${MAXPCT[i]}  got ${max}`); }
  if (cat && !categoryIdFor(cat)) { bad++; console.log(`CAT   row ${i + 1}  ${JSON.stringify(cat)} maps to nothing`); }
});

/* Every category the live cohort uses has to map onto a plan category, including the ones
   with a single store in them: an unmapped category shows a merchant an empty reference. */
for (const c of [...new Set((fx.rows as Row[]).map((r) => r.category).filter(Boolean))]) {
  if (!categoryIdFor(c)) { bad++; console.log(`CAT   ${JSON.stringify(c)} maps to nothing`); }
}

/* Shapes the live tab does not hold today but the seed and earlier captures do. They are
   part of the contract: a cell the parser has already been taught must not stop reading. */
for (const [cell, want] of fx.alsoSeen.rows as [string, string][]) {
  const got = show(parsePlans(cell));
  if (got !== want) { bad++; console.log(`SEEN  ${JSON.stringify(cell)}\n      want ${want}\n      got  ${got}`); }
}

const rows = filled.length;
const read = filled.filter((r) => parsePlans(r.frequency).length).length;
console.log(`\n${read}/${rows} live plan cells read, ${rows - bad ? "" : ""}${bad} failure${bad === 1 ? "" : "s"}`);
process.exit(bad ? 1 : 0);
