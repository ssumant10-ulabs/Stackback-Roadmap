"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { ALL_KINDS, KIND_LABEL, STAGE_LABEL, type CardKind } from "@/lib/board";
import type { BoardCard } from "./WorkBoard";
import { ERROR_TYPES, SURFACES, qaTitle, subModulesFor, surfaceZone } from "@/lib/qa-labels";
import { cardPriority, subtreeCounts, waveWord } from "@/lib/derive";
import { PRIORITIES } from "@/lib/constants";
import { Assignees } from "../Assignees";
import { DateChip, StatusButton } from "../bits";
import { CommentsThread } from "../CommentsThread";
import { IcClose, IcPlus, IcTrash } from "../icons";
import type { Node } from "@/lib/types";

/** Everything about one card, in a panel of its own.
 *
 *  The card on the board is now the title, the horizon and who has it, because a column of
 *  cards is a list you scan rather than a list you read: nine chips and a fold on every one
 *  made forty cards unreadable and hid the three facts you actually scan for. Everything
 *  else — what it is, which surface, its subtasks, links, dates and the thread — is here,
 *  one click away, with room to edit rather than only to look. */
/** What each option means, for the tooltip on it and the line under the field. A dropdown of
 *  five words nobody has defined is five guesses. */
const HORIZON_NOTE: Record<1 | 2 | 3, string> = {
  1: "This sprint. Unclaimed cards set to Now are handed to PM.",
  2: "Queued behind the current sprint. The default for anything untagged.",
  3: "Parked. A Future card sits in the backlog and off every team board.",
};

const KIND_NOTE: Record<CardKind, string> = {
  bug: "Something broken that a merchant or we reported",
  feature: "Something asked for that does not exist yet",
  module: "A thing we are building, rather than a thing somebody reported",
  template: "A reusable page or layout, including landing pages",
  landing: "A landing page. Folded into Template; kept so old cards still read.",
};

