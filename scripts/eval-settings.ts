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
console.log(dead.length ? "FAIL" : "PASS");
process.exit(dead.length ? 1 : 0);
