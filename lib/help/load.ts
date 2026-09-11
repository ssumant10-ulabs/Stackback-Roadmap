import "server-only";
import { cookies } from "next/headers";
import { sanityEnabled } from "@/lib/sanity/client";
import { fetchAnswered, fetchOpenQueries, fetchStore, fetchStores } from "@/lib/sanity/queries";

/** Everything /help needs, with or without a store in the path. Shared by both routes so
 *  the two cannot drift: the only difference between them is whether a slug was given. */
export async function loadHelp(slug?: string) {
  const store = slug ? await fetchStore(slug) : null;
  const [answered, openQueries, stores] = await Promise.all([
    fetchAnswered(store?._id ?? null),
    store ? fetchOpenQueries(store._id) : Promise.resolve([]),
    fetchStores(),
  ]);
  /* Theme comes from a cookie rather than localStorage so the server renders the right
     palette on the first byte: no flash of the wrong theme, and no hydration mismatch from
     a script rewriting the document before React runs. Light is the default here, unlike
     the roadmap app which follows the system: somebody opening a help page wants the
     document, not the console. */
  const theme = (await cookies()).get("sb-help-theme")?.value === "dark" ? "dark" : "light";
  return { store, answered, openQueries, stores, theme: theme as "light" | "dark", sanityConnected: sanityEnabled };
}
