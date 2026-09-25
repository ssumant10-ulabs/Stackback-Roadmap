"use client";
import { DragEvent, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  ASK_REVIEW, ASK_TEAM, BOARD_VIEWS, KIND_LABEL, STAGE_LABEL, VIEW_BY_ID,
  fits, stageForDrop,
  type BoardColumn, type BoardTeam, type BoardView, type CardKind, type ReviewWith, type Stage,
} from "@/lib/board";
import { normPriority, subtreeCounts, waveWord } from "@/lib/derive";
import { TEAM_ORDER, TEAM_VAR } from "@/lib/constants";
import { Assignees } from "../Assignees";
import { CommentChip, DateChip, StatusButton } from "../bits";
import { CommentsThread } from "../CommentsThread";
import { IcChevron, IcPlus, IcTrash } from "../icons";
import { SHOT_MAX_PER_REQUEST, fmtBytes, uploadShot } from "@/lib/shots";


/** The work board. Three lenses over one `stage` field, and every card the team has: the
 *  roadmap tasks and the bugs and requests CS logs, on the same board, because they are all
 *  work moving between the same three teams.
 *
 *  A roadmap task nobody has moved sits where its own status and team put it, derived rather
 *  than written, so every task landed in the right column on the first render with nothing
 *  backfilled. See `defaultNodeStage` in lib/board.ts. */
