import HelpApp from "@/components/help/HelpApp";
import { loadHelp } from "@/lib/help/load";

export const metadata = {
  title: "StackBack Help Centre",
  description: "Subscription plans, the questions behind them, and 236 answers to what pilot stores actually asked.",
};

/** The generic Help Centre: no store in the path, so no recommendations. This is the link
 *  to hand somebody who is not a store record yet. Per-store pages live at /help/<slug>.
 *
 *  `?public=1` is the merchant's version of the same page: Internal, Insights and the sign
 *  in are gone rather than gated, so there is nothing on it that is not for them. The team
 *  copies that link from the Help Centre's own header. */
export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const flag = Array.isArray(sp.public) ? sp.public[0] : sp.public;
  return <HelpApp {...await loadHelp()} publicView={flag === "1" || flag === "true" || flag === ""} />;
}
