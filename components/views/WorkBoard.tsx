"use client";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  ALL_KINDS, ASK_REVIEW, ASK_TEAM, BOARD_VIEWS, KIND_LABEL, MOVE_TO, STAGE_LABEL, VIEW_BY_ID,
  fits, stageForDrop,
  type BoardColumn, type BoardTeam, type BoardView, type CardKind, type ReviewWith, type Stage,
} from "@/lib/board";
import { cardPriority, normPriority, subtreeCounts, waveWord } from "@/lib/derive";
import { sprintId, weekStart } from "@/lib/sprint";
import type { Node } from "@/lib/types";
import { Assignees } from "../Assignees";
import { StatusButton } from "../bits";
import { CommentsThread } from "../CommentsThread";
import CardDetail from "./CardDetail";
import { CardExpand } from "./CardExpand";
import SprintBoard from "./SprintBoard";
import { PRIORITIES } from "@/lib/constants";
import { IcFilter, IcPlus } from "../icons";
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
  /** The card whose detail panel is open. Everything a card used to fold open now lives
   *  there, so the board itself holds the id rather than each card holding a flag. */
  const [detail, setDetail] = useState<string | null>(null);
  /* The sprint is not a sixth column set, so it is not in BOARD_VIEWS: it reads the same
     cards a different way, by commitment rather than by stage. Local state, and picking any
     lens tab leaves it. */
  const [sprint, setSprint] = useState(false);

  const all = s.boardCards();
  const filter = s.ui.filter;

  /** The team and person filter, which applied to two views and silently did nothing here.
   *  A card matches on who is assigned to it, or on the team it was handed to. */
  /** Two filters, because "Design's cards" and "every template" are different questions and
   *  one control cannot answer both. The team one is the popover; this one is the row. */
  const [kindFilter, setKindFilter] = useState<CardKind | null>(null);
  /* Per view, not per card: a sort is a question you ask of a list, and the hand-arranged
     board order is still the default because somebody put it in that order on purpose. */
  const [sort, setSort] = useState<SortId>("board");
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

  /* The week opens itself, from the board rather than from the Sprint tab.
     Whoever opens the board first that week is the person who would otherwise have had to
     remember, and the commitment is pinned at a moment nobody chose. Hanging it off the
     Sprint tab instead meant a week nobody opened until Thursday counted three days of
     additions as things we had committed to on Monday, which is the one number the sprint
     exists to keep honest. Not before `ready`: mid-load the board still holds the seeded
     default, and a commitment snapshotted off that is a commitment nobody made. */
  useEffect(() => {
    if (s.ready) s.syncSprint(sprintId(weekStart(0)));
  }, [s.ready, all, s]);

  const byColumn = useMemo(() => columnsFor(cards, view, sort), [cards, view, sort]);

  /* What this lens is not showing, and WHY, which are two different reasons. On a team board
     the rest is other teams' work; on the Roadmap it is work nobody has taken. One sentence
     for both said "sits in a stage this view does not carry", which is true of neither. */
  const elsewhere = useMemo(() => {
    const shown = new Set(Object.values(byColumn).flat().map((c) => c.id));
    const rest = cards.filter((c) => !shown.has(c.id));
    return { unowned: rest.filter((c) => !c.teams.length).length, owned: rest.filter((c) => c.teams.length).length };
  }, [byColumn, cards]);

  function drop(e: DragEvent, c: BoardColumn) {
    e.preventDefault();
    setOver(null);
    const id = dragId || e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id) return;
    const card = all.find((x) => x.id === id);
    if (!card) return;
    moveTo(id, c);
  }

  /** The move menu and a drop are the same action, so they run the same rule.
   *
   *  A drop can re-file a card without moving it, which is what the backlog's four columns
   *  do: they sort by what a card IS. That answer had nowhere to go — every drop wrote a
   *  stage and nothing wrote a kind — so dragging anything in the backlog did nothing at
   *  all, and adding a card to Bugs made a feature. */
  function moveTo(id: string, c: BoardColumn) {
    const card = all.find((x) => x.id === id);
    if (!card) return;
    const r = stageForDrop(c, card.team, kindOf(card));
    if ("ask" in r) { setAsk({ id, kind: r.ask, col: c }); return; }
    if (r.kind) s.setCardKind(id, r.kind);
    if ("stage" in r) {
      s.setStage(id, r.stage, {
        ...("review" in r ? { review: r.review ?? null } : {}),
        ...("team" in r ? { team: r.team ?? null } : {}),
      });
    }
  }

  const asking = ask ? all.find((c) => c.id === ask.id) : null;
  const detailCard = detail ? all.find((c) => c.id === detail) : null;

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
    const r = stageForDrop(ask.col, team, asking ? kindOf(asking) : "feature");
    const stage: Stage = "ask" in r || !("stage" in r) ? "pm_handover" : r.stage;
    const review = "ask" in r || !("stage" in r) ? undefined : r.review;
    s.setStage(ask.id, stage, { team, ...(review !== undefined ? { review } : {}) });
    setAsk(null);
  }
  const isTail = (i: number) => def.columns.length > 3 && i === def.columns.length - 1;

  return (
    <div className="wb">
      <div className="wb-head">
        {/* Four places. PM, Design and Dev are three readings of one board and sit inside
            it; the Sprint, the Roadmap and the Backlog are each a different question about
            the same cards. The Backlog is up here because it is not a team's board — it is
            everything no team has — and one level down it read as a fourth team. */}
        <nav className="wb-tabs wb-tabs-top" role="tablist" aria-label="Views">
          <button role="tab" aria-selected={!sprint && TEAM_LENSES.includes(view)}
            className={"wb-tab" + (!sprint && TEAM_LENSES.includes(view) ? " on" : "")}
            onClick={() => { setSprint(false); if (!TEAM_LENSES.includes(view)) s.setBoardView("pm"); }}>
            {/* No count: the three sub-tabs each carry their own, and a fourth number over
                them only reads as a fourth board. */}
            Team board
          </button>
          <button role="tab" aria-selected={sprint}
            className={"wb-tab" + (sprint ? " on" : "")}
            onClick={() => setSprint(true)}>
            Sprint
            <em>{cards.filter((c) => cardPriority(c.node ?? c.feature) === 1).length}</em>
          </button>
          <button role="tab" aria-selected={!sprint && view === "roadmap"}
            className={"wb-tab" + (!sprint && view === "roadmap" ? " on" : "")}
            onClick={() => { setSprint(false); s.setBoardView("roadmap"); }}>
            Roadmap
            <em>{countFor(cards, "roadmap")}</em>
          </button>
          <button role="tab" aria-selected={!sprint && view === "backlog"}
            className={"wb-tab" + (!sprint && view === "backlog" ? " on" : "")}
            onClick={() => { setSprint(false); s.setBoardView("backlog"); }}>
            Backlog
            <em>{countFor(cards, "backlog")}</em>
          </button>
        </nav>

        {!sprint && TEAM_LENSES.includes(view) && (
        <nav className="wb-tabs wb-tabs-sub" role="tablist" aria-label="Team boards">
          {BOARD_VIEWS.filter((v) => TEAM_LENSES.includes(v.id)).map((v) => (
            <button key={v.id} role="tab" aria-selected={!sprint && view === v.id}
              className={"wb-tab" + (!sprint && view === v.id ? " on" : "")}
              onClick={() => { setSprint(false); s.setBoardView(v.id as BoardView); }}>
              {v.label}
              <em>{countFor(cards, v.id as BoardView)}</em>
            </button>
          ))}
        </nav>
        )}
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
          <label className="wb-sort" title="How to order the cards inside each column">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortId)}>
              {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn primary" onClick={ui.openAddTask}><IcPlus /> Add task</button>
        </span>

        <p className="wb-blurb">
          {sprint ? "One week's commitment in a single view, by how far along each card is. The Now horizon is the sprint." : def.blurb}
          {!sprint && elsewhere.unowned > 0 && <> <span className="wb-else">{elsewhere.unowned} card{elsewhere.unowned === 1 ? "" : "s"} nobody has taken, in the backlog.</span></>}
          {!sprint && elsewhere.owned > 0 && <> <span className="wb-else">{elsewhere.owned} more on the other boards.</span></>}
          {filter && <> <span className="wb-else">Filtered to {filter.name}.</span></>}
        </p>
      </div>

      {sprint && <SprintBoard cards={cards} onOpen={setDetail} />}

      {/* An empty column takes a sliver, not a share. Seven equal columns with five of them
          saying "Nothing here" pushed the two that hold the work off the screen. */}
      {!sprint && <div className="wb-cols" style={{
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
                    /* A module or a template IS its subtasks, so those two piles show the
                       checklist without being opened. */
                    expand={c.filesAs === "module" || c.filesAs === "template"}
                    onOpen={() => setDetail(card.id)}
                    onMove={(id, col) => moveTo(id, col)}
                    dragging={dragId === card.id}
                    onDragStart={(e) => { setDragId(card.id); e.dataTransfer.setData("text/plain", card.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setOver(null); }} />
                ))}
                {!list.length && <p className="wb-empty">Nothing here.</p>}
              </div>
              {/* A column you cannot add to is a column you have to leave to add to. */}
              <AddCard col={c} onAdded={setDetail} open={adding === c.key}
                onOpen={() => setAdding(c.key)} onClose={() => setAdding(null)}
                onAsk={(id, kind, column) => setAsk({ id, kind, col: column })} />
            </section>
          );
        })}
      </div>}

      {detailCard && <CardDetail card={detailCard} onClose={() => setDetail(null)} />}

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
export type BoardCard = ReturnType<ReturnType<typeof useStore>["boardCards"]>[number];