export function WorkBoard() {
  const s = useStore();
  const view = s.ui.boardView || "pm";
  const def = VIEW_BY_ID[view];
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  /** A handover waiting on its nudge. Nothing is written until it is answered. */
  const [ask, setAsk] = useState<{ id: string; kind: "team" | "review"; col: BoardColumn } | null>(null);

  const all = s.boardCards();
  const filter = s.ui.filter;

  /* The chosen team's roster, or the team of whoever is filtered for, so the people row is
     the people you are actually choosing between rather than everyone in the company. */
  const people = useMemo(() => {
    const team = filter?.type === "team" ? filter.name
      : filter?.type === "person" ? s.helpers.teamOf(filter.name)
      : null;
    return team ? (s.data.roster[team] || []) : [];
  }, [filter, s]);

  /** The team and person filter, which applied to two views and silently did nothing here.
   *  A card matches on who is assigned to it, or on the team it was handed to. */
  const cards = useMemo(() => {
    if (!filter) return all;
    return all.filter((c) => (c.node ? s.nodeInFilter(c.node) : s.featureInFilter(c.feature!, c.team)));
  }, [all, filter, s]);

  const byColumn = useMemo(() => {
    const out: Record<string, BoardCard[]> = {};
    for (const c of def.columns) out[c.key] = cards.filter((x) => fits(c, x.stage, x.team, x.review));
    return out;
  }, [cards, def]);

  const elsewhere = useMemo(() => {
    const shown = new Set(Object.values(byColumn).flat().map((c) => c.id));
    return cards.filter((c) => !shown.has(c.id)).length;
  }, [byColumn, cards]);

  function drop(e: DragEvent, c: BoardColumn) {
    e.preventDefault();
    setOver(null);
    const id = dragId || e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id) return;
    const card = all.find((x) => x.id === id);
    if (!card) return;
    const r = stageForDrop(c, card.team);
    if ("ask" in r) { setAsk({ id, kind: r.ask, col: c }); return; }
    s.setStage(id, r.stage, "review" in r ? { review: r.review ?? null } : undefined);
  }

  function answer(value: string) {
    if (!ask) return;
    if (ask.kind === "review") {
      s.setStage(ask.id, "dev_review", { review: value as ReviewWith });
      setAsk(null);
      return;
    }
    /* The team answer is not always a handover: PM's junction columns ask for it too, then
       resolve to the stage that team's card belongs in. Re-running the same rule with the
       answer in hand keeps one source for where a drop lands. */
    const team = value as BoardTeam;
    const r = stageForDrop(ask.col, team);
    const stage: Stage = "ask" in r ? "pm_handover" : r.stage;
    const review = "ask" in r ? undefined : r.review;
    s.setStage(ask.id, stage, { team, ...(review !== undefined ? { review } : {}) });
    setAsk(null);
  }

  const asking = ask ? all.find((c) => c.id === ask.id) : null;

  return (
    <div className="wb">
      <div className="wb-head">
        <nav className="wb-tabs" role="tablist" aria-label="Board views">
          {BOARD_VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id}
              className={"wb-tab" + (view === v.id ? " on" : "")}
              onClick={() => s.setBoardView(v.id as BoardView)}>
              {v.label}
              <em>{countFor(cards, v.id as BoardView)}</em>
            </button>
          ))}
        </nav>
        {/* The filter, out where the tabs are, because "show me Design's cards" is a thing
            you do constantly and a popover is two clicks and a hunt. Picking a team reveals
            that team's people as a second row: the two are the same question at two scopes. */}
        <div className="wb-filters">
          {TEAM_ORDER.map((t) => {
            const on = filter?.type === "team" && filter.name === t;
            return (
              <button key={t} type="button" className={"wb-fchip t-" + TEAM_VAR[t] + (on ? " on" : "")}
                onClick={() => s.setFilter(on ? null : { type: "team", name: t })}>
                {t === "Engineering" ? "Dev" : t}
              </button>
            );
          })}
          {people.length > 0 && (
            <span className="wb-fpeople">
              {people.map((p) => {
                const on = filter?.type === "person" && filter.name === p;
                return (
                  <button key={p} type="button" className={"wb-fchip person" + (on ? " on" : "")}
                    onClick={() => s.setFilter(on ? null : { type: "person", name: p })}>{p}</button>
                );
              })}
            </span>
          )}
          {filter && <button type="button" className="wb-fclear" onClick={() => s.setFilter(null)}>Clear</button>}
        </div>

        <p className="wb-blurb">
          {def.blurb}
          {elsewhere > 0 && <> <span className="wb-else">{elsewhere} card{elsewhere === 1 ? " sits" : "s sit"} in a stage this view does not carry.</span></>}
          {filter && <> <span className="wb-else">Filtered to {filter.name}.</span></>}
        </p>
      </div>

      {/* An empty column takes a sliver, not a share. Seven equal columns with five of them
          saying "Nothing here" pushed the two that hold the work off the screen. */}
      <div className="wb-cols" style={{
        gridTemplateColumns: def.columns
          .map((c) => ((byColumn[c.key] || []).length ? "minmax(272px, 1fr)" : "minmax(150px, 0.5fr)"))
          .join(" "),
      }}>
        {def.columns.map((c) => {
          const list = byColumn[c.key] || [];
          return (
            <section key={c.key}
              className={"wb-col" + (over === c.key ? " over" : "")}
              onDragOver={(e) => { e.preventDefault(); setOver(c.key); }}
              onDragLeave={() => setOver((k) => (k === c.key ? null : k))}
              onDrop={(e) => drop(e, c)}>
              <header className="wb-colh">
                <b>{c.title}</b><em>{list.length}</em>
              </header>
              {c.hint && <p className="wb-hint">{c.hint}</p>}
              <div className="wb-stack">
                {list.map((card) => (
                  <Card key={card.id} card={card} view={view}
                    dragging={dragId === card.id}
                    onDragStart={(e) => { setDragId(card.id); e.dataTransfer.setData("text/plain", card.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setOver(null); }} />
                ))}
                {!list.length && <p className="wb-empty">Nothing here.</p>}
              </div>
              {/* A column you cannot add to is a column you have to leave to add to. */}
              <AddCard col={c} open={adding === c.key}
                onOpen={() => setAdding(c.key)} onClose={() => setAdding(null)}
                onAsk={(id, kind, column) => setAsk({ id, kind, col: column })} />
            </section>
          );
        })}
      </div>

      {ask && (
        <Nudge spec={ask.kind === "team" ? ASK_TEAM : ASK_REVIEW}
          title={asking?.node?.title || asking?.feature?.title || ""}
          onPick={answer} onClose={() => setAsk(null)} />
      )}
    </div>
  );
}

/** One card on the board, either record. The store derives the stage, team and reviewer, so
 *  a component never has to know which of the two shapes it is holding to place it. */
type BoardCard = ReturnType<ReturnType<typeof useStore>["boardCards"]>[number];

function countFor(cards: BoardCard[], view: BoardView): number {
  const def = VIEW_BY_ID[view];
  return cards.filter((c) => def.columns.some((col) => fits(col, c.stage, c.team, c.review))).length;
}

/** Add a card straight into the column you are looking at. A card born in Bugs is a bug;
 *  anywhere else it is a feature, and the tag is one click away on the card itself. */
