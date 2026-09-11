import { cookies } from "next/headers";
import HelpApp from "@/components/help/HelpApp";
import { sanityEnabled } from "@/lib/sanity/client";
import { fetchAnswered } from "@/lib/sanity/queries";

export const metadata = {
  title: "StackBack Help Centre",
  description: "Answers to what pilot stores actually asked: plans, bundles, orders, payments and the customer portal.",
};

/** Deliberately not wrapped in AuthGate. The merchant-facing half is public; signing in
 *  with a ULABS account unlocks the internal layer from inside the page. */
export default async function Page() {
  const answered = await fetchAnswered();
  /* Theme comes from a cookie rather than localStorage so the server renders the right
     palette on the first byte: no flash of the wrong theme, and no hydration mismatch from
     a script rewriting the document before React runs. Light is the default here, unlike
     the roadmap app which follows the system: somebody opening a help page wants the
     document, not the console. */
  const theme = (await cookies()).get("sb-help-theme")?.value === "dark" ? "dark" : "light";
  return <HelpApp answered={answered} sanityConnected={sanityEnabled} theme={theme} />;
}
