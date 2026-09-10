import { groq } from "next-sanity";
import { client } from "./client";

export interface LoggedQuery {
  _id: string;
  question: string;
  /** Matches a Help Centre category id, so a query can point at the topic it belongs to. */
  topic: string | null;
  answer: unknown[] | null;
  raisedAt: string;
  /** How many times this has come up. The team increments it as it recurs. */
  raisedCount: number | null;
  source: "merchant" | "team" | null;
}

/** Only answered queries are public. A question sitting unanswered is an internal to-do,
 *  not content, and publishing it would tell a merchant we have their problem and no reply. */
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

export async function fetchAnswered(): Promise<LoggedQuery[]> {
  if (!client) return [];
  try { return await client.fetch<LoggedQuery[]>(ANSWERED); }
  catch { return []; }
}