/** The four readings that live inside Team board. The Roadmap and the Sprint are their own
 *  top-level questions, so they are not in here. */
/** The three team boards. The Backlog came out from under them: it is not a team's board,
 *  it is where work with no team sits, and burying it as a fourth sub-tab made it read as
 *  one more column set belonging to whoever was selected above it. */
const TEAM_LENSES: BoardView[] = ["pm", "design", "dev"];

/** What a card is, whichever record holds it. Roadmap work is a feature unless said so. */
const kindOf = (c: BoardCard): CardKind => (c.node?.kind || c.feature?.kind || "feature") as CardKind;

/** No rank yet means "wherever you already were", which sorts behind anything placed. */
const rank = (c: BoardCard): number => {
  const v = c.node?.boardOrder ?? c.feature?.boardOrder;
  return v == null ? Number.MAX_SAFE_INTEGER : v;
};

/** Now, then Next, then Future; position within the horizon after that. Both are priority
 *  and they answer different halves of it: the horizon is WHEN, the position is what comes
 *  first once you are there. Sorting on position alone put next month's work above this
 *  week's in the same column. */
const horizon = (c: BoardCard): number => cardPriority(c.node ?? c.feature);
const byPriority = (a: BoardCard, b: BoardCard) => horizon(a) - horizon(b) || rank(a) - rank(b);

