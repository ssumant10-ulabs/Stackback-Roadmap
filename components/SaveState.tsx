"use client";
import { useStore } from "@/lib/store";

const COPY = {
  saving: "Saving",
  saved: "Saved",
  failed: "Not saved",
} as const;

const TIP = {
  saving: "Writing this change to the shared copy. Keep the tab open until it clears.",
  saved: "This change is in the shared copy. Everyone else sees it.",
  failed:
    "This change could not be written to the shared copy. It is held in this browser and recovered on the next load. Check your connection and that you are still signed in.",
} as const;

/** Says where the shared copy stands. A write that failed quietly read exactly like one that
 *  worked, right up to the reload that threw the work away, and a write still in flight read
 *  the same as both. Showing only the failure would leave the ordinary case unanswered, so
 *  all three states are here and the good one fades once it has been seen. */
export function SaveState() {
  const s = useStore();
  const state = s.saveState;
  if (state === "idle") return null;
  return (
    <span
      className={`save-chip is-${state}`}
      /* Only the failure is announced. Narrating every autosave would make the page
         unusable with a screen reader on, which is worse than saying nothing. */
      role={state === "failed" ? "status" : undefined}
      aria-hidden={state === "failed" ? undefined : true}
      title={TIP[state]}
    >
      {COPY[state]}
    </span>
  );
}
