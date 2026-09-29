/** Every answer the Help Centre holds, whichever file it was authored in.
 *
 *  `corpus.ts` is a build product of the Help Centre HTML and carries a "do not hand-edit"
 *  at the top, which is right and which left nowhere to put an answer learned on a call. So
 *  the corpus is joined with `corpus-extra.ts` here, once, and everything downstream —
 *  search, the chat, the FAQ, the counts — reads this.
 *
 *  One list on purpose. Two corpora is a coin flip about which copy of an answer somebody
 *  reads, which is the reason `faq.ts` curates by id rather than restating anything. */
import { ARTICLES as GENERATED } from "./corpus";
import { EXTRA_ARTICLES } from "./corpus-extra";

export const ARTICLES = [...GENERATED, ...EXTRA_ARTICLES];
export { CATEGORIES, CORPUS_BUILT, CORPUS_SOURCE, FLOWS } from "./corpus";