function AddCard({ col, open, onOpen, onClose, onAsk }: {
  col: BoardColumn; open: boolean; onOpen: () => void; onClose: () => void;
  onAsk: (id: string, kind: "team" | "review", col: BoardColumn) => void;
}) {
  const s = useStore();
  const [v, setV] = useState("");
  const add = () => {
    const title = v.trim();
    if (!title) return;
    const kind: CardKind = col.key === "bug" ? "bug" : "feature";
    const id = s.addBoardCard(title, kind);
    if (!id) return;
    /* Born outside the intake columns: it belongs where it was added, not back in the pile.
       And a card added straight into the handover column has to answer the same question a
       dragged one does. It did not, so it landed in PM's handover with no team on it, which
       is a card in nobody's column: PM could see it and Design never could. */
    const first = col.accepts[0];
    if (first.stage === "bug" || first.stage === "feature") { setV(""); return; }
    const drop = stageForDrop(col, null);
    if ("ask" in drop) { setV(""); onAsk(id, drop.ask, col); return; }
    s.setStage(id, drop.stage, { team: first.team ?? null, review: drop.review ?? first.review ?? null });
    setV("");
  };
  if (!open) {
    return <button type="button" className="wb-add" onClick={onOpen}><IcPlus /> Add a card</button>;
  }
  return (
    <div className="wb-addbox">
      <input autoFocus type="text" value={v} placeholder="What is it?"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(); }
          if (e.key === "Escape") { setV(""); onClose(); }
        }} />
      <div className="wb-addrow">
        <button type="button" className="btn primary" onClick={add}>Add</button>
        <button type="button" className="btn ghost" onClick={() => { setV(""); onClose(); }}>Done</button>
      </div>
    </div>
  );
}

const KINDS: CardKind[] = ["bug", "feature", "landing"];
const nextPriority = (p: number | null | undefined): 1 | 2 | 3 =>
  (normPriority(p) === 3 ? 1 : normPriority(p) + 1) as 1 | 2 | 3;

function Card({ card, view, dragging, onDragStart, onDragEnd }: {
  card: BoardCard; view: BoardView; dragging: boolean;
  onDragStart: (e: DragEvent) => void; onDragEnd: () => void;
}) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const node = card.node;
  /* The comment chip writes `ui.commentsOpen`, which nothing on this card was reading, so
     clicking it did nothing at all. Either way of opening the card opens the thread. */
  const cmt = node ? s.ui.commentsOpen[node.id] === true : false;
  const body = open || cmt;
  const f = card.feature;
  const title = node ? node.title : f!.title;
  const kind: CardKind = (node?.kind || f?.kind || "feature") as CardKind;
  const counts = node ? subtreeCounts(node) : null;
  const shots = (node?.shots || f?.shots || []) as { id: string; name: string; src: string; bytes: number }[];
  const task = f ? s.featureTask(f) : null;

  return (
    <article className={"wb-card" + (dragging ? " dragging" : "")} draggable
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      data-node-id={node?.id} data-feature-id={f?.id}>
      <div className="wb-cardtop">
        {/* Click to cycle. Three values do not earn a dropdown, and the tag has to be
            changeable from the board or it will only ever say what it was created as. */}
        <button type="button" className={"wb-kind k-" + kind} title="Bug, feature or landing page"
          onClick={() => s.setCardKind(card.id, KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length])}>
          {KIND_LABEL[kind]}
        </button>
        {f?.ref && <span className="wb-ref">{f.ref}</span>}
        {f?.urgency && <span className={"wb-urg u-" + f.urgency.toLowerCase()}>{f.urgency}</span>}
        {node && <span className="wb-status"><StatusButton node={node} size={15} /></span>}
      </div>

      <h4 className="wb-title">{title}</h4>
      {f?.storeName && <p className="wb-store">{f.storeName}</p>}

      {/* The old card's meta row, unchanged: who has it, when it is due, what was said. */}
      {node && (
        <div className="wb-meta">
          <span className="assignees"><Assignees node={node} small /></span>
          <DateChip node={node} variant="icon" />
          <CommentChip node={node} />
        </div>
      )}

      {counts && counts.total > 0 && (
        <div className="wb-prog">
          <div className="wb-progtrack">
            <div className="wb-progfill" style={{ width: Math.round((counts.done / counts.total) * 100) + "%" }} />
          </div>
          <span>{counts.done}/{counts.total}</span>
        </div>
      )}

      <div className="wb-chips">
        {/* Only once it has actually been handed over. At intake the team chip is the
            sheet's owner, not a decision anybody made on this board, and a card reading
            "Dev" while it sits in Feature requests looks like a handover that happened. */}
        {view === "pm" && card.team && card.stage !== "bug" && card.stage !== "feature" && (
          <span className={"wb-team t-" + (card.team === "Design" ? "dsg" : "eng")}>
            {card.team === "Engineering" ? "Dev" : "Design"}
          </span>
        )}
        {card.review && card.stage === "dev_review" && (
          <span className="wb-team t-rev">{card.review === "Design" ? "Design QA" : "PM review"}</span>
        )}
        {/* The horizon. It used to BE the column; on a workflow board it has to be on the
            card or a new task is born without one and nobody can tell Now from Future. */}
        {node && (
          <button type="button" className={"wb-prio p-" + normPriority(node.priority)}
            title="Now, Next or Future" onClick={() => s.setPriority(node.id, nextPriority(node.priority))}>
            {waveWord(normPriority(node.priority))}
          </button>
        )}
        {view === "pm" && <span className="wb-stage">{STAGE_LABEL[card.stage]}</span>}
        {task && <span className="wb-task" title={`Roadmap: ${task.title}`}>{task.title}</span>}
        {shots.length > 0 && <span className="wb-shotn">{shots.length} file{shots.length === 1 ? "" : "s"}</span>}
      </div>

      <button type="button" className={"wb-more" + (body ? " on" : "")}
        onClick={() => { setOpen(!body); if (node && cmt) s.toggleComments(node.id); }}>
        <IcChevron />{body ? "Less" : counts && counts.total ? `Checklist and files (${counts.total})` : "Files and notes"}
      </button>

      {body && (
        <div className="wb-open">
          {node && counts && counts.total > 0 && (
            <ul className="wb-subs">
              {node.children.map((k) => (
                <li key={k.id}>
                  <StatusButton node={k} size={13} />
                  <span className={k.status === "done" ? "done" : ""}>{k.title}</span>
                </li>
              ))}
            </ul>
          )}
          <Files id={card.id} shots={shots} />
          {node && <CommentsThread node={node} />}
        </div>
      )}
    </article>
  );
}

