import { notFound } from "next/navigation";
import HelpApp from "@/components/help/HelpApp";
import { loadHelp } from "@/lib/help/load";
import { sanityEnabled } from "@/lib/sanity/client";

/** One store's page. The slug is random rather than their name, because on a free Sanity
 *  plan the dataset is public-read and a guessable slug would be the only thing between two
 *  clients' pricing. See SANITY.md. */
export default async function Page({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const data = await loadHelp(slug);
  // A wrong slug is a wrong slug, not an empty page that looks like we forgot their plans.
  if (sanityEnabled && !data.store) notFound();
  return <HelpApp {...data} />;
}

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }) {
  const { store } = await params;
  return { title: `StackBack plans`, description: `Subscription plans and setup for ${store}.` };
}
