import { groq } from "next-sanity";
import { client } from "./client";

export interface LoggedQuery {
  _id: string;
  question: string;
  /** Which part of the subscription setup: frequency, discount, products and so on. */
  topic: string | null;
  answer: unknown[] | null;
  raisedAt: string;
  /** How many clients have raised it. The team increments it as it recurs. */
  raisedCount: number | null;
  source: "merchant" | "team" | null;
}

/** Only answered queries are public. One sitting unanswered is an internal to-do, not
 *  content, and publishing it would tell a client we have their question and no reply. */
export const ANSWERED = groq`
  *[_type == "merchantQuery" && status == "answered" && defined(answer)]
    | order(coalesce(raisedCount, 1) desc, raisedAt desc) {
      _id, question, topic, answer, raisedAt, raisedCount, source
    }
`;

/** Everything, for the internal view: what is waiting on an answer, and for how long. */
export const ALL_QUERIES = groq`
  *[_type == "merchantQuery"] | order(raisedAt desc) {
    _id, question, topic, answer, raisedAt, raisedCount, source, status, askedBy
  }
`;

/** The page itself is dynamic, because the theme comes from a cookie and that has to be
 *  read per request. This fetch must not become per request with it: an answered query is
 *  content, and a minute stale is fine where a Sanity round trip on every hit is not. */
export async function fetchAnswered(): Promise<LoggedQuery[]> {
  if (!client) return [];
  try {
    return await client.fetch<LoggedQuery[]>(ANSWERED, {}, {
      next: { revalidate: 60, tags: ["help-queries"] },
    });
  } catch { return []; }
}