/** How a column is ordered. Board order is the one the team arranged by hand and stays the
 *  default; the rest are questions you ask of a long list once and then stop asking. */
export const SORTS = [
  { id: "board", label: "Board order" },
  { id: "new", label: "Newest first" },
  { id: "old", label: "Oldest first" },
  { id: "horizon", label: "Horizon" },
  { id: "az", label: "Title A\u2013Z" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

/* No birthday means one of the originals, so it sorts as oldest rather than as unknown.
   Features carry `updatedAt` from the sheet import and fall back to it. */
const born = (c: BoardCard): string =>
  (c.node?.createdAt ?? c.feature?.createdAt ?? c.feature?.updatedAt ?? "") || "";
const titleOfCard = (c: BoardCard) => (c.node ?? (c.feature as unknown as Node)).title || "";

function comparator(sort: SortId): (a: BoardCard, b: BoardCard) => number {
  if (sort === "new") return (a, b) => born(b).localeCompare(born(a)) || byPriority(a, b);
  if (sort === "old") return (a, b) => born(a).localeCompare(born(b)) || byPriority(a, b);
  if (sort === "horizon") return (a, b) => horizon(a) - horizon(b) || titleOfCard(a).localeCompare(titleOfCard(b));
  if (sort === "az") return (a, b) => titleOfCard(a).localeCompare(titleOfCard(b));
  return byPriority;
}

/** The tab badge, counted the same way the columns are filled: the union of what the columns
 *  would hold. It was its own `some()` pass, which drifted from the columns by six cards on
 *  the roadmap lens, and a badge that disagrees with the board under it is worse than no
 *  badge. One computation, two readers. */
function countFor(cards: BoardCard[], view: BoardView): number {
  return new Set(Object.values(columnsFor(cards, view)).flat().map((c) => c.id)).size;
}

/** Which cards land in which column of a view. */
function columnsFor(cards: BoardCard[], view: BoardView, sort: SortId = "board"): Record<string, BoardCard[]> {
  const def = VIEW_BY_ID[view];
  /* The lens decides which cards it is about before any column sees them: work in hand on
     the four working lenses, everything unclaimed or parked on the backlog. */
  const pool = cards.filter((c) => def.holds(c.teams, cardPriority(c.node ?? c.feature)));
  const out: Record<string, BoardCard[]> = {};
  for (const c of def.columns) {
    out[c.key] = pool
      .filter((x) => fits(c, x.stage, x.teams, x.review, kindOf(x)))
      .sort(comparator(sort));
  }
  return out;
}

/** Add a card straight into the column you are looking at. A card born in Bugs is a bug;
 *  anywhere else it is a feature, and the tag is one click away on the card itself. */
function AddCard({ col, open, onOpen, onClose, onAsk, onAdded }: {
  col: BoardColumn; open: boolean; onOpen: () => void; onClose: () => void;
  onAsk: (id: string, kind: "team" | "review", col: BoardColumn) => void;
  onAdded: (id: string) => void;
}) {
  const s = useStore();
  const [v, setV] = useState("");
  const add = () => {
    const title = v.trim();
    if (!title) return;
    /* `col.filesAs` is the column saying what it holds. The old test was `col.key === "bug"`
       and no column has that key — the backlog's is "bugs" — so a card added to Bugs, to
       Templates or to Modules was created as a feature and appeared in none of them. */
    const kind: CardKind = col.filesAs ?? "feature";
    const id = s.addBoardCard(title, kind);
    if (!id) return;
    /* The composer takes a title and nothing else, because a column of inline forms with
       six fields each is not a board. So the card opens on its drawer straight after, where
       the brief, the surface and the rest are set in the same breath rather than needing
       the card to be found again later. */
    // A kind column does not move a card, so being born in one is the whole of it.
    if (col.filesAs) { setV(""); onAdded(id); return; }
    /* Born outside the intake columns: it belongs where it was added, not back in the pile.
       And a card added straight into the handover column has to answer the same question a
       dragged one does. It did not, so it landed in PM's handover with no team on it, which
       is a card in nobody's column: PM could see it and Design never could. */
    const first = col.accepts[0];
    if (first.stage === "bug" || first.stage === "feature") { setV(""); onAdded(id); return; }
    const drop = stageForDrop(col, null, kind);
    /* A pending nudge owns the screen: opening the drawer behind it would stack two dialogs
       and the answer to the nudge is what decides where the card even sits. */
    if ("ask" in drop) { setV(""); onAsk(id, drop.ask, col); return; }
    if ("stage" in drop) {
      s.setStage(id, drop.stage, { team: drop.team ?? first.team ?? null, review: drop.review ?? first.review ?? null });
    }
    setV("");
    onAdded(id);
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

/** One card on the board: the title, the horizon, and who has it.
 *
 *  It used to carry nine chips, a progress bar, a kind dropdown, a rank, a stage, its
 *  roadmap parent, a file count and a fold holding subtasks, links and a comment thread. A
 *  column of forty of those is not a list you scan; it is forty things to read. So the card
 *  is the three facts you scan for and everything else is a click away in `CardDetail`,
 *  where there is room to EDIT it rather than only look at it.
 *
 *  Two exceptions, both because the column's own meaning demands it. A module or template IS
 *  its subtasks, so in those piles the checklist shows on the card. And the move menu stays,
 *  because moving a card without opening it is the whole point of a board. */
function Card({ card, view, rank: at, of, siblings, onMove, dragging, onDragStart, onDragEnd, expand, onOpen }: {
  card: BoardCard; view: BoardView;
  onMove: (id: string, col: BoardColumn) => void;
  rank: number; of: number; siblings: string[];
  dragging: boolean;
  /** Show the checklist on the card. True in the piles where a card IS its subtasks. */
  expand?: boolean;
  onOpen: () => void;
  onDragStart: (e: DragEvent) => void; onDragEnd: () => void;
}) {
  const s = useStore();
  /* Where to draw the move menu, in viewport coordinates.
     It cannot be positioned inside the card: `.wb-cols` sets `overflow-x: auto`, and CSS
     computes `overflow-y` to `auto` alongside it, so the column is a clipping context and an
     absolutely-positioned menu is cut off at its edge — which is what it was doing. Fixed to
     the viewport, measured off the button, and flipped up when it would fall off. */
  const [moveAt, setMoveAt] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const moveBtn = useRef<HTMLButtonElement>(null);
  const f = card.feature;
  const node: Node = card.node ?? (f as unknown as Node);
  const kind: CardKind = (card.node?.kind || f?.kind || "feature") as CardKind;
  const counts = subtreeCounts(node);
  const horizon = cardPriority(card.node ?? card.feature);
  const hasDesc = !!(node.desc || "").trim();
  /* Opt-in and per card, so a column opens quiet however many checklists it holds. The
     module and template piles still force it: a card there IS its subtasks. */
  const [open, setOpen] = useState(false);

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

        {/* A SELECT, not a click-through. Cycling Now to Next to Future means one extra
            click past the one you wanted parks the card in the backlog, and that is a
            destination, not a wrap-around. */}
        <select className={"wb-prio p-" + horizon} aria-label="Horizon"
          title="Future parks the card in the backlog"
          value={horizon} onChange={(e) => s.setPriority(card.id, Number(e.target.value) as 1 | 2 | 3)}>
          {PRIORITIES.map((w) => <option key={w.p} value={w.p}>{w.word}</option>)}
        </select>

        <span className="wb-cardgrow" />

        <span className="wb-moveto">
          <button ref={moveBtn} type="button" aria-label="Move to a column" title="Move to a column"
            onClick={() => {
              if (moveAt) { setMoveAt(null); return; }
              const r = moveBtn.current?.getBoundingClientRect();
              if (!r) return;
              const room = window.innerHeight - r.bottom;
              setMoveAt({ left: r.right, top: room < 300 ? r.top : r.bottom + 4, up: room < 300 });
            }}>&#8594;</button>
          {moveAt && (
            <span className="wb-movemenu" style={{ left: moveAt.left, top: moveAt.top,
              transform: `translateX(-100%)${moveAt.up ? " translateY(-100%)" : ""}` }}>
              {VIEW_BY_ID[view].columns.map((c) => (
                <button key={c.key} type="button"
                  className={fits(c, card.stage, card.teams, card.review, kind) ? "on" : ""}
                  onClick={() => { onMove(card.id, c); setMoveAt(null); }}>
                  {c.title}
                </button>
              ))}
              <span className="wb-moverule" />
              {MOVE_TO.map((m) => (
                <button key={m.label} type="button"
                  onClick={() => { s.moveToTeam(card.id, m.value, m.stage); setMoveAt(null); }}>
                  {m.label === "Back to the backlog" ? m.label : `Hand to ${m.label}`}
                </button>
              ))}
            </span>
          )}
        </span>
        <span className="wb-status"><StatusButton node={node} size={15} /></span>
      </div>

      <button type="button" className="wb-title wb-titlebtn" onClick={onOpen}>{node.title}</button>

      <div className="wb-meta">
        <span className="assignees"><Assignees node={node} small /></span>
        {/* The count opens the checklist in place rather than the whole card. Sending it to
            the drawer was the wrong trade: ticking something off is the commonest thing
            anyone does to a card, and it was the one thing that cost a panel. */}
        {(counts.total > 0 || hasDesc) && (
          <button type="button" className={"wb-count" + (open ? " on" : "")}
            aria-expanded={open} onClick={() => setOpen(!open)}
            title={open ? "Hide the brief and the checklist" : "Show the brief and the checklist"}>
            {counts.total > 0 ? `${counts.done}/${counts.total}` : "Brief"}
          </button>
        )}
      </div>

      {(open || (expand && counts.total > 0)) && <CardExpand node={node} onOpen={onOpen} />}
    </article>
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