/** Handover files on a card: a screenshot, a spec, a link to a frame. The same uploader and
 *  the same budget the requests module already uses, now reaching roadmap cards too. */
function Files({ id, shots }: { id: string; shots: { id: string; name: string; src: string; bytes: number }[] }) {
  const s = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    for (const file of Array.from(files)) {
      try {
        const { src, bytes } = await uploadShot(file, id);
        const r = s.addShot(id, file.name, src, bytes);
        if (!r.ok) { setErr(r.error || "That file could not be attached."); break; }
      } catch (e) { setErr("Could not attach that file: " + (e as Error).message); break; }
    }
    setBusy(false);
  };

  return (
    <div className="wb-files">
      <div className="wb-filerow">
        {shots.map((sh) => (
          <span className="wb-shot" key={sh.id}>
            <img src={sh.src} alt={sh.name} title={`${sh.name} · ${sh.bytes ? fmtBytes(sh.bytes) : "linked, costs no storage"}`} />
            <button type="button" aria-label={`Remove ${sh.name}`} onClick={() => s.delShot(id, sh.id)}><IcTrash /></button>
          </span>
        ))}
        {shots.length < SHOT_MAX_PER_REQUEST && (
          <button type="button" className="wb-shotadd" disabled={busy} onClick={() => ref.current?.click()}>
            {busy ? "…" : "+ File"}
          </button>
        )}
        <button type="button" className="wb-shotadd" onClick={() => {
          const url = prompt("Paste an image or file link");
          if (!url) return;
          const r = s.addShotLink(id, url);
          if (!r.ok) setErr(r.error || null);
        }}>+ Link</button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      {err && <p className="wb-fileerr">{err}</p>}
    </div>
  );
}

/** The handover nudge. Asked rather than inferred, and nothing is written until it is
 *  answered, so cancelling leaves the card exactly where it was. */
function Nudge({ spec, title, onPick, onClose }: {
  spec: { title: string; body: string; options: { value: string; label: string }[] };
  title: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="wb-scrim" onClick={onClose} role="presentation">
      <div className="wb-nudge" role="dialog" aria-modal="true" aria-label={spec.title}
        onClick={(e) => e.stopPropagation()}>
        <b>{spec.title}</b>
        <p className="wb-nudgeq">{title}</p>
        <p className="wb-nudgeb">{spec.body}</p>
        <div className="wb-nudgerow">
          {spec.options.map((o) => (
            <button key={o.value} type="button" className="btn primary" onClick={() => onPick(o.value)}>{o.label}</button>
          ))}
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
