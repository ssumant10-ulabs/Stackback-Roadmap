import { createClient } from "next-sanity";

/** Sanity holds the query log: the questions merchants and the team raise, and the answers
 *  we write back. The 234 FAQ answers do NOT live here. They are generated from the Help
 *  Centre deliverable, which stays their single source (see lib/help/corpus.ts).
 *
 *  Like Firebase, this is optional. With no project id the Help Centre still runs: the
 *  Queries tab renders an explained empty state instead of failing the page. */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-02-01";

export const sanityEnabled = Boolean(projectId);

export const client = sanityEnabled
  ? createClient({ projectId, dataset, apiVersion, useCdn: true })
  : null;

/** Writes need a token, which never reaches the browser: only the route handler at
 *  app/api/help/queries uses this. A read-only client is what the page gets. */
export function writeClient() {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!sanityEnabled || !token) return null;
  return createClient({ projectId, dataset, apiVersion, useCdn: false, token });
}
