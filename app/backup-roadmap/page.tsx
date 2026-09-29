import LegacyRoadmapApp from "@/components/legacy/RoadmapApp";
import { AuthGate } from "@/components/AuthGate";

/** The roadmap screen as it was before it became one work board.
 *
 *  Unlisted rather than secret: it is behind the same ULABS sign-in as everything else, and
 *  it is in no menu, so it is reachable by knowing the URL. `noindex` because an unlinked
 *  page is still a page a crawler can find through a shared link.
 *
 *  It reads the same store as the live board, so it shows current data in the old shape —
 *  not an archive. Editing here edits the same cards. */
export const metadata = {
  title: "StackBack Roadmap — the old screen",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <AuthGate>
      <LegacyRoadmapApp />
    </AuthGate>
  );
}
