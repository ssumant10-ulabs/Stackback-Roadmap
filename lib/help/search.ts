/** Retrieval over the article corpus. Runs entirely in the browser: no API key, no
 *  server round trip, no third-party widget. The corpus is small enough that an honest
 *  ranked scan beats anything that needs a network hop, and it keeps working offline. */
import { ARTICLES, CATEGORIES } from "./corpus";
import { FAQ_IDS, INTENTS } from "./faq";
import type { HelpArticle } from "./types";

/** Merchants do not use our words. They say COD, mandate, Shiprocket, pincode; the articles
 *  say cash on delivery, AutoPay, WMS, postcode. Every entry here is vocabulary observed in
 *  the pilot conversations the corpus was mined from, so this list grows from real misses,
 *  never from guesses about what somebody might type.
 *
 *  Groups, not a directed map. The old shape listed `cod -> [cash, delivery, prepaid]` and
 *  nothing the other way, so a merchant who typed the words out in full got none of it, and
 *  "how do I turn off cash on delivery" returned a portal article. A group is symmetric by
 *  construction, which is the only way a vocabulary list stays correct after an edit.
 *
 *  A group holds SYNONYMS, never topical neighbours. `delivery` and `prepaid` used to sit in
 *  the COD group: both are words a COD article contains and neither means COD, so every
 *  COD query pulled in every delivery article. A neighbour in here costs more than a miss. */
const ALIAS_GROUPS: string[][] = [
  ["cod", "cash"],
  ["autopay", "mandate", "upi", "debit", "nach", "emandate"],
  ["payg", "invoice"],
  ["pincode", "postcode", "zip", "serviceability"],
  ["wms", "oms", "warehouse", "unicommerce", "easyecom", "increff"],
  // Shiprocket appears in this corpus only as a checkout partner, never as a warehouse.
  ["checkout", "gokwik", "shopflo", "shiprocket"],
  ["notification", "whatsapp", "sms"],
  ["cancel", "cancellation", "churn"],
  ["refund", "reversal"],
  ["bogo", "freebie"],
  ["byob", "bundle"],
  ["widget", "selector"],
  ["theme", "storefront"],
  ["portal", "account"],
  ["uninstall", "offboard"],
  ["gst", "tax"],
  ["pause", "hold"],
  ["skip", "reschedule"],
  ["swap", "change", "edit", "replace", "amend"],
  ["stock", "inventory", "reservation"],
  ["price", "pricing", "cost"],
  ["discount", "offer"],
  ["parent", "child"],
  ["frequency", "cadence", "interval"],
  ["razorpay", "gateway"],
  /* "Turn it off" is how a merchant says "disable", and the corpus only ever writes the
     second. Without this, "how do I turn off cash on delivery" spent its coverage on "turn"
     and "off" and surfaced an article about turning off a PORTAL action. */
  ["disable", "off", "deactivate", "switch"],
  ["enable", "activate"],
];

/** term -> the other members of its group. Built once, symmetric by construction. */
const ALIASES: Record<string, string[]> = (() => {
  const m: Record<string, Set<string>> = {};
  for (const g of ALIAS_GROUPS) {
    for (const a of g) {
      (m[a] ||= new Set());
      for (const b of g) if (b !== a) m[a].add(b);
    }
  }
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));
})();

/** Multi-word phrases a merchant types that the corpus writes as one word, normalised on the
 *  raw string before it is ever tokenised. Tokenising first loses them: "cash on delivery"
 *  becomes three terms, "on" is a stop word, and the other two are the two most common words
 *  in the corpus. Longest first, so "pay as you go" is not eaten by "pay". */
const PHRASES: [RegExp, string][] = [
  [/\bcash[ -]on[ -]delivery\b/g, "cod"],
  [/\bpay[ -]as[ -]you[ -]go\b/g, "payg"],
  [/\bbuild[ -]your[ -]own\b/g, "byob"],
  [/\bbuy[ -]one[ -]get[ -]one\b/g, "bogo"],
  [/\bauto[ -]debit\b/g, "autopay"],
  [/\bauto[ -]pay\b/g, "autopay"],
  [/\be[ -]mandate\b/g, "mandate"],
  [/\bcustomer portal\b/g, "portal"],
  [/\bpin[ -]code\b/g, "pincode"],
  [/\bpost[ -]code\b/g, "postcode"],
  [/\bone[ -]time\b/g, "onetime"],
];

