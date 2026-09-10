#!/usr/bin/env node
/* Turn the Help Centre HTML deliverable into lib/help/corpus.ts.
 *
 * The words live in one place: the versioned deliverable at
 * Project Deliverables/stackback/Operations/StackBack_Merchant_Help_Centre_v<n>.html.
 * That file declares its articles as A(cat, status, askedBy, question, answerHTML, path)
 * calls and its diagrams as FLOW_* string builders, so the honest way to read it is to
 * run its own script block rather than to re-parse the prose with a regex.
 *
 * Usage: node scripts/gen-help-corpus.js <path-to-help-centre.html>
 */
const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/gen-help-corpus.js <help-centre.html>"); process.exit(1); }
const html = fs.readFileSync(src, "utf8");

/* Take everything from the opening <script> to just before the render half. The render half
 * touches document, which does not exist here, and none of it carries content. */
const lines = html.split("\n");
const from = lines.findIndex((l) => l.trim() === "<script>");
const to = lines.findIndex((l) => l.startsWith("var PILL"));
if (from < 0 || to < 0 || to <= from) { console.error("Could not find the content block. Has the deliverable's shape changed?"); process.exit(1); }

const body = lines.slice(from + 1, to).join("\n");
const read = new Function(body + "\nreturn { CATS, ARTS, FLOWS: { onboard: FLOW_ONBOARD, orders: FLOW_ORDERS, payg: FLOW_PAYG, edit: FLOW_EDIT } };");
const { CATS, ARTS, FLOWS } = read();

/* Stable, readable ids so a link to an answer survives a re-generation. Position would not:
 * inserting one article in the middle would silently repoint every link after it. */
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
const used = new Map();
const articles = ARTS.map((a, i) => {
  const base = slug(a.q);
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  return { id: n === 1 ? base : `${base}-${n}`, cat: a.c, status: a.s, asked: a.n, q: a.q, a: a.a, path: a.p || "", ord: i };
});

const j = (v) => JSON.stringify(v);
const out = `/* GENERATED from ${path.basename(src)} by scripts/gen-help-corpus.js.
 * Do not hand-edit: change the deliverable and re-run the generator, so the HTML stays the
 * single source of the words and this file stays a build product. */
import type { HelpArticle, HelpCategory } from "./types";

export const CORPUS_SOURCE = ${j(path.basename(src))};
export const CORPUS_BUILT = ${j(new Date().toISOString().slice(0, 10))};

/** Inline SVG flow diagrams, authored in the deliverable and themed by CSS variables. */
export const FLOWS: Record<string, string> = ${j(FLOWS)};

export const CATEGORIES: HelpCategory[] = [
${CATS.map((k) => "  " + j({ id: k.id, name: k.name, blurb: k.blurb, flow: k.id === "start" ? "onboard" : "" })).join(",\n")}
];

export const ARTICLES: HelpArticle[] = [
${articles.map((a) => "  " + j(a)).join(",\n")}
];
`;
const dest = path.join(__dirname, "..", "lib", "help", "corpus.ts");
fs.writeFileSync(dest, out);
console.log(`${articles.length} articles, ${CATS.length} categories, ${Object.keys(FLOWS).length} diagrams -> ${path.relative(process.cwd(), dest)}`);
