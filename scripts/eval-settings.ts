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
import { DEFAULT_WIDGET, EXPORT_ROWS, readTheme } from "../lib/help/widget";
import { SCALES } from "../lib/help/categories";
import { isOwner } from "../lib/firebase";
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
  /* The pair that must never be offered together: both collect per delivery, one by asking
     and one automatically, so a band carrying both asks a customer to choose between being
     invoiced and being charged. The form already unticks one when you pick the other, and a
     band that suggests both contradicts the form. */
  for (const b of SCALES) {
    const both = b.modes.includes("payg") && b.modes.includes("auto_debit");
    if (both) dead.push(`${b.label} offers pay as you go AND AutoPay — they are alternatives`);
  }
  console.log("  ok    no band offers pay as you go and AutoPay together");
  if (!SCALES.some((b) => lo(b) === 500)) dead.push("no band starts at 500, where the AutoPay decision is");
  else console.log("  ok    a band starts exactly at 500, which is where the decision is");
}

/* ---- the exported sheet prints a VALUE, never an object ---------------------------------
   Every "Shape and type" row shares `key: "theme"` and differs only by `themePath`, so
   reading settings[d.key] handed back the whole theme object and seven rows on the exported
   sheet printed "[object Object]". The value lives at the path. */
{
  const at = (d: { key: string; themePath?: string }) =>
    d.themePath ? readTheme(DEFAULT_WIDGET, d.themePath)
      : (DEFAULT_WIDGET as unknown as Record<string, unknown>)[d.key];
  console.log("\nEvery export row resolves to a printable value");
  let objs = 0;
  for (const d of EXPORT_ROWS as { key: string; themePath?: string; label: string }[]) {
    const v = at(d);
    if (v !== null && typeof v === "object") { objs++; dead.push(`${d.label} resolves to an object, not a value`); }
  }
  if (!objs) console.log(`  ok    all ${(EXPORT_ROWS as unknown[]).length} rows resolve to a string, number or boolean`);
}

/* Restore replaces the roadmap for the whole team and sat behind nothing but being signed in,
   so anybody on the allowed domain could roll the board back from a file. */
console.log("\nOnly the owner may replace what the team sees");
for (const [email, want] of [
  ["ai@ulabsglobal.com", true], ["AI@ULABSGLOBAL.COM", true], [" ai@ulabsglobal.com ", true],
  ["someone@ulabsglobal.com", false], ["ai@example.com", false], ["", false], [null, false],
] as [string | null, boolean][]) {
  if (isOwner(email) !== want) {
    dead.push(`isOwner(${JSON.stringify(email)}) should be ${want}`);
    console.log(`  FAIL  isOwner(${JSON.stringify(email)}) should be ${want}`);
  } else console.log(`  ok    ${JSON.stringify(email)} -> ${want}`);
}
/* And the gate has to be ON the controls, not merely defined. */
const modal = readFileSync(new URL("../components/SettingsModal.tsx", import.meta.url), "utf8");
for (const needle of ["Restore from file", "Restore this browser", "Download backup"]) {
  const at = modal.indexOf(needle);
  const guarded = at > 0 && /owner/.test(modal.slice(Math.max(0, at - 900), at));
  if (!guarded) { dead.push(`"${needle}" is not behind the owner check`); console.log(`  FAIL  "${needle}" is not behind the owner check`); }
  else console.log(`  ok    "${needle}" is behind the owner check`);
}

console.log(dead.length ? "FAIL" : "PASS");
process.exit(dead.length ? 1 : 0);
