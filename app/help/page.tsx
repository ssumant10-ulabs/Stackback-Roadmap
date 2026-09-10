import HelpApp from "@/components/help/HelpApp";
import { sanityEnabled } from "@/lib/sanity/client";
import { fetchAnswered } from "@/lib/sanity/queries";

export const metadata = {
  title: "StackBack Help Centre",
  description: "Answers to what pilot stores actually asked: plans, bundles, orders, payments and the customer portal.",
};

/** Answered queries are read on the server so the merchant-facing page stays static and
 *  fast, and refreshed on a schedule rather than on every hit. A new answer is content,
 *  not a live feed: a minute late is fine, a slow page is not. */
export const revalidate = 60;

/** Deliberately not wrapped in AuthGate. The merchant-facing half is public; signing in
 *  with a ULABS account unlocks the internal layer from inside the page. */
export default async function Page() {
  const answered = await fetchAnswered();
  return <HelpApp answered={answered} sanityConnected={sanityEnabled} />;
}