/** Appends the canonical term, it does not swap the phrase out. Replacing "customer portal"
 *  with "portal" threw away "customer" and left a one-word query, which the short articles
 *  then won on length alone. Both readings have to survive.
 *
 *  Applied to the ARTICLES as well as to the query, which is the half that was missing:
 *  normalising only one side means "build your own" in a question and `byob` in a query stop
 *  being the same thing, which is exactly what a vocabulary map exists to prevent. */
export function normalisePhrases(s: string): string {
  const lower = s.toLowerCase();
  const extra: string[] = [];
  for (const [re, to] of PHRASES) { re.lastIndex = 0; if (re.test(lower)) extra.push(to); }
  return extra.length ? lower + " " + extra.join(" ") : lower;
}

const STOP = new Set([
  "a","an","and","are","as","at","be","but","by","can","cant","do","does","doesnt","for","from",
  "get","got","has","have","how","i","if","in","is","it","its","me","my","no","not","of","on","or",
  "our","so","that","the","their","them","then","there","this","to","us","we","what","when","where",
  "which","who","why","will","with","would","you","your","yours","am","was","were","been","should",
]);

/** Pairs the suffix rules below cannot reach, and that the corpus depends on. "cancel" and
 *  "cancellation" are the same question and stem apart; a merchant types the first and every
 *  article title uses the second. Kept short and observed, never speculative. */
const LEMMA: Record<string, string> = {
  cancellation: "cancel", cancelled: "cancel", cancelling: "cancel", cancellations: "cancel",
  subscribe: "subscription", subscribed: "subscription", subscriber: "subscription",
  fulfillment: "fulfilment", fulfil: "fulfilment", fulfill: "fulfilment",
  paused: "pause", pausing: "pause", billed: "billing", charged: "charge",
};

/** Crude, deliberate: plural and gerund only. A real stemmer would collapse pairs this corpus
 *  keeps apart (billing vs bill, shipping vs ship carry different articles). */
function stem(w: string): string {
  if (LEMMA[w]) return LEMMA[w];
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return LEMMA[w.slice(0, -1)] || w.slice(0, -1);
  return w;
}

export function tokenize(s: string): string[] {
  return normalisePhrases(s.replace(/<[^>]+>/g, " ")).replace(/[^a-z0-9]+/g, " ")
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
  /** Everything a merchant is plausibly aiming at: the question, the category, the path.
   *  Kept apart from the body because whether a term is HERE is a different fact from how
   *  often it appears, and the two were previously summed into one number. */
  head: Map<string, number>;
  tf: Map<string, number>;
  len: number;
  text: string;
}

const CAT_NAME = new Map(CATEGORIES.map((c) => [c.id, c.name]));

const DOCS: Doc[] = ARTICLES.map((art) => {
  const tf = new Map<string, number>();
  const head = new Map<string, number>();
  const add = (s: string, w: number, into?: Map<string, number>) => {
    for (const t of tokenize(s)) {
      tf.set(t, (tf.get(t) || 0) + w);
      // The strongest field the term appears in, not the sum. Summing made a term in the
      // category name indistinguishable from the same term in the question, so every
      // article under "Notifications and reminders" looked equally about notifications.
      if (into) into.set(t, Math.max(into.get(t) || 0, w));
    }
  };
  add(art.q, W_Q, head);
  add(CAT_NAME.get(art.cat) || "", W_CAT, head);
  add(art.path, W_PATH, head);
  const text = stripTags(art.a);
  add(text, W_BODY);
  let len = 0;
  tf.forEach((v) => { len += v; });
  return { art, head, tf, len, text };
});

const DF = new Map<string, number>();
for (const d of DOCS) for (const t of d.tf.keys()) DF.set(t, (DF.get(t) || 0) + 1);
const N = DOCS.length;
const idf = (t: string) => Math.log(1 + N / (1 + (DF.get(t) || 0)));

const AVG_LEN = DOCS.reduce((s, d) => s + d.len, 0) / N;
/** B was 0.5, which barely normalises for length, so the longest answers won on volume.
 *  0.6 sits between that and the textbook 0.75, which over-corrected: at 0.75 "Is SMS
 *  available?", four lines long, beat "Which notifications does StackBack send?". */
const K1 = 1.4, B = 0.6;

export interface Hit {
  art: HelpArticle;
  score: number;
  /** 0..1, score over the best this query could possibly have scored. Unlike `score` it is
   *  comparable across queries, which is what the chat needs: a raw BM25 cutoff asks a
   *  one-word question to clear the same bar as a nine-word one. */
  confidence: number;
  /** Terms that actually matched, for highlighting and for telling the reader why. */
  matched: string[];
  snippet: string;
}

