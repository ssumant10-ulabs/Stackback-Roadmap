"use client";
import { useStore } from "@/lib/store";

/** A refused write was a console warning nobody was reading, so the app looked like it had
 *  saved right up to the reload that threw the work away. This is the tell. The edit is not
 *  lost while it shows: it is mirrored in this browser and recovered on the next load. */
export function SaveState() {
  const s = useStore();
  if (!s.saveFailed) return null;
  return (
    <span
      className="save-warn"
      role="status"
      title="The last change could not be written to the shared backend. It is held in this browser and recovered on the next load. Keep this tab open and check your connection or sign-in."
    >
      Not saved
    </span>
  );
}
