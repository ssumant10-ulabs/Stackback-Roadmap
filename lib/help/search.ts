/** Retrieval over the article corpus. Runs entirely in the browser: no API key, no
 *  server round trip, no third-party widget. The corpus is small enough that an honest
 *  ranked scan beats anything that needs a network hop, and it keeps working offline. */
import { ARTICLES, CATEGORIES } from "./corpus";
import type { HelpArticle } from "./types";

/** Merchants do not use our words. They say COD, mandate, Shiprocket, pincode; the articles
 *  say cash on delivery, AutoPay, WMS, postcode. Every entry here is vocabulary observed in
 *  the pilot conversations the corpus was mined from, so this list grows from real misses,
 *  never from guesses about what somebody might type. */
const ALIASES: Record<string, string[]> = {
  cod: ["cash", "delivery", "prepaid"],
  autopay: ["mandate", "upi", "recurring", "debit"],
  mandate: ["autopay", "upi", "debit"],
  upi: ["autopay", "mandate", "debit"],
  payg: ["pay", "you", "go", "invoice"],
  pincode: ["postcode", "zip", "serviceable", "shipping"],
  zip: ["pincode", "postcode"],
  wms: ["warehouse", "integration", "shiprocket", "unicommerce"],
  shiprocket: ["wms", "warehouse", "integration", "shipping"],
  unicommerce: ["wms", "warehouse", "integration"],
  gokwik: ["checkout", "third", "party"],
  shopflo: ["checkout", "third", "party"],
  razorpay: ["payment", "autopay", "gateway"],
  whatsapp: ["notification", "message", "template"],
  sms: ["notification", "message"],
  refund: ["cancel", "cancellation", "prepaid", "unused"],
  cancel: ["cancellation", "refund", "stop"],
  churn: ["cancel", "cancellation", "pause"],
  bogo: ["buy", "get", "free", "bundle"],
  byob: ["build", "your", "own", "bundle"],
  freebie: ["free", "gift", "product"],
  widget: ["product", "page", "theme", "selector"],
  theme: ["widget", "template", "storefront"],
  portal: ["customer", "account", "self", "serve"],
  uninstall: ["remove", "delete", "offboard", "cancelled"],
  gst: ["tax", "invoice", "billing"],
  invoice: ["payg", "billing", "payment"],
  child: ["order", "delivery", "fulfil"],
  parent: ["order", "checkout", "payment"],
  pause: ["skip", "hold", "resume"],
  skip: ["pause", "delivery", "reschedule"],
  swap: ["change", "edit", "product", "delivery"],
  stock: ["inventory", "reservation", "stockout"],
  reserve: ["inventory", "stock", "reservation"],
  price: ["pricing", "discount", "plan", "cost"],
  discount: ["price", "pricing", "offer", "percentage"],
};

const STOP = new Set([
  "a","an","and","are","as","at","be","but","by","can","cant","do","does","doesnt","for","from",
  "get","got","has","have","how","i","if","in","is","it","its","me","my","no","not","of","on","or",
  "our","so","that","the","their","them","then","there","this","to","us","we","what","when","where",
  "which","who","why","will","with","would","you","your","yours","am","was","were","been","should",
]);

/** Crude, deliberate: plural and gerund only. A real stemmer would collapse pairs this corpus
 *  keeps apart (billing vs bill, shipping vs ship carry different articles). */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9]+/g, " ")
    .split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}

/** Field weights. The question is what a merchant is actually matching against, so it
 *  outweighs the body by a lot: an answer that mentions "shipping" once is not a shipping
 *  article, and without this the long answers win every query. */
const W_Q = 6, W_CAT = 2, W_PATH = 3, W_BODY = 1;

interface Doc {
  art: HelpArticle;
  tf: Map<string, number>;
  len: number;
  text: string;
}

const CAT_NAME = new Map(CATEGORIES.map((c) => [c.id, c.name]));