/** BM25 over the weighted fields, plus the corrections the plain formula gets wrong here:
 *  an exact phrase in the question is worth more than the sum of its terms, coverage of the
 *  query beats frequency of one term, a match in the question outranks the same match buried
 *  in the body, and where two answers are otherwise equal the one more stores asked about is
 *  the better guess. */
export function search(query: string, limit = 12): Hit[] {
  // Unique: the phrase map appends a canonical term that is often already there, and a
  // duplicate inflates the coverage denominator so a fully matched query scores as partial.
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];

  const expanded = new Map<string, number>();
  for (const t of terms) {
    expanded.set(t, Math.max(expanded.get(t) || 0, 1));
    for (const alias of ALIASES[t] || []) {
      const a = stem(alias);
      if (!expanded.has(a)) expanded.set(a, 0.4);
    }
  }

  /** The best score reachable for this query: every primary term matching in the question,
   *  at the saturation BM25 allows. The denominator that turns a raw score into confidence. */
  const ceiling = terms.reduce(
    (s, t) => s + idf(t) * ((W_Q * (K1 + 1)) / (W_Q + K1)), 0,
  ) || 1;

  let qWeight = 0;
  expanded.forEach((w) => { qWeight += w; });
  const termIdf = terms.reduce((a, t) => a + idf(t), 0) || 1;

  const phrase = normalisePhrases(query).replace(/\s+/g, " ").trim();
  /* Curated phrasings that name an answer without sharing a word with it. A boost applied to
     one article, so a better lexical match can still beat it. */
  const intended = new Set(INTENTS.filter((i) => i.when.test(phrase)).map((i) => i.id));
  const hits: Hit[] = [];

  for (const d of DOCS) {
    let score = 0;
    let headW = 0;
    let coverIdf = 0;
    const matched: string[] = [];
    expanded.forEach((weight, t) => {
      const f = d.tf.get(t);
      if (!f) return;
      score += weight * idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.len / AVG_LEN))));
      // Weighted by WHERE it landed: the question is worth three times the category name,
      // which is the difference between an article about notifications and one that merely
      // files under them.
      const h = d.head.get(t);
      if (h) headW += weight * Math.min(1, h / W_Q);
      if (weight === 1) { matched.push(t); coverIdf += idf(t); }
    });
    if (score <= 0) continue;

    if (phrase.length > 6) {
      if (d.art.q.toLowerCase().includes(phrase)) score *= 1.9;
      else if (d.text.toLowerCase().includes(phrase)) score *= 1.3;
    }
    /* Coverage matters more than raw frequency: matching 3 of 3 query terms beats matching
       one of them three times, which is what pulls up the article that is actually about it.
       Weighted by idf, because counting terms equally makes "customer", a word in half the
       corpus, worth as much as "cancel". 0.6 + 0.4x left a one-of-five match holding 68% of
       its score, which is how "how do I know which order is a subscription" returned an
       article about surprise boxes. */
    score *= 0.3 + 0.7 * (coverIdf / termIdf);
    /* How much of the query the QUESTION, category and path account for, as against the body.
       An article whose title says none of what was asked is answering something else and
       mentioning this in passing: "Is SMS available?" is not the answer to "notifications".
       Weighted, so an alias landing in a title still counts, which is the only signal a
       one-word query like "shiprocket" has. A tax and a bonus, never a filter, because a
       merchant's words and ours diverge: "change the product in a delivery" is our "swap". */
    score *= 0.5 + 1.5 * Math.min(1, headW / qWeight);
    /* How many of the 32 mined stores asked it. A real prior, not a tie-break: on a short
       general query ("customer wants to cancel") the general article and a narrow one about
       the cancellation policy score within a point of each other lexically, and the one five
       stores asked is the better guess every time. Was capped at 1.2x, which never moved a
       ranking it was not already winning. */
    score *= 1 + Math.min(d.art.asked, 20) / 28;
    /* On the curated FAQ, which is 24 questions hand-picked from the pilot calls as the ones
       merchants actually arrive with. An editorial signal the corpus cannot carry: "what do
       swap, add and reschedule actually do" is the answer to "can the customer change the
       product in a delivery", and shares not one word with it. */
    if (FAQ_IDS.has(d.art.id)) score *= 1.22;
    if (intended.has(d.art.id)) score *= 2.4;

    hits.push({ art: d.art, score, confidence: score / ceiling, matched, snippet: snippetFor(d.text, matched) });
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
