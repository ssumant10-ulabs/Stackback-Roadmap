import PilotsApp from "@/components/PilotsApp";
import { AuthGate } from "@/components/AuthGate";
import { loadHelp } from "@/lib/help/load";

/** The Help Centre is a tab in here, so its data is loaded on the server alongside the
 *  page rather than fetched from the client. Sanity reads stay server-side, which is the
 *  whole reason the project id is not public. */
export default async function Page() {
  const { store, answered, openQueries, stores, sanityConnected } = await loadHelp();
  return (
    <AuthGate>
      <PilotsApp help={{ store, answered, openQueries, stores, sanityConnected }} />
    </AuthGate>
  );
}