export default function CardDetail({ card, onClose }: { card: BoardCard; onClose: () => void }) {
  const s = useStore();
  const f = card.feature;
  const node: Node = card.node ?? (f as unknown as Node);
  const rec = (card.node ?? f) as Record<string, unknown> | undefined;
  const kind: CardKind = (card.node?.kind || f?.kind || "feature") as CardKind;
  const counts = subtreeCounts(node);
  const shots = (card.node?.shots || f?.shots || []) as { id: string; name: string; src: string; bytes: number }[];
  const task = f ? s.featureTask(f) : null;

  const [title, setTitle] = useState(node.title);
  useEffect(() => setTitle(node.title), [node.title]);
  const [desc, setDesc] = useState(node.desc || "");
  useEffect(() => setDesc(node.desc || ""), [node.desc]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const str = (k: string) => (typeof rec?.[k] === "string" ? (rec[k] as string) : "") || "";
  const commit = () => { if (title.trim() && title !== node.title) s.rename(card.id, title); };

  return (
    <div className="wb-detwrap" role="dialog" aria-modal="true" aria-label={node.title}>
      <div className="wb-detscrim" onClick={onClose} role="presentation" />
      <aside className="wb-det">
        <header className="wb-deth">
          <span className="wb-detmeta">
            {f?.ref && <b>{f.ref}</b>}
            <span>{STAGE_LABEL[card.stage as keyof typeof STAGE_LABEL]}</span>
            {card.teams.length > 0 && <span>{card.teams.map((t: string) => (t === "Engineering" ? "Dev" : t)).join(" · ")}</span>}
          </span>
          <button type="button" onClick={onClose} aria-label="Close"><IcClose /></button>
        </header>

        <div className="wb-detbody">
          {/* The title is editable in place. It was read-only on the board and on this panel,
              so a typo in a card title could only be fixed by deleting the card. */}
          {/* Grows with its content. At a fixed two rows a long title scrolled inside the
              box and read as cut off, which is what it looked like. */}
          <textarea className="wb-dettitle" value={title}
            rows={Math.max(2, Math.ceil(title.length / 42))}
            aria-label="Card title"
            onChange={(e) => setTitle(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} />

          {/* The brief, under the title. A title has to stay short enough to scan a column
              by, which leaves nowhere to say what the card actually means — so it ended up
              in a comment, or in WhatsApp, or nowhere. Saves on blur like the title does. */}
          {/* Sized by the lines it will actually wrap to, counted per paragraph. Dividing the
              whole string by a width ignores the newlines in it, which is how a brief with a
              blank line in the middle rendered with its last sentence cut off. */}
          <textarea className="wb-detdesc" value={desc} rows={descRows(desc)}
            aria-label="Description"
            placeholder="What is this, and what does done look like? Anyone picking the card up reads this first."
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => s.setDesc(card.id, desc)} />

          <div className="wb-detgrid">
            <Field label="Horizon" hint={HORIZON_NOTE[cardPriority(card.node ?? card.feature)]}>
              <select value={cardPriority(card.node ?? card.feature)}
                onChange={(e) => s.setPriority(card.id, Number(e.target.value) as 1 | 2 | 3)}>
                {PRIORITIES.map((w) => (
                  <option key={w.p} value={w.p} title={HORIZON_NOTE[w.p as 1 | 2 | 3]}>{w.word}</option>
                ))}
              </select>
            </Field>
            <Field label="Type" hint={KIND_NOTE[kind]}>
              {/* "Landing page" came off: it is a template with a narrower name, and two
                  words for one thing is how a pile stops being searchable. */}
              <select value={kind} onChange={(e) => s.setCardKind(card.id, e.target.value as CardKind)}>
                {ALL_KINDS.filter((k) => k !== "landing").map((k) => (
                  <option key={k} value={k} title={KIND_NOTE[k]}>{KIND_LABEL[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Surface" hint={SURFACES.find((x) => x.id === str("surface"))
              ? `${surfaceZone(str("surface"))} \u00b7 where the issue lives`
              : "Which module or surface the issue lives in. The first of the two QA labels."}>
              <select value={str("surface")} onChange={(e) => s.setQaLabel(card.id, "surface", e.target.value)}>
                <option value="">Not set</option>
                {["Customer Zone", "Merchant Zone"].map((zone) => (
                  <optgroup key={zone} label={zone}>
                    {SURFACES.filter((x) => x.zone === zone).map((x) => (
                      <option key={x.id} value={x.id} title={`${x.zone} \u00b7 ${x.label}`}>{x.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            {/* The second level of the module map, which the app never carried: a card could
                only say "Portal Surface", which is most of the product. Shown once a surface
                is picked, and only where that surface has a real choice to make. */}
            {subModulesFor(str("surface")).length > 1 && (
              <Field label="Sub-module" hint="Which part of that surface. Optional.">
                <select value={str("subModule")} onChange={(e) => s.setQaLabel(card.id, "subModule", e.target.value)}>
                  <option value="">Not set</option>
                  {subModulesFor(str("surface")).map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Error type" hint={ERROR_TYPES.find((x) => x.id === str("errorType"))?.note
              ?? "What kind of failure this is. The second of the two QA labels."}>
              <select value={str("errorType")} onChange={(e) => s.setQaLabel(card.id, "errorType", e.target.value)}>
                <option value="">Not set</option>
                {ERROR_TYPES.map((x) => <option key={x.id} value={x.id} title={x.note}>{x.label}</option>)}
              </select>
            </Field>
          </div>

          {/* The title format, offered rather than enforced: a dev should know the module
              and the store from the title alone. */}
          {(str("surface") || str("errorType")) && (
            <button type="button" className="wb-detfmt"
              onClick={() => { const t = qaTitle(node.title, str("errorType"), str("surface"), f?.storeName); setTitle(t); s.rename(card.id, t); }}>
              Rename to the QA format: <b>{qaTitle(node.title, str("errorType"), str("surface"), f?.storeName)}</b>
            </button>
          )}

          <div className="wb-detrow">
            <span className="wb-detlbl">Who has it</span>
            <span className="assignees"><Assignees node={node} small /></span>
            <DateChip node={node} variant="icon" />
          </div>

          {task && <p className="wb-dettask">Roadmap: <b>{task.title}</b></p>}

          <section className="wb-detsec">
            <h4>Subtasks {counts.total > 0 && <em>{counts.done} of {counts.total} done</em>}</h4>
            {counts.total > 0 && (
              <ul className="wb-detsubs">
                {node.children.map((k) => <Sub key={k.id} sub={k} />)}
              </ul>
            )}
            <AddSub parentId={node.id} />
          </section>

          <section className="wb-detsec">
            <h4>Links</h4>
            <Links id={card.id} shots={shots} />
          </section>

          <section className="wb-detsec">
            <h4>Comments</h4>
            <CommentsThread node={node} />
          </section>

          <button type="button" className="wb-del"
            onClick={() => {
              const n = counts.total;
              if (n && !confirm(`Delete "${node.title}" and its ${n} subtask${n === 1 ? "" : "s"}?`)) return;
              if (!n && !confirm(`Delete "${node.title}"?`)) return;
              s.delCard(card.id);
              onClose();
            }}>
            <IcTrash /> Delete this card
          </button>
        </div>
      </aside>
    </div>
  );
}

const descRows = (text: string) =>
  Math.max(3, Math.min(18,
    text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 54)), 0) + 1));

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="wb-detfield">
      <span>{label}</span>
      {children}
      {hint && <em>{hint}</em>}
    </label>
  );
}

/** One subtask, editable and removable in place.
 *
 *  It was a checkbox and a line of text, so a subtask with a typo in it was permanent and a
 *  subtask added by mistake stayed on the card forever. */
function Sub({ sub }: { sub: Node }) {
  const s = useStore();
  const [v, setV] = useState(sub.title);
  useEffect(() => setV(sub.title), [sub.title]);
  return (
    <li>
      <StatusButton node={sub} size={14} />
      <input type="text" value={v} aria-label="Subtask"
        className={sub.status === "done" ? "done" : ""}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v.trim() && v !== sub.title) s.rename(sub.id, v); else setV(sub.title); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      {/* A subtask carries its own owners. When a card has two teams on it, the split is at
          this level — "design the page" is Design's and "build it" is Dev's — and assigning
          only the parent leaves both teams looking at the whole card. */}
      <span className="assignees wb-subassign"><Assignees node={sub} small /></span>
      <DateChip node={sub} variant="icon" />
      <button type="button" aria-label={`Remove ${sub.title}`} className="wb-subdel"
        onClick={() => { if (confirm(`Remove "${sub.title}"?`)) s.del(sub.id); }}><IcTrash /></button>
    </li>
  );
}

function AddSub({ parentId }: { parentId: string }) {
  const s = useStore();
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const add = () => { const t = v.trim(); if (!t) return; const id = s.addChild(parentId, t); if (id) { setV(""); ref.current?.focus(); } };
  return (
    <div className="wb-detadd">
      <input ref={ref} type="text" value={v} placeholder="Add a subtask"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" onClick={add}><IcPlus /> Add</button>
    </div>
  );
}

/** Handover links. Links only, never uploads: a data URL in this browser's storage is a copy
 *  nobody else on the team can open, on a budget that runs out. */
function Links({ id, shots }: { id: string; shots: { id: string; name: string; src: string; bytes: number }[] }) {
  const s = useStore();
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const u = url.trim();
    if (!u) return;
    const r = s.addShotLink(id, u);
    if (r.ok) { setUrl(""); setErr(null); } else setErr(r.error ?? "That link could not be added.");
  };
  return (
    <>
      {shots.length > 0 && (
        <ul className="wb-detlinks">
          {shots.map((sh) => (
            <li key={sh.id}>
              <a href={sh.src} target="_blank" rel="noreferrer">{sh.name}</a>
              <button type="button" aria-label={`Remove ${sh.name}`} onClick={() => s.delShot(id, sh.id)}><IcTrash /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="wb-detadd">
        <input type="text" value={url} placeholder="Paste a Figma, spec or screenshot link"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add}><IcPlus /> Add</button>
      </div>
      {err && <p className="wb-deterr">{err}</p>}
    </>
  );
}
