/** The QA label vocabulary, asserted against the module map it came from.
 *
 *  The map in `Project Deliverables/stackback/CLAUDE.md` has two levels and the app only
 *  ever carried the first, which is why there was no way to file anything against
 *  Subscription Management — only against Portal Surface, which is most of the product.
 *  Now that both levels are in the code, the thing worth testing is that they still match
 *  the document, and that the two places a card can be created offer the same vocabulary.
 *
 *  Run: npx tsx scripts/eval-labels.ts
 */
import { readFileSync } from "node:fs";
import {
  ERROR_TYPES, SUB_MODULES, SURFACES, subModuleLabel, subModulesFor, surfaceZone,
} from "../lib/qa-labels";

let fails = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { fails++; console.log(`  FAIL  ${what}`); } else console.log(`  ok    ${what}`);
};

/* ---- against the document -------------------------------------------------------------
   Read, not transcribed. A copy of the map pasted in here would pass forever while the two
   drifted, which is the failure this is for. */
const MAP = "/Users/unifynd/Downloads/iClaude/Project Deliverables/stackback/CLAUDE.md";
let doc = "";
try { doc = readFileSync(MAP, "utf8"); } catch { /* checked below */ }

console.log("\nEvery surface and sub-module is in the module map");
if (!doc) {
  console.log("  SKIP  module map not readable at " + MAP);
} else {
  for (const s of SURFACES) ok(doc.includes(s.label), `surface "${s.label}" appears in the map`);
  for (const [surface, mods] of Object.entries(SUB_MODULES)) {
    for (const m of mods) ok(doc.includes(m.label), `sub-module "${m.label}" (${surface}) appears in the map`);
  }
  /* The one the user went looking for and could not find. */
  ok(subModuleLabel("portal", "subscriptions") === "Subscription Management",
    "Subscription Management is reachable, under Portal Surface");
}

console.log("\nThe two levels hang together");
ok(Object.keys(SUB_MODULES).length === SURFACES.length, "every surface has a sub-module list");
for (const s of SURFACES) ok(subModulesFor(s.id).length > 0, `${s.label} lists at least one sub-module`);
ok(subModulesFor("").length === 0, "no surface, no sub-modules");
ok(subModulesFor("not-a-surface").length === 0, "an unknown surface offers nothing rather than throwing");
/* Ids are what gets stored, so a duplicate inside one surface would make two labels
   indistinguishable on a saved card. */
for (const [surface, mods] of Object.entries(SUB_MODULES)) {
  ok(new Set(mods.map((m) => m.id)).size === mods.length, `${surface} sub-module ids are unique`);
}
ok(new Set(SURFACES.map((s) => s.id)).size === SURFACES.length, "surface ids are unique");
ok(new Set(ERROR_TYPES.map((e) => e.id)).size === ERROR_TYPES.length, "error type ids are unique");
/* `subModuleLabel` is read with whatever pair a card happens to hold, including a stale one
   left over from a surface change. It has to answer null, not the wrong label. */
ok(subModuleLabel("order", "subscriptions") === null,
  "a sub-module from another surface does not resolve");
ok(subModuleLabel(null, "cart") === null, "nor one with no surface at all");

console.log("\nZones");
ok(SURFACES.every((s) => s.zone === "Customer Zone" || s.zone === "Merchant Zone"),
  "every surface is in one of the two zones");
ok(surfaceZone("portal") === "Customer Zone", "Portal Surface is customer-facing");
ok(surfaceZone("order") === "Merchant Zone", "Order Module is merchant-facing");

/* ---- the two creation paths offer the same thing --------------------------------------
   The Add form and the card drawer are separate components, and the bug was that one of
   them simply had no surface field. Both now read these same exports, so what is checked
   here is that neither has gone back to keeping its own copy. */
console.log("\nThe Add form and the card drawer read one vocabulary");
const add = readFileSync("components/AddTaskModal.tsx", "utf8");
const drawer = readFileSync("components/views/CardDetail.tsx", "utf8");
for (const [name, src] of [["Add form", add], ["card drawer", drawer]] as const) {
  ok(/from "@\/lib\/qa-labels"/.test(src), `${name} imports the label vocabulary`);
  ok(src.includes("SURFACES"), `${name} offers Surface`);
  ok(src.includes("subModulesFor"), `${name} offers Sub-module`);
  ok(src.includes("ERROR_TYPES"), `${name} offers Error type`);
  ok(src.includes("ALL_KINDS"), `${name} offers Type`);
  ok(/setDesc|desc:/.test(src), `${name} offers a description`);
  /* Landing is folded into Template. A form that still lists it is a second word for one
     thing, which is how a pile stops being searchable. */
  ok(/filter\(\(k\) => k !== "landing"\)/.test(src), `${name} leaves Landing page out of Type`);
}

console.log(fails ? `\n${fails} FAILED\n` : "\nAll label assertions pass.\n");
process.exit(fails ? 1 : 0);
