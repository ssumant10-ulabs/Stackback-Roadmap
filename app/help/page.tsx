import HelpApp from "@/components/help/HelpApp";
import { loadHelp } from "@/lib/help/load";

export const metadata = {
  title: "StackBack Help Centre",
  description: "Subscription plans, the questions behind them, and 236 answers to what pilot stores actually asked.",
};

/** The generic Help Centre: no store in the path, so no recommendations. This is the link
 *  to hand somebody who is not a store record yet. Per-store pages live at /help/<slug>. */
export default async function Page() {
  return <HelpApp {...await loadHelp()} />;
}
