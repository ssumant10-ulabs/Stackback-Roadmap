"use client";
import { useState } from "react";
import { FAQ_SECTIONS, FAQ_COUNT, FAQ_JUMPS, FAQ_MEDIA, resolveFaq } from "@/lib/help/faq";
import { ALL_CLIPS } from "@/lib/help/videos";
import { STATUS_LABEL, type HelpArticle } from "@/lib/help/types";

/** The front door. The questions that actually come up, split by whether the store is live.
 *
 *  Every answer here is an article from the same corpus the Help Centre searches, resolved by
 *  id. Nothing is authored twice, so correcting an answer corrects it in both places. */
export default function Faq({ onOpen, onJump }: {
  /** Open the full article, so the FAQ is a way in rather than a dead end. */
  onOpen?: (a: HelpArticle) => void;
  /** Some answers are really a screen in this app. A widget question is answered better by
   *  the widget than by another paragraph about it. */
  onJump?: (step: 2 | 3) => void;
}) {
  const [phase, setPhase] = useState<"pre" | "post">("pre");
  const [open, setOpen] = useState<string | null>(null);
  const section = FAQ_SECTIONS.find((s) => s.phase === phase) ?? FAQ_SECTIONS[0];
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { groups } = resolveFaq(section);

  return (
    <section className="hc-faq">
      <h1 className="hc-h1">The questions that come up</h1>
      <p className="hc-blurb">
        Mined from the pilot conversations and the calls. Every answer is the same one the
        Help Centre holds, so there is one version of it.
      </p>

      {/* A filter, at a filter's weight. It was two cards the width of the column, ~80px of
          vertical each, carrying three words and a count; and the titles rendered white on
          white, so all a reader saw was "12 questions" twice. */}
      <div className="hc-parts hc-faqphase" role="tablist" aria-label="Which stage">
        {FAQ_SECTIONS.map((sec) => (
          <button key={sec.phase} role="tab" aria-selected={phase === sec.phase}
            className={"hc-part" + (phase === sec.phase ? " on" : "")}
            onClick={() => { setPhase(sec.phase); setOpen(null); }}>
            {sec.title}<em>{sec.groups.reduce((n, g) => n + g.ids.length, 0)}</em>
          </button>
        ))}
      </div>

      <p className="hc-note hc-faqblurb">{section.blurb}</p>

      {groups.map((g) => (
        <div key={g.title} id={`faq-${slug(g.title)}`} className="hc-faqgroup">
          <h2 className="hc-faqgrouph">{g.title}<em>{g.articles.length}</em></h2>
          <ul className="hc-faqlist">
            {g.articles.map((a) => {
              const on = open === a.id;
              return (
                <li key={a.id} className={on ? "on" : ""}>
                  <button type="button" className="hc-faqq" aria-expanded={on}
                    onClick={() => setOpen(on ? null : a.id)}>
                    <span>{a.q}</span>
                    <i className={"hc-st s-" + a.status}>{STATUS_LABEL[a.status]}</i>
                  </button>
                  {on && (
                    <div className="hc-faqa">
                      <div className="hc-prose" dangerouslySetInnerHTML={{ __html: a.a }} />
                      {a.path && <p className="hc-faqpath">{a.path}</p>}
                      <div className="hc-faqjump">
                        {(() => {
                          const m = FAQ_MEDIA[a.id];
                          const clip = m?.clip ? ALL_CLIPS.find((c) => c.id === m.clip) : undefined;
                          if (!clip) return null;
                          return clip.pending
                            ? <span className="hc-faqpending">Walkthrough pending: {clip.title}</span>
                            : <a className="hc-btn ghost" href={`/watch/${clip.id}`} target="_blank" rel="noreferrer">Watch the walkthrough</a>;
                        })()}
                        {onJump && FAQ_JUMPS[a.id] && (
                          <button type="button" className="hc-btn"
                            onClick={() => onJump(FAQ_JUMPS[a.id].step)}>{FAQ_JUMPS[a.id].label}</button>
                        )}
                        {onOpen && (
                          <button type="button" className="hc-btn ghost"
                            onClick={() => onOpen(a)}>Open the full answer</button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
