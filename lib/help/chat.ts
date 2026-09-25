/** The conversational layer over `search`. It is retrieval, not generation: every word a
 *  merchant reads was written into the Help Centre deliverable and reviewed. Nothing is
 *  composed at runtime, so the chat cannot invent a capability the product does not have,
 *  which is the failure mode that matters when the reader is a paying merchant.
 *
 *  What it adds over the search box is judgement about the shape of the reply: answer when
 *  one article clearly wins, ask which one when several are close, and say plainly that
 *  there is no answer when there is not. */
import { ARTICLES, CATEGORIES } from "./corpus";
import { related, search, stripTags, tokenize } from "./search";
import type { HelpArticle } from "./types";

export type TurnKind = "answer" | "choose" | "miss" | "chat";

export interface Turn {
  id: string;
  role: "you" | "help";
  kind: TurnKind;
  /** What the merchant typed, on a "you" turn. */
  text: string;
  /** The article this turn answers with. */
  art?: HelpArticle;
  /** Candidates when the question was ambiguous, or near misses on a miss. */
  options?: HelpArticle[];
  /** Further reading under a confident answer. */
  more?: HelpArticle[];
  /** One line of framing above the article, so the reply reads as a reply. */
  lead?: string;
  at: number;
}

let seq = 0;
const nextId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Below this, a top hit is noise dressed as an answer.
 *
 *  Read off `Hit.confidence`, not the raw score, which was the bug: BM25 scales with how
 *  many words you typed, so a raw cutoff asked "cod" to clear the same bar as "does the
 *  checkout order double my revenue". Confidence divides by the best that query could have
 *  scored, so the two are comparable. Tuned against the corpus: 0.25 sits between "how do I
 *  turn off cash on delivery" (0.40, a real question) and "something about stuff" (0.14). */
const FLOOR = 0.25;
/** A top hit this far ahead of the runner-up is the answer. Closer than this and the honest
 *  move is to ask, because picking one of two plausible answers wrong costs more than a
 *  question does.
 *
 *  Was 1.45, which almost nothing cleared: the chat asked "which one?" to nineteen of
 *  twenty-five real merchant questions, which is a search box with an extra step. */
const DECISIVE = 1.3;
/** Relaxed to this when the whole shortlist sits in one category. If the corpus agrees on
 *  the topic, the disagreement is about which paragraph, and leading with the best one and
 *  putting the rest under "more" beats making the merchant choose blind. */
const DECISIVE_SAME_TOPIC = 1.12;

