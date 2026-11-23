/** Every answer the Help Centre holds, whichever file it was authored in.
 *
 *  `corpus.ts` is a build product of the Help Centre HTML and carries a "do not hand-edit"
 *  at the top. Answers learned on a call live in `corpus-extra.ts`, and plain-language edits,
 *  merged duplicates and newer behaviour live in `overrides.ts`. They are joined here, once,
 *  and everything downstream (search, the chat, the FAQ, the counts) reads this. */
import { ARTICLES as GENERATED, CATEGORIES as GENERATED_CATS } from "./corpus";
import { EXTRA_ARTICLES } from "./corpus-extra";
import { CATEGORY_TEXT, EDITS, MERGED } from "./overrides";
import type { HelpArticle, HelpCategory } from "./types";

export const ARTICLES: HelpArticle[] = [...GENERATED, ...EXTRA_ARTICLES]
  .filter((a) => !MERGED[a.id])
  .map((a) => (EDITS[a.id] ? { ...a, ...EDITS[a.id] } : a));

export const CATEGORIES: HelpCategory[] = GENERATED_CATS.map((c) => ({ ...c, ...CATEGORY_TEXT[c.id] }));

/** An id that was merged away still resolves, so an old shared link lands on the answer. */
export const canonicalId = (id: string) => MERGED[id] ?? id;

export { CORPUS_BUILT, CORPUS_SOURCE, FLOWS } from "./corpus";
