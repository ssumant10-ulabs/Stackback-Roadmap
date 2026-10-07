/** Every widget setting, checked against whether anything reads it.
 *
 *  The rule this enforces is already written into `widget-templates.ts`, as the reason
 *  `withoutFields()` exists: a control that changes nothing is worse than an absent one. It
 *  was not checkable, so `direct_checkout` sat on the panel for months, declared, defaulted
 *  and drawn, with no line in the repo reading it. Toggling it did nothing and there was no
 *  way to notice except by toggling it.
 *
 *  Run: npx tsx scripts/eval-settings.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { SCALES } from "../lib/help/categories";
import { join } from "node:path";
import { TOGGLE_GROUPS } from "../lib/help/widget";

function walk(d: string, out: string[] = []): string[] {
  for (const f of readdirSync(d)) {
    if (f === "node_modules" || f === ".next" || f === ".git" || f === "scripts") continue;
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(f)) out.push(p);
  }
  return out;
}

const files = walk(process.cwd()).filter((f) => !f.endsWith("lib/help/widget.ts"));
const blob = files.map((f) => readFileSync(f, "utf8")).join("\n");
const uses = (name: string) => (blob.match(new RegExp(`\\b${name}\\b`, "g")) || []).length;

let rows = 0;
const dead: string[] = [];

for (const g of TOGGLE_GROUPS) {
  for (const d of g.items) {
    /* A row that DECLARES the preview does not draw it is exempt. The exemption has to be a
       flag rather than a judgement, or every dead control can be explained away in review. */
    const kids = (d as { checks?: { key: string; notPreviewable?: true }[] }).checks;
    const keys = kids?.length
      ? kids.filter((c) => !c.notPreviewable).map((c) => c.key)
      : [String(d.key)];
    for (const k of keys) {
      rows++;
      // `theme` rows are keyed alike and told apart by themePath, checked below.
      if (k === "theme") continue;
      if (uses(k) === 0) dead.push(`${k}  (${d.label})`);
    }
    if (d.themePath) {
      const leaf = d.themePath.split(".").pop()!;
      if (uses(leaf) === 0) dead.push(`theme.${d.themePath}  (${d.label})`);
    }
  }
}

dead.forEach((d) => console.log(`  DEAD  ${d}`));
console.log(`\n  ${rows} settings on the panel, ${dead.length} with no reader.`);
/* ---- the scale bands, and where AutoPay starts ----------------------------------------
   A store doing a few thousand orders was shown "prepaid and pay as you go", because the
   band ran 100 to 1,000 with no AutoPay in it at all and nothing above it until 1,000. The
   threshold is 500: below that the Razorpay mandate setup and the drop-off at the mandate
   screen cost more than the collection saves; above it, every band should at least offer it. */
{
  const lo = (b: { label: string }) => {
    const m = b.label.replace(/,/g, "").match(/(\d+)/g);
    return /^under/i.test(b.label) ? 0 : Number(m?.[0] ?? 0);
  };
  console.log("\nScale bands and AutoPay");
  for (const b of SCALES) {
    const has = b.modes.includes("auto_debit");
    const want = lo(b) >= 500;
    const line = `${b.label.padEnd(30)} AutoPay ${has ? "offered" : "not offered"}`;
    if (has === want) console.log(`  ok    ${line}`);
    else dead.push(`${line} — expected ${want ? "offered" : "not offered"} at this volume`);
  }
  if (!SCALES.every((b, i) => i === 0 || lo(b) >= lo(SCALES[i - 1]))) dead.push("the scale bands are out of order");
  /* No gap and no overlap at the seam, or a store reads two bands and picks neither. */
  if (!SCALES.some((b) => lo(b) === 500)) dead.push("no band starts at 500, where the AutoPay decision is");
  else console.log("  ok    a band starts exactly at 500, which is where the decision is");
}

console.log(dead.length ? "FAIL" : "PASS");
process.exit(dead.length ? 1 : 0);
