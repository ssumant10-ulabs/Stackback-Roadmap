"use client";
import { useEffect, useRef, useState } from "react";
import { OPENER, reply, transcript, you, type Turn } from "@/lib/help/chat";
import { STATUS_LABEL } from "@/lib/help/types";
import { record } from "@/lib/help/log";
import { CATEGORIES } from "@/lib/help/corpus";

const CAT_NAME = new Map(CATEGORIES.map((c) => [c.id, c.name]));
const SUGGEST = [
  "Why did one checkout create two orders?",
  "Can customers pay COD for a subscription?",
  "What happens to subscriptions if we uninstall?",
  "Can we refund the deliveries a customer has not had yet?",
];

export default function ChatDock({ seed, onSeedUsed, email, internal }: {
  seed: string | null; onSeedUsed: () => void; email?: string | null; internal: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([OPENER]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (seed === null) return;
    setOpen(true);
    if (seed) send(seed);
    else setTimeout(() => inputRef.current?.focus(), 120);
    onSeedUsed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, open]);

  function send(raw: string) {
    const q = raw.trim();
    if (!q) return;
    setTurns((prev) => {
      const lastHelp = [...prev].reverse().find((t) => t.role === "help");
      const answer = reply(q, lastHelp);
      record({ q, hit: answer.art?.id ?? null, kind: answer.kind === "answer" ? "answer" : answer.kind === "choose" ? "choose" : "miss", at: Date.now() }, email);
      return [...prev, you(q), answer];
    });
    setText("");
  }

  const escalate = () => {
    const body = encodeURIComponent(
      "I could not find an answer in the Help Centre.\n\n" + transcript(turns.filter((t) => t.id !== "opener")),
    );
    window.open(`mailto:support@stackback.ai?subject=${encodeURIComponent("Help Centre: question not answered")}&body=${body}`, "_blank");
  };

  const missed = turns.some((t) => t.kind === "miss");

  return (
    <>
      {!open && (
        <button className="hc-fab" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 120); }} aria-label="Open support chat">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-3.6A7.5 7.5 0 0 1 12.5 4.5 7.5 7.5 0 0 1 20 12z" /></svg>
          <span>Ask support</span>
        </button>
      )}

      {open && (
        <section className="hc-chat" aria-label="Support chat">
          <header>
            <div>
              <b>Support</b>
              <span>Answers only from the {internal ? "internal " : ""}Help Centre. No guessing.</span>
            </div>
            <button className="hc-x" onClick={() => setOpen(false)} aria-label="Close chat">
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div className="hc-stream">
            {turns.map((t) => <Bubble key={t.id} t={t} onPick={(q) => send(q)} />)}
            {turns.length === 1 && (
              <div className="hc-sugg">
                {SUGGEST.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {missed && (
            <button className="hc-escalate" onClick={escalate}>
              Send to the team, with everything above
            </button>
          )}

          <form onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
              /* Implicit form submission on Enter is not reliable across every browser and
                 input mode, and Enter is how people send a chat message. Handle it. */
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
              placeholder="Ask it the way you would on a call" aria-label="Your question" />
            <button className="hc-send" disabled={!text.trim()} aria-label="Send">
              <svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function Bubble({ t, onPick }: { t: Turn; onPick: (q: string) => void }) {
  if (t.role === "you") return <p className="hc-you">{t.text}</p>;

  return (
    <div className="hc-help">
      {t.lead && t.kind === "answer" && <p className="hc-lead">{t.lead}</p>}
      {t.text && <p>{t.text}</p>}

      {t.kind === "answer" && t.art && (
        <div className="hc-chatart">
          <p className="hc-chatq">
            {t.art.q}<span className={"hc-pill p-" + t.art.status}>{STATUS_LABEL[t.art.status]}</span>
          </p>
          {t.art.path && <p className="hc-path"><span>Where to look</span>{t.art.path}</p>}
          <div className="hc-prose" dangerouslySetInnerHTML={{ __html: t.art.a }} />
          <a className="hc-chatlink" href={`#/cat/${t.art.cat}#a=${t.art.id}`}>
            Open in {CAT_NAME.get(t.art.cat)}
          </a>
        </div>
      )}

      {t.kind === "choose" && t.options && (
        <div className="hc-choices">
          {t.options.map((o, i) => (
            <button key={o.id} onClick={() => onPick(String(i + 1))}>
              <em>{i + 1}</em>{o.q}
            </button>
          ))}
        </div>
      )}

      {t.kind === "miss" && (
        <>
          {t.lead && <p className="hc-nearcats">Closest topics: {t.lead}</p>}
          {t.options && t.options.length > 0 && (
            <div className="hc-choices">
              <p className="hc-maybe">These were the nearest, and none of them looked close enough to hand you as the answer:</p>
              {t.options.map((o, i) => (
                <button key={o.id} onClick={() => onPick(String(i + 1))}><em>{i + 1}</em>{o.q}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
