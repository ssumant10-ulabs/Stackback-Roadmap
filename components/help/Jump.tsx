"use client";
import { destinationsFor } from "@/lib/help/goto";
import type { HelpArticle } from "@/lib/help/types";

/** The way out of an answer, into the thing the answer is about.
 *
 *  Half the corpus ends in "so set it up like this", and the thing to set it up in is
 *  already here: the widget and the order flow in Simulate, the plans in a form, what other
 *  stores run in a drawer beside it, thirteen of the steps recorded. Without this a merchant
 *  reading about the widget had no way through to the widget and asked us instead, which is
 *  the support load the corpus exists to remove.
 *
 *  A hash, not a link: these are routes inside this page, so the reader keeps their place in
 *  the list and the back button works. */
export default function Jump({ art, also }: {
  art: Pick<HelpArticle, "id" | "cat" | "q">;
  /** Destinations the caller has already drawn, so the same one is not offered twice. */
  also?: string[];
}) {
  const to = destinationsFor(art).filter((d) => !(also || []).includes(d.hash));
  if (!to.length) return null;
  return (
    <div className="hc-jump">
      {to.map((d) => (
        <button key={d.hash} type="button" className="hc-jumpbtn"
          onClick={() => { window.location.hash = d.hash; }}>
          {d.label}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
        </button>
      ))}
    </div>
  );
}
