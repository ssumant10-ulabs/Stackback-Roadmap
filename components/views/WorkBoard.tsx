"use client";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  ALL_KINDS, ASK_REVIEW, ASK_TEAM, BOARD_VIEWS, KIND_LABEL, MOVE_TO, STAGE_LABEL, VIEW_BY_ID,
  fits, stageForDrop,
  type BoardColumn, type BoardTeam, type BoardView, type CardKind, type ReviewWith, type Stage,
} from "@/lib/board";
import { normPriority, subtreeCounts, waveWord } from "@/lib/derive";
import type { Node } from "@/lib/types";
import { Assignees } from "../Assignees";
import { CommentChip, DateChip, StatusButton } from "../bits";
import { CommentsThread } from "../CommentsThread";
import { IcChevron, IcFilter, IcPlus, IcTrash } from "../icons";
import { useAppUi } from "../appui";
import { SHOT_MAX_PER_REQUEST } from "@/lib/shots";


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
  /** The last column is the end of the line, so it is folded by default: on the seven-column
   *  design board it was taking a seventh of the width to say "Dev approved". */
  const [tailOpen, setTailOpen] = useState(false);
  const filterBtn = useRef<HTMLButtonElement>(null);
  const ui = useAppUi();
  /** A handover waiting on its nudge. Nothing is written until it is answered. */
  const [ask, setAsk] = useState<{ id: string; kind: "team" | "review"; col: BoardColumn } | null>(null);

  const all = s.boardCards();
  const filter = s.ui.filter;

  /** The team and person filter, which applied to two views and silently did nothing here.
   *  A card matches on who is assigned to it, or on the team it was handed to. */
  /** Two filters, because "Design's cards" and "every template" are different questions and
   *  one control cannot answer both. The team one is the popover; this one is the row. */
  const [kindFilter, setKindFilter] = useState<CardKind | null>(null);
  const [kindOpen, setKindOpen] = useState(false);
  const kindWrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!kindOpen) return;
    const away = (e: MouseEvent) => {
      if (!kindWrap.current?.contains(e.target as HTMLElement)) setKindOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [kindOpen]);

  const cards = useMemo(() => {
    let out = all;
    if (filter) out = out.filter((c) => (c.node ? s.nodeInFilter(c.node) : s.featureInFilter(c.feature!, c.team)));
    if (kindFilter) out = out.filter((c) => kindOf(c) === kindFilter);
    return out;
  }, [all, filter, kindFilter, s]);

  const byColumn = useMemo(() => columnsFor(cards, view), [cards, view]);

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
    s.setStage(id, r.stage, {
      ...("review" in r ? { review: r.review ?? null } : {}),
      ...("team" in r ? { team: r.team ?? null } : {}),
    });
  }

  /** The move menu and a drop are the same action, so they run the same rule. */
  function moveTo(id: string, c: BoardColumn) {
    const card = all.find((x) => x.id === id);
    if (!card) return;
    const r = stageForDrop(c, card.team);
    if ("ask" in r) { setAsk({ id, kind: r.ask, col: c }); return; }
    s.setStage(id, r.stage, {
      ...("review" in r ? { review: r.review ?? null } : {}),
      ...("team" in r ? { team: r.team ?? null } : {}),
    });
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
  const isTail = (i: number) => def.columns.length > 3 && i === def.columns.length - 1;

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
        {/* Filter and Add task live here, on the tabs row, rather than in a strip of their
            own above it. Three stacked rows of chrome before the first column. */}
        {/* Fixed to the right of the row, not pushed there by the tabs: the tab strip is a
            different width on every lens, so `margin-left: auto` moved Filter and Add task
            every time you switched. */}
        <span className="wb-actions">
          {/* Two filters, two questions. "Who" is the team and person popover; "What" is the
              kind of work. They were a popover and a loose row of capsules, which read as one
              control and a decoration. */}
          <span className="wb-kfwrap" ref={kindWrap}>
            <button type="button" className={"btn ghost" + (kindFilter ? " active-filter" : "")}
              aria-haspopup="true" aria-expanded={kindOpen}
              onClick={() => setKindOpen((v) => !v)}>
              <IcFilter /><span>{kindFilter ? KIND_LABEL[kindFilter] : "Work"}</span>
            </button>
            {kindOpen && (
              <span className="popover filter-pop open wb-kfmenu">
                <h4>Filter work</h4>
                <div className="fp-chips">
                  {ALL_KINDS.map((k) => (
                    <button key={k} type="button" className={"chip" + (kindFilter === k ? " active" : "")}
                      onClick={() => { setKindFilter(kindFilter === k ? null : k); setKindOpen(false); }}>
                      <span className={"wb-kdot k-" + k} />{KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
                {kindFilter && (
                  <button type="button" className="chip clear"
                    onClick={() => { setKindFilter(null); setKindOpen(false); }}>Clear filter</button>
                )}
              </span>
            )}
          </span>
          <button ref={filterBtn} type="button" className={"btn ghost" + (filter ? " active-filter" : "")}
            data-filter-anchor aria-haspopup="true"
            onClick={() => filterBtn.current && ui.openFilter(filterBtn.current)}>
            <IcFilter /><span>{filter ? filter.name : "Who"}</span>
          </button>
          <button type="button" className="btn primary" onClick={ui.openAddTask}><IcPlus /> Add task</button>
        </span>

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
          .map((c, i) => (isTail(i) && !tailOpen ? "58px"
            : (byColumn[c.key] || []).length ? "minmax(272px, 1fr)" : "minmax(154px, 0.55fr)"))
          .join(" "),
      }}>
        {def.columns.map((c, i) => {
          const list = byColumn[c.key] || [];
          const folded = isTail(i) && !tailOpen;
          if (folded) {
            return (
              <button key={c.key} type="button" className="wb-colfold"
                onClick={() => setTailOpen(true)}
                onDragOver={(e) => { e.preventDefault(); setOver(c.key); }}
                onDrop={(e) => { setTailOpen(true); drop(e, c); }}>
                <span className="wb-foldn">{list.length}</span>
                <span className="wb-foldt">{c.title}</span>
              </button>
            );
          }
          return (
            <section key={c.key}
              className={"wb-col" + (over === c.key ? " over" : "") + (list.length ? "" : " empty")}
              onDragOver={(e) => { e.preventDefault(); setOver(c.key); }}
              onDragLeave={() => setOver((k) => (k === c.key ? null : k))}
              onDrop={(e) => drop(e, c)}>
              {/* The hint was a paragraph under every heading: five of them on a board is a
                  column of prose before the first card. It is the heading's tooltip now. */}
              <header className="wb-colh" title={c.hint || undefined}>
                <b>{c.title}{c.hint && <i className="wb-why" aria-hidden="true">?</i>}</b>
                <em>{list.length}</em>
                {isTail(i) && tailOpen && (
                  <button type="button" className="wb-colhide" title="Fold this column"
                    onClick={() => setTailOpen(false)}>&times;</button>
                )}
              </header>
              <div className="wb-stack">
                {list.map((card, at) => (
                  <Card key={card.id} card={card} view={view}
                    rank={at + 1} of={list.length}
                    siblings={list.map((x) => x.id)}
                    onMove={(id, col) => moveTo(id, col)}
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

/** What a card is, whichever record holds it. Roadmap work is a feature unless said so. */
const kindOf = (c: BoardCard): CardKind => (c.node?.kind || c.feature?.kind || "feature") as CardKind;

/** No rank yet means "wherever you already were", which sorts behind anything placed. */
const rank = (c: BoardCard): number => {
  const v = c.node?.boardOrder ?? c.feature?.boardOrder;
  return v == null ? Number.MAX_SAFE_INTEGER : v;
};

/** The tab badge, counted the same way the columns are filled: the union of what the columns
 *  would hold. It was its own `some()` pass, which drifted from the columns by six cards on
 *  the roadmap lens, and a badge that disagrees with the board under it is worse than no
 *  badge. One computation, two readers. */
function countFor(cards: BoardCard[], view: BoardView): number {
  return new Set(Object.values(columnsFor(cards, view)).flat().map((c) => c.id)).size;
}

/** Which cards land in which column of a view. */
function columnsFor(cards: BoardCard[], view: BoardView): Record<string, BoardCard[]> {
  const def = VIEW_BY_ID[view];
  const pool = def.ownedOnly ? cards.filter((c) => c.teams.length > 0) : cards;
  const out: Record<string, BoardCard[]> = {};
  for (const c of def.columns) {
    out[c.key] = pool
      .filter((x) => fits(c, x.stage, x.teams, x.review, kindOf(x)))
      .sort((a, b) => rank(a) - rank(b));
  }
  return out;
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

const nextPriority = (p: number | null | undefined): 1 | 2 | 3 =>
  (normPriority(p) === 3 ? 1 : normPriority(p) + 1) as 1 | 2 | 3;

function Card({ card, view, rank: at, of, siblings, onMove, dragging, onDragStart, onDragEnd }: {
  card: BoardCard; view: BoardView;
  /** Moving a card to a column runs the same rule a drop on it does, nudge and all. */
  onMove: (id: string, col: BoardColumn) => void;
  /** 1-based position in its column, which IS its priority. */
  rank: number; of: number; siblings: string[];
  dragging: boolean;
  onDragStart: (e: DragEvent) => void; onDragEnd: () => void;
}) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  /* The comment chip writes `ui.commentsOpen`, which nothing on this card was reading, so
     clicking it did nothing at all. Either way of opening the card opens the thread. */
  const cmt = s.ui.commentsOpen[card.id] === true;
  const body = open || cmt;
  const f = card.feature;
  /* A request carries the same work fields as a task and `findEntry` returns it as a Node,
     so the whole card body below is one piece of code: assignees, dates, checklist and
     comments, on either record. A card with half the buttons is not the same card. */
  const node: Node = card.node ?? (f as unknown as Node);
  const title = node.title;
  const kind: CardKind = (card.node?.kind || f?.kind || "feature") as CardKind;
  const counts = subtreeCounts(node);
  const shots = (card.node?.shots || f?.shots || []) as { id: string; name: string; src: string; bytes: number }[];
  const task = f ? s.featureTask(f) : null;

  return (
    <article className={"wb-card" + (dragging ? " dragging" : "")} draggable
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      data-node-id={card.node?.id} data-feature-id={f?.id}>
      <div className="wb-cardtop">
        <span className="wb-move">
          <button type="button" aria-label="Move up" disabled={at === 1}
            onClick={() => s.reorderCard(card.id, siblings, -1)}>&#9650;</button>
          <button type="button" aria-label="Move down" disabled={at === of}
            onClick={() => s.reorderCard(card.id, siblings, 1)}>&#9660;</button>
        </span>
        {/* Five values, so a select rather than a click-through: cycling past four to reach
            the fifth is a control that punishes you for wanting the last one. */}
        <select className={"wb-kind k-" + kind} value={kind} aria-label="What this card is"
          onChange={(e) => s.setCardKind(card.id, e.target.value as CardKind)}>
          {ALL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        {/* The sheet id is how you find a row in the spreadsheet, which is a backlog job.
            On a team board it is four characters of noise on every card. */}
        {f?.ref && view === "backlog" && <span className="wb-ref">{f.ref}</span>}
        {f?.urgency && <span className={"wb-urg u-" + f.urgency.toLowerCase()}>{f.urgency}</span>}
        {/* Moving a card without dragging it. Dragging is fine within a column you can see;
            it is not how you send something from the backlog to Dev on a board that scrolls
            five columns wide. */}
        {/* The columns of the board you are looking at, which is what "move it" means when
            you are looking at one. A list of teams answered a different question and left you
            to work out which column that put it in. */}
        <span className="wb-moveto">
          <button type="button" aria-label="Move to a column" title="Move to a column"
            onClick={() => setMoveOpen((v) => !v)}>&#8594;</button>
          {moveOpen && (
            <span className="wb-movemenu">
              {VIEW_BY_ID[view].columns.map((c) => (
                <button key={c.key} type="button"
                  className={fits(c, card.stage, card.teams, card.review, kind) ? "on" : ""}
                  onClick={() => { onMove(card.id, c); setMoveOpen(false); }}>
                  {c.title}
                </button>
              ))}
              <span className="wb-moverule" />
              {MOVE_TO.map((m) => (
                <button key={m.label} type="button"
                  onClick={() => { s.moveToTeam(card.id, m.value, m.stage); setMoveOpen(false); }}>
                  {m.label === "Back to the backlog" ? m.label : `Hand to ${m.label}`}
                </button>
              ))}
            </span>
          )}
        </span>
        <span className="wb-status"><StatusButton node={node} size={15} /></span>
      </div>

      <h4 className="wb-title">{title}</h4>
      {f?.storeName && <p className="wb-store">{f.storeName}</p>}

      {/* The old card's meta row, unchanged: who has it, when it is due, what was said. */}
      <div className="wb-meta">
        <span className="assignees"><Assignees node={node} small /></span>
        <DateChip node={node} variant="icon" />
        <CommentChip node={node} />
      </div>

      {counts.total > 0 && (
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
        {/* Position is the priority, so the number is the point: "second in this column" is
            a fact anybody can act on, where "Next" was a word three people read three ways.
            The horizon is still there and still clickable, in front of it. */}
        {card.node && (
          <button type="button" className={"wb-prio p-" + normPriority(node.priority)}
            title="Now, Next or Future" onClick={() => s.setPriority(node.id, nextPriority(node.priority))}>
            {waveWord(normPriority(node.priority))}
          </button>
        )}
        <span className="wb-rank" title={`${at} of ${of} in this column`}>{at}</span>
        {view === "pm" && <span className="wb-stage">{STAGE_LABEL[card.stage]}</span>}
        {task && <span className="wb-task" title={`Roadmap: ${task.title}`}>{task.title}</span>}
        {shots.length > 0 && <span className="wb-shotn">{shots.length} file{shots.length === 1 ? "" : "s"}</span>}
      </div>

      <button type="button" className={"wb-more" + (body ? " on" : "")}
        onClick={() => { setOpen(!body); if (cmt) s.toggleComments(card.id); }}>
        <IcChevron />{body ? "Less" : counts.total ? `Checklist and files (${counts.total})` : "Files and notes"}
      </button>

      {body && (
        <div className="wb-open">
          {counts.total > 0 && (
            <ul className="wb-subs">
              {node.children.map((k) => (
                <li key={k.id}>
                  <StatusButton node={k} size={13} />
                  <span className={k.status === "done" ? "done" : ""}>{k.title}</span>
                </li>
              ))}
            </ul>
          )}
          <AddSub parentId={node.id} />
          <Files id={card.id} shots={shots} />
          <CommentsThread node={node} />
          <button type="button" className="wb-del"
            onClick={() => {
              const n = counts.total;
              if (n && !confirm(`Delete "${title}" and its ${n} subtask${n === 1 ? "" : "s"}?`)) return;
              if (!n && !confirm(`Delete "${title}"?`)) return;
              s.delCard(card.id);
            }}>
            <IcTrash /> Delete this card
          </button>
        </div>
      )}
    </article>
  );
}

/** Handover links on a card: a Figma frame, a spec, a shared screenshot.
 *
 *  Links only. The file picker downscaled a JPEG into a data URL in this browser's storage,
 *  which is a copy nobody else on the team can open and a budget that runs out; a link is the
 *  thing itself and costs nothing. */
function Files({ id, shots }: { id: string; shots: { id: string; name: string; src: string; bytes: number }[] }) {
  const s = useStore();
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");

  const add = () => {
    const v = url.trim();
    if (!v) return;
    const r = s.addShotLink(id, v);
    if (!r.ok) { setErr(r.error || null); return; }
    setErr(null); setUrl(""); setAdding(false);
  };

  return (
    <div className="wb-files">
      <div className="wb-filerow">
        {shots.map((sh) => (
          <span className="wb-shot" key={sh.id}>
            <a href={sh.src} target="_blank" rel="noreferrer" title={sh.name}>
              {isImage(sh.src) ? <img src={sh.src} alt={sh.name} /> : <span className="wb-shotdoc">{sh.name.slice(0, 18)}</span>}
            </a>
            <button type="button" aria-label={`Remove ${sh.name}`} onClick={() => s.delShot(id, sh.id)}><IcTrash /></button>
          </span>
        ))}
        {!adding && shots.length < SHOT_MAX_PER_REQUEST && (
          <button type="button" className="wb-shotadd" onClick={() => setAdding(true)}>+ Link</button>
        )}
      </div>
      {adding && (
        <div className="wb-linkrow">
          <input autoFocus type="url" value={url} placeholder="https://..."
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add(); }
              if (e.key === "Escape") { setAdding(false); setUrl(""); setErr(null); }
            }} />
          <button type="button" onClick={add}>Add</button>
        </div>
      )}
      {err && <p className="wb-fileerr">{err}</p>}
    </div>
  );
}

const isImage = (src: string) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(src) || src.startsWith("data:image");

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

/** Add a subtask, the way the old board did. A card whose checklist can only be read is a
 *  card you have to leave the board to change. */
function AddSub({ parentId }: { parentId: string }) {
  const s = useStore();
  const [v, setV] = useState("");
  const add = () => { const t = v.trim(); if (!t) return; s.addChild(parentId, t); setV(""); };
  return (
    <div className="wb-addsub">
      <input type="text" value={v} placeholder="Add a subtask"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" onClick={add}>Add</button>
    </div>
  );
}
