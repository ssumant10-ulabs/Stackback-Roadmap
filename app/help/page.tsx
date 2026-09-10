import HelpApp from "@/components/help/HelpApp";

export const metadata = {
  title: "StackBack Help Centre",
  description: "Answers to what pilot stores actually asked: plans, bundles, orders, payments and the customer portal.",
};

/** Deliberately not wrapped in AuthGate. The merchant-facing half is public; signing in with
 *  a ULABS account unlocks the internal layer from inside the page. */
export default function Page() {
  return <HelpApp />;
}
