"use client";
import { useState } from "react";
import { FAQ_SECTIONS, FAQ_COUNT, resolveFaq } from "@/lib/help/faq";
import { STATUS_LABEL, type HelpArticle } from "@/lib/help/types";

/** The front door. The questions that actually come up, split by whether the store is live.
 *
 *  Every answer here is an article from the same corpus the Help Centre searches, resolved by
 *  id. Nothing is authored twice, so correcting an answer corrects it in both places. */
export default function Faq({ onOpen }: {
  /** Open the full article, so the FAQ is a way in rather than a dead end. */
  onOpen?: (a: HelpArticle) => void;
}) {
  const [phase, setPhase] = useState<"pre" | "post">("pre");
  const [open, setOpen] = useState<string | null>(null);
  const section = FAQ_SECTIONS.find((s) => s.phase === phase) ?? FAQ_SECTIONS[0];
  const { groups } = resolveFaq(section);

  return (
    <section className="hc-faq">
      <p className="hc-eyebrow">Frequently asked</p>
      <h1 className="hc-h1">The {FAQ_COUNT} questions that come up</h1>
      <p className="hc-blurb">
        Mined from the pilot conversations and the calls, and split by where you are. Every
        answer is the same one the Help Centre holds, so there is one version of it.
      </p>

      <div className="hc-faqphase" role="tablist" aria-label="Which stage">
        {FAQ_SECTIONS.map((s) => (
          <button key={s.phase} role="tab" aria-selected={phase === s.phase}
            className={"hc-faqphaseb" + (phase === s.phase ? " on" : "")}
            onClick={() => { setPhase(s.phase); setOpen(null); }}>
            <b>{s.title}</b>
            <em>{s.groups.reduce((n, g) => n + g.ids.length, 0)} questions</em>
          </button>
        ))}
      </div>

      <p className="hc-note hc-faqblurb">{section.blurb}</p>

      {groups.map((g) => (
        <div key={g.title} className="hc-faqgroup">
          <h2 className="hc-h3">{g.title}</h2>
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
                      {onOpen && (
                        <button type="button" className="hc-btn ghost hc-faqfull"
                          onClick={() => onOpen(a)}>Open the full answer</button>
                      )}
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
