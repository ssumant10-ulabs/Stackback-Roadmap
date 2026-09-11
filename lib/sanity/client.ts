import "server-only";
import { createClient } from "next-sanity";

/** Sanity holds the store records, their plan recommendations and the query log. The 236
 *  FAQ answers do NOT live here: they are generated from the Help Centre deliverable,
 *  which stays their single source (lib/help/corpus.ts).
 *
 *  Note the missing NEXT_PUBLIC_ prefix, and the server-only import above. On Sanity's free
 *  tier a dataset is public-read: anyone holding the project id can list every document in
 *  it, which for this app means every store's plan recommendations and every unanswered
 *  query. So the browser is never told the project id. Every read happens on the server and
 *  reaches the page as props.
 *
 *  Be honest about what that is: obscurity, not a boundary. It is the right posture for a
 *  pilot and the wrong one for GA. The fix is a paid plan with a private dataset, at which
 *  point none of this code changes. SANITY.md says so. */
export const projectId = process.env.SANITY_PROJECT_ID || "";
export const dataset = process.env.SANITY_DATASET || "production";
export const apiVersion = process.env.SANITY_API_VERSION || "2026-02-01";

export const sanityEnabled = Boolean(projectId);

export const client = sanityEnabled
  ? createClient({ projectId, dataset, apiVersion, useCdn: true })
  : null;

/** Writes need a token. Only the route handlers use this. */
export function writeClient() {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!sanityEnabled || !token) return null;
  return createClient({ projectId, dataset, apiVersion, useCdn: false, token });
}
