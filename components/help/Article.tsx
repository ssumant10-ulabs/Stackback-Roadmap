"use client";
import { useState } from "react";
import { CATEGORIES } from "@/lib/help/corpus";
import { STATUS_LABEL, type HelpArticle } from "@/lib/help/types";
import { related } from "@/lib/help/search";

const CAT_NAME = new Map(CATEGORIES.map((c) => [c.id, c.name]));

export default function Article({ art, open, onToggle, internal, showCat }: {
  art: HelpArticle; open: boolean; onToggle: () => void; internal: boolean; showCat?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const near = open ? related(art) : [];

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#/cat/${art.cat}#a=${art.id}`;
    void navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
  };

  return (
    <article className={"hc-item" + (open ? " open" : "")} id={art.id}>
      <button className="hc-q" onClick={onToggle} aria-expanded={open}>
        <span className="hc-qtext">{art.q}</span>
        <span className={"hc-pill p-" + art.status}>{STATUS_LABEL[art.status]}</span>
        <svg className="hc-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2 L8.5 6 L4 10" /></svg>
      </button>

      {open && (
        <div className="hc-a">
          {art.path && <p className="hc-path"><span>Where to look</span>{art.path}</p>}
          {/* Authored HTML from the versioned deliverable in this repo, not user input. */}
          <div className="hc-prose" dangerouslySetInnerHTML={{ __html: art.a }} />

          <div className="hc-meta">
            <span>Raised by <b>{art.asked}</b> {art.asked === 1 ? "store" : "stores"}</span>
            {showCat && <span>{CAT_NAME.get(art.cat)}</span>}
            <button className="hc-linkbtn" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button>
          </div>

          {near.length > 0 && (
            <div className="hc-near">
              <span>Next question people ask</span>
              <ul>{near.map((r) => (
                <li key={r.id}><a href={`#/cat/${r.cat}#a=${r.id}`}>{r.q}</a></li>
              ))}</ul>
            </div>
          )}

          {internal && <InternalNote art={art} />}
        </div>
      )}
    </article>
  );
}

/** The internal layer on an article. It states support consequence rather than repeating the
 *  badge: a merchant reading "Not supported" is being answered, while the team reading the
 *  same article is looking at a call they will get. */
function InternalNote({ art }: { art: HelpArticle }) {
  const risk = art.status === "n" ? "No answer to give. Expect a follow-up asking for a workaround."
    : art.status === "r" ? "Promised as roadmap. Nothing here tracks who was told, or when."
    : art.status === "x" ? "Costs the merchant something if missed. Say it on the call, do not rely on them reading it."
    : art.status === "m" ? "Blocked on the merchant. This is the class that stalls onboarding."
    : null;
  const load = art.asked >= 15 ? "high" : art.asked >= 6 ? "steady" : "occasional";
  return (
    <div className="hc-internal">
      <b>Internal</b>
      <span>{art.asked} stores raised it · {load} support load</span>
      {risk && <span className="hc-risk">{risk}</span>}
    </div>
  );
}