const DOCS: Doc[] = ARTICLES.map((art) => {
  const tf = new Map<string, number>();
  const add = (s: string, w: number) => { for (const t of tokenize(s)) tf.set(t, (tf.get(t) || 0) + w); };
  add(art.q, W_Q);
  add(CAT_NAME.get(art.cat) || "", W_CAT);
  add(art.path, W_PATH);
  const text = stripTags(art.a);
  add(text, W_BODY);
  let len = 0;
  tf.forEach((v) => { len += v; });
  return { art, tf, len, text };
});

const DF = new Map<string, number>();
for (const d of DOCS) for (const t of d.tf.keys()) DF.set(t, (DF.get(t) || 0) + 1);
const N = DOCS.length;
const idf = (t: string) => Math.log(1 + N / (1 + (DF.get(t) || 0)));

const AVG_LEN = DOCS.reduce((s, d) => s + d.len, 0) / N;
const K1 = 1.4, B = 0.5;

export interface Hit {
  art: HelpArticle;
  score: number;
  /** Terms that actually matched, for highlighting and for telling the reader why. */
  matched: string[];
  snippet: string;
}

/** BM25 over the weighted fields, plus two corrections the plain formula gets wrong here:
 *  an exact phrase in the question is worth more than the sum of its terms, and where two
 *  answers are otherwise equal the one more stores asked about is the better guess. */
export function search(query: string, limit = 12): Hit[] {
  const terms = tokenize(query);
  if (!terms.length) return [];

  const expanded = new Map<string, number>();
  for (const t of terms) {
    expanded.set(t, Math.max(expanded.get(t) || 0, 1));
    for (const alias of ALIASES[t] || []) {
      const a = stem(alias);
      if (!expanded.has(a)) expanded.set(a, 0.45);
    }
  }

  const phrase = query.toLowerCase().replace(/\s+/g, " ").trim();
  const hits: Hit[] = [];

  for (const d of DOCS) {
    let score = 0;
    const matched: string[] = [];
    expanded.forEach((weight, t) => {
      const f = d.tf.get(t);
      if (!f) return;
      score += weight * idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.len / AVG_LEN))));
      if (weight === 1) matched.push(t);
    });
    if (score <= 0) continue;

    if (phrase.length > 6) {
      if (d.art.q.toLowerCase().includes(phrase)) score *= 1.9;
      else if (d.text.toLowerCase().includes(phrase)) score *= 1.3;
    }
    // Coverage matters more than raw frequency: matching 3 of 3 query terms beats matching
    // one of them three times, which is what pulls up the article that is actually about it.
    score *= 0.6 + 0.4 * (matched.length / terms.length);
    score *= 1 + Math.min(d.art.asked, 30) / 150;

    hits.push({ art: d.art, score, matched, snippet: snippetFor(d.text, matched) });
  }

  return hits.sort((a, b) => b.score - a.score || b.art.asked - a.art.asked).slice(0, limit);
}

/** A window around the first matched term, so the reader sees the sentence that matched
 *  rather than the article's opening line, which is often the same on ten articles. */
function snippetFor(text: string, matched: string[]): string {
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of matched) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return text.slice(0, 180) + (text.length > 180 ? "..." : "");
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 90)));
  const end = Math.min(text.length, start + 220);
  return (start > 0 ? "..." : "") + text.slice(start, end).trim() + (end < text.length ? "..." : "");
}

/** Articles near a given one: same category first, then term overlap. Used under an answer
 *  so a merchant who is one question away from the right one can see it. */
export function related(art: HelpArticle, limit = 3): HelpArticle[] {
  const hits = search(art.q, limit + 6).filter((h) => h.art.id !== art.id);
  const same = hits.filter((h) => h.art.cat === art.cat);
  const rest = hits.filter((h) => h.art.cat !== art.cat);
  return [...same, ...rest].slice(0, limit).map((h) => h.art);
}

export function byId(id: string): HelpArticle | undefined {
  return ARTICLES.find((a) => a.id === id);
}