const SMALLTALK: [RegExp, string][] = [
  [/^(hi|hey|hello|yo|namaste|hii+)\b/i, `Hello. Ask me anything about your StackBack setup: plans, bundles, orders, payments, the customer portal. I answer out of the ${ARTICLES.length} questions pilot stores have actually asked.`],
  [/^(thanks|thank you|thx|ty|great|perfect|got it|cool)\b/i, "Glad that helped. Anything else?"],
  [/(human|person|team|agent|support|talk to someone|call me)/i, "I can hand this to the team. Use **Send to the team** below the chat and it will carry your question and what I showed you, so nobody asks you to repeat it."],
  [/^(bye|thats all|that's all|nothing)\b/i, "Right. The categories on the left hold everything I know, if you would rather browse."],
];

/** Status drives the lead line. A merchant asking "can I do X" where X is not supported
 *  needs that in the first sentence, not three paragraphs down. */
function leadFor(art: HelpArticle): string {
  switch (art.status) {
    case "n": return "Short answer: no, and here is what the product does instead.";
    case "r": return "Not today. It is on the roadmap, and here is where it stands.";
    case "l": return "Yes, with limits. The limits are the part worth reading.";
    case "m": return "This one needs an action from you.";
    case "x": return "Worth reading carefully: this one can cost you something if it is missed.";
    default: return "";
  }
}

function pickFromOptions(text: string, options: HelpArticle[]): HelpArticle | null {
  const t = text.trim().toLowerCase();
  const n = parseInt(t, 10);
  if (!isNaN(n) && n >= 1 && n <= options.length && t.length <= 2) return options[n - 1];
  // "the second one", "first"
  const ord = ["first", "second", "third", "fourth", "fifth"].findIndex((w) => t.includes(w));
  if (ord >= 0 && ord < options.length) return options[ord];
  // A short reply that leans clearly toward one candidate: treat it as choosing, not as a
  // new question, so "the prepaid one" does not restart the search from scratch.
  if (t.split(/\s+/).length <= 5) {
    const q = tokenize(t);
    if (q.length) {
      const scored = options.map((o) => {
        const ot = new Set(tokenize(o.q));
        return { o, n: q.filter((w) => ot.has(w)).length };
      }).sort((a, b) => b.n - a.n);
      if (scored[0].n > 0 && scored[0].n > (scored[1]?.n || 0)) return scored[0].o;
    }
  }
  return null;
}

/** Nearest categories by name, for a miss. Better than listing all seventeen. */
function nearestCategories(query: string, limit = 3) {
  const q = new Set(tokenize(query));
  return CATEGORIES
    .map((c) => ({ c, n: tokenize(c.name + " " + c.blurb).filter((w) => q.has(w)).length }))
    .sort((a, b) => b.n - a.n).slice(0, limit).map((x) => x.c);
}

export function you(text: string): Turn {
  return { id: nextId(), role: "you", kind: "chat", text, at: Date.now() };
}

/** One reply. `prior` is the last help turn, so a bare "2" or "the prepaid one" resolves
 *  against the choices that were just offered instead of being searched as a question. */
export function reply(text: string, prior?: Turn): Turn {
  const base = { id: nextId(), role: "help" as const, text: "", at: Date.now() };

  if ((prior?.kind === "choose" || prior?.kind === "miss") && prior.options?.length) {
    const picked = pickFromOptions(text, prior.options);
    if (picked) return { ...base, kind: "answer", art: picked, more: related(picked), lead: leadFor(picked) };
  }

  for (const [re, said] of SMALLTALK) {
    if (re.test(text.trim())) return { ...base, kind: "chat", text: said };
  }

  const hits = search(text, 6);
  const top = hits[0];

  if (!top || top.confidence < FLOOR) {
    return {
      ...base,
      kind: "miss",
      text: "I do not have an answer for that one, and I would rather say so than give you a near miss.",
      options: hits.slice(0, 3).map((h) => h.art),
      more: [],
      lead: nearestCategories(text).map((c) => c.name).join(" · "),
    };
  }

  const runnerUp = hits[1];
  const ratio = runnerUp ? top.score / runnerUp.score : Infinity;
  const oneTopic = hits.slice(0, 3).every((h) => h.art.cat === top.art.cat);
  const decisive = ratio >= DECISIVE || (oneTopic && ratio >= DECISIVE_SAME_TOPIC);

  if (decisive) {
    /* The runners-up are the further reading when they were close, rather than a generic
       "related" list that repeats what the answer already said. */
    const near = hits.slice(1, 4).filter((h) => h.score >= top.score * 0.6).map((h) => h.art);
    return {
      ...base, kind: "answer", art: top.art,
      more: near.length ? near : related(top.art),
      lead: leadFor(top.art),
    };
  }

  return {
    ...base,
    kind: "choose",
    text: "A few of these could be what you mean. Which one?",
    options: hits.slice(0, Math.min(4, hits.length)).map((h) => h.art),
  };
}

/** The transcript as plain text, for the hand-to-the-team escalation. The team should not
 *  have to ask a merchant what they already typed and what they were already shown. */
export function transcript(turns: Turn[]): string {
  return turns.map((t) => {
    if (t.role === "you") return `Merchant: ${t.text}`;
    if (t.kind === "answer" && t.art) return `Help Centre: ${t.art.q}\n  ${stripTags(t.art.a).slice(0, 240)}`;
    if (t.kind === "choose") return `Help Centre: offered ${t.options?.map((o) => o.q).join(" / ")}`;
    if (t.kind === "miss") return `Help Centre: no answer found`;
    return `Help Centre: ${t.text}`;
  }).join("\n\n");
}

export const OPENER: Turn = {
  id: "opener", role: "help", kind: "chat", at: 0,
  text: `Ask a question the way you would ask it on a call. I search ${ARTICLES.length} answers written from what pilot stores actually asked, and I will tell you when I do not have one.`,
};
