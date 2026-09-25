"use client";
import { DragEvent, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  ASK_REVIEW, ASK_TEAM, BOARD_VIEWS, STAGE_LABEL, VIEW_BY_ID,
  fits, stageForDrop, stageOf,
  type BoardColumn, type BoardTeam, type BoardView, type ReviewWith, type Stage,
} from "@/lib/board";
import type { Feature } from "@/lib/types";

/** The work board. Bugs and feature requests are the cards, because they are the records
 *  that move between CS, design and dev; the roadmap task delivering one is a chip on the
 *  card rather than a card of its own.
 *
 *  Three lenses over one `stage` field. A column that is "in sync" with a column in another
 *  view is the same stage read twice, so there is nothing to keep level. See lib/board.ts. */
export function WorkBoard() {
  const s = useStore();
  const view = s.ui.boardView || "pm";
  const def = VIEW_BY_ID[view];
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** A handover that is waiting on its nudge. Nothing is written until it is answered. */
  const [ask, setAsk] = useState<{ id: string; kind: "team" | "review"; col: BoardColumn } | null>(null);

  const cards = s.features;

  const byColumn = useMemo(() => {
    const out: Record<string, Feature[]> = {};
    for (const c of def.columns) {
      out[c.key] = cards.filter((f) =>
        fits(c, stageOf(f), f.boardTeam ?? null, f.reviewWith ?? null));
    }
    return out;
  }, [cards, def]);

  /** Everything the lens cannot show, counted rather than hidden. A card with a stage no
   *  column in this view carries is not missing, it is somebody else's right now. */
  const elsewhere = useMemo(() => {
    const shown = new Set(Object.values(byColumn).flat().map((f) => f.id));
    return cards.filter((f) => !shown.has(f.id)).length;
  }, [byColumn, cards]);

  function drop(e: DragEvent, c: BoardColumn) {
    e.preventDefault();
    setOver(null);
    const id = dragId || e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id) return;
    const f = cards.find((x) => x.id === id);
    if (!f) return;
    const r = stageForDrop(c, f.boardTeam ?? null);
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
        <p className="wb-blurb">
          {def.blurb}
          {elsewhere > 0 && <> <span className="wb-else">{elsewhere} card{elsewhere === 1 ? " sits" : "s sit"} in a stage this view does not carry.</span></>}
        </p>
      </div>

      <div className="wb-cols" style={{ gridTemplateColumns: `repeat(${def.columns.length}, minmax(232px, 1fr))` }}>
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
                {list.map((f) => (
                  <Card key={f.id} f={f} view={view}
                    dragging={dragId === f.id}
                    onDragStart={(e) => { setDragId(f.id); e.dataTransfer.setData("text/plain", f.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setOver(null); }} />
                ))}
                {!list.length && <p className="wb-empty">Nothing here.</p>}
              </div>
            </section>
          );
        })}
      </div>

      {ask && (
        <Nudge spec={ask.kind === "team" ? ASK_TEAM : ASK_REVIEW}
          title={cards.find((f) => f.id === ask.id)?.title || ""}
          onPick={answer} onClose={() => setAsk(null)} />
      )}
    </div>
  );
}

function countFor(cards: Feature[], view: BoardView): number {
  const def = VIEW_BY_ID[view];
  return cards.filter((f) =>
    def.columns.some((c) => fits(c, stageOf(f), f.boardTeam ?? null, f.reviewWith ?? null))).length;
}

function Card({ f, view, dragging, onDragStart, onDragEnd }: {
  f: Feature; view: BoardView; dragging: boolean;
  onDragStart: (e: DragEvent) => void; onDragEnd: () => void;
}) {
  const s = useStore();
  const task = s.featureTask(f);
  const stage = stageOf(f);
  const team = f.boardTeam;

  return (
    <article className={"wb-card" + (dragging ? " dragging" : "")} draggable
      onDragStart={onDragStart} onDragEnd={onDragEnd} data-feature-id={f.id}>
      <div className="wb-cardtop">
        {f.ref && <span className="wb-ref">{f.ref}</span>}
        {f.kind === "bug" && <span className="wb-kind bug">Bug</span>}
        {f.urgency && <span className={"wb-urg u-" + f.urgency.toLowerCase()}>{f.urgency}</span>}
      </div>
      <h4 className="wb-title">{f.title}</h4>
      {f.storeName && <p className="wb-store">{f.storeName}</p>}
      <div className="wb-chips">
        {/* The team only shows in PM's lens: inside Design's board every card is design's. */}
        {view === "pm" && team && <span className={"wb-team t-" + (team === "Design" ? "dsg" : "eng")}>{team === "Engineering" ? "Dev" : "Design"}</span>}
        {f.reviewWith && stage === "dev_review" && <span className="wb-team t-rev">{f.reviewWith === "Design" ? "Design QA" : "PM review"}</span>}
        {/* Where it is, for anyone reading a junction column and wondering which half. */}
        {view === "pm" && <span className="wb-stage">{STAGE_LABEL[stage]}</span>}
        {/* The roadmap task delivering this, named rather than linked: the board no longer
            holds roadmap cards to jump to. */}
        {task && <span className="wb-task" title={`Roadmap: ${task.title}`}>{task.title}</span>}
      </div>
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
