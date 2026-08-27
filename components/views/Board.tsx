"use client";
import { createContext, DragEvent, Fragment, useContext, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { STATES, stateOf, subtreeCounts } from "@/lib/derive";
import type { Node } from "@/lib/types";
import { Assignees } from "../Assignees";
import { CommentChip, DateChip, ReorderBtns, StatusButton } from "../bits";
import { CommentsThread } from "../CommentsThread";
import { IcAddSub, IcChevron, IcGrip, IcTrash } from "../icons";
import { useFlip } from "../useFlip";

interface BoardCtx {
  dragId: string | null;
  overDrop: string | null;
  overNest: string | null;
  start: (e: DragEvent, id: string) => void;
  end: () => void;
  onDropOver: (e: DragEvent, key: string) => void;
  onDrop: (e: DragEvent, parent: string, before: string, priority: number | null) => void;
  onNestOver: (e: DragEvent, id: string) => void;
  onNestDrop: (e: DragEvent, id: string) => void;
  onColOver: (e: DragEvent) => void;
  onColDrop: (e: DragEvent, priority: number | null) => void;
}
const BoardContext = createContext<BoardCtx | null>(null);
const useBoard = () => useContext(BoardContext)!;

function DropLine({ parent, priority, before }: { parent: string; priority: number | null; before: string }) {
  const b = useBoard();
  const key = `${parent}|${priority ?? ""}|${before}`;
  return <div className={`dropline${b.overDrop === key ? " over" : ""}`} onDragOver={(e) => b.onDropOver(e, key)} onDrop={(e) => b.onDrop(e, parent, before, priority)} />;
}

function AddRow({ parentId }: { parentId: string }) {
  const s = useStore();
  const [v, setV] = useState("");
  const add = () => { const val = v.trim(); if (!val) return; s.addChild(parentId, val); setV(""); };
  return (
    <div className="add-row">
      <input type="text" placeholder="Add a subtask…" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" onClick={add}>Add</button>
    </div>
  );
}

function NodeList({ items, parentId }: { items: Node[]; parentId: string }) {
  return (
    <>
      <DropLine parent={parentId} priority={null} before={items.length ? items[0].id : ""} />
      {items.map((n, i) => (
        <Fragment key={n.id}>
          <Subnode node={n} up={i > 0} down={i < items.length - 1} />
          <DropLine parent={parentId} priority={null} before={items[i + 1] ? items[i + 1].id : ""} />
        </Fragment>
      ))}
    </>
  );
}

function Subnode({ node, up, down }: { node: Node; up: boolean; down: boolean }) {
  const s = useStore();
  const b = useBoard();
  const counts = subtreeCounts(node);
  const hasKids = (node.children || []).length > 0;
  const open = s.isBoardOpen(node.id);
  const cmtOpen = s.ui.commentsOpen[node.id] === true;
  return (
    <div className={`subnode${node.status === "done" ? " done" : ""}${b.dragId === node.id ? " dragging-src" : ""}`} data-node-id={node.id}>
      <div className={`subnode-row nest-target${b.overNest === node.id ? " nest-over" : ""}`} onDragOver={(e) => b.onNestOver(e, node.id)} onDrop={(e) => b.onNestDrop(e, node.id)}>
        <span className="sub-grip" draggable title="Drag to move" onDragStart={(e) => b.start(e, node.id)} onDragEnd={b.end}><IcGrip /></span>
        <StatusButton node={node} />
        <div className="sn-main">
          <div className="sn-line"><span className="sn-text" draggable title="Drag to move" onDragStart={(e) => b.start(e, node.id)} onDragEnd={b.end}>{node.title}</span>{hasKids && <span className="sn-count">{counts.done}/{counts.total}</span>}</div>
          {hasKids && <div className="sn-progress"><span style={{ width: (counts.total ? Math.round((counts.done / counts.total) * 100) : 0) + "%" }} /></div>}
          <div className="sn-line"><span className="sn-assignees"><Assignees node={node} small /></span><DateChip node={node} variant="icon" /><CommentChip node={node} /></div>
        </div>
        <div className="sn-tools">
          <ReorderBtns id={node.id} up={up} down={down} />
          <button type="button" className="icon-btn" aria-label="Add subtask" title="Add subtask" onClick={() => s.addChild(node.id)}><IcAddSub /></button>
          <button type="button" className="icon-btn danger" aria-label="Delete" onClick={() => { if (counts.total && !confirm(`Delete this and its ${counts.total} subtask(s)?`)) return; s.del(node.id); }}><IcTrash /></button>
        </div>
      </div>
      {cmtOpen && <div style={{ marginLeft: 22 }}><CommentsThread node={node} /></div>}
      {hasKids && <button type="button" className={`collapse-toggle${open ? " open" : ""}`} style={{ marginLeft: 22 }} onClick={() => s.toggleBoardOpen(node.id)}><IcChevron />{open ? "Hide" : `Show ${counts.total}`}</button>}
      {hasKids && open && <div className="child-wrap"><NodeList items={node.children} parentId={node.id} /><AddRow parentId={node.id} /></div>}
    </div>
  );
}

function Card({ task }: { task: Node }) {
  const s = useStore();
  const b = useBoard();
  const counts = subtreeCounts(task);
  const hasKids = (task.children || []).length > 0;
  const open = s.isBoardOpen(task.id);
  const cmtOpen = s.ui.commentsOpen[task.id] === true;
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  const m = s.cardMoves(task);
  return (
    <div className={`card${b.dragId === task.id ? " dragging-src" : ""}`} data-node-id={task.id}>
      <div className={`card-head nest-target${b.overNest === task.id ? " nest-over" : ""}`} onDragOver={(e) => b.onNestOver(e, task.id)} onDrop={(e) => b.onNestDrop(e, task.id)}>
        <div className="card-head-left" draggable title="Drag to move" onDragStart={(e) => b.start(e, task.id)} onDragEnd={b.end}>
          <span className="drag-handle"><IcGrip /></span>
          <span className="card-title">{task.title}</span>
        </div>
        <div className="card-tools">
          <ReorderBtns id={task.id} up={m.up} down={m.down} />
          <StatusButton node={task} size={15} />
          <button type="button" className="icon-btn danger" aria-label="Delete task" onClick={() => { if (counts.total && !confirm(`Delete this and its ${counts.total} subtask(s)?`)) return; s.del(task.id); }}><IcTrash /></button>
        </div>
      </div>
      <div className="meta-row"><span className="assignees"><Assignees node={task} /></span><DateChip node={task} /><CommentChip node={task} /></div>
      {hasKids ? (
        <div className="progress-row"><div className="progress-track"><div className="progress-fill" style={{ width: pct + "%" }} /></div><div className="progress-label">{counts.done}/{counts.total}</div></div>
      ) : (
        <div className="progress-row"><span className={`status-pill ${task.status}`}>{task.status === "done" ? "Done" : task.status === "progress" ? "In progress" : "Planned"}</span></div>
      )}
      {cmtOpen && <CommentsThread node={task} />}
      {hasKids && <button type="button" className={`collapse-toggle${open ? " open" : ""}`} onClick={() => s.toggleBoardOpen(task.id)}><IcChevron />{open ? "Hide checklist" : `Show checklist (${counts.total})`}</button>}
      {hasKids && open ? (
        <div className="children"><NodeList items={task.children} parentId={task.id} /><AddRow parentId={task.id} /></div>
      ) : (!hasKids && <AddRow parentId={task.id} />)}
    </div>
  );
}

/** Scrolls the board while a card is held near an edge, so a drag from Now to Future does
 *  not need the user to let go, scroll, and pick the card back up. */
function useEdgeScroll() {
  const raf = useRef<number | null>(null);
  const vec = useRef({ x: 0, y: 0 });
  const el = useRef<HTMLElement | null>(null);

  const tick = () => {
    const { x, y } = vec.current;
    if (!x && !y) { raf.current = null; return; }
    if (x && el.current) el.current.scrollLeft += x;
    if (y) window.scrollBy(0, y);
    raf.current = requestAnimationFrame(tick);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    el.current = e.currentTarget;
    const r = e.currentTarget.getBoundingClientRect();
    const EDGE = 90, SPEED = 16;
    let x = 0, y = 0;
    if (e.clientX - r.left < EDGE) x = -SPEED * (1 - (e.clientX - r.left) / EDGE);
    else if (r.right - e.clientX < EDGE) x = SPEED * (1 - (r.right - e.clientX) / EDGE);
    if (e.clientY < EDGE) y = -SPEED * (1 - e.clientY / EDGE);
    else if (window.innerHeight - e.clientY < EDGE) y = SPEED * (1 - (window.innerHeight - e.clientY) / EDGE);
    vec.current = { x: Math.round(x), y: Math.round(y) };
    if ((vec.current.x || vec.current.y) && raf.current === null) raf.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    vec.current = { x: 0, y: 0 };
    if (raf.current !== null) { cancelAnimationFrame(raf.current); raf.current = null; }
  };

  return { onDragOver, stop };
}

export function Board() {
  const s = useStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDrop, setOverDrop] = useState<string | null>(null);
  const [overNest, setOverNest] = useState<string | null>(null);
  const edge = useEdgeScroll();

  // Animate cards to their new home after any tree change, rather than teleporting them.
  useFlip(s.getSnapshot(), ".board .card, .board .subnode");

  const end = () => {
    setDragId(null); setOverDrop(null); setOverNest(null);
    edge.stop();
    if (typeof document !== "undefined") document.body.classList.remove("is-dragging");
  };
  const ctx: BoardCtx = {
    dragId, overDrop, overNest,
    start(e, id) {
      setDragId(id);
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        const card = (e.currentTarget as HTMLElement).closest("[data-node-id]");
        if (card) e.dataTransfer.setDragImage(card as Element, 24, 18);
      } catch {}
      document.body.classList.add("is-dragging");
    },
    end,
    onDropOver(e, key) { if (!dragId) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setOverDrop(key); setOverNest(null); },
    onDrop(e, parent, before, priority) { if (!dragId) return; e.preventDefault(); e.stopPropagation(); s.moveNode(dragId, parent, before, priority); end(); },
    onNestOver(e, id) { if (!dragId || id === dragId || s.isDesc(dragId, id)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setOverNest(id); setOverDrop(null); },
    onNestDrop(e, id) { if (dragId && id !== dragId && !s.isDesc(dragId, id)) { e.preventDefault(); e.stopPropagation(); s.nestNode(dragId, id); } end(); },
    onColOver(e) { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } },
    onColDrop(e, priority) { if (dragId) { e.preventDefault(); s.moveNode(dragId, "root", "", priority); end(); } },
  };

  return (
    <BoardContext.Provider value={ctx}>
      <div className="board" onDragOver={edge.onDragOver} onDragLeave={edge.stop} onDrop={edge.stop}>
        {STATES.map((w) => {
          const tasks = s.viewTasks.filter((t) => stateOf(t) === w.k);
          // Done is not a column you drag into. A milestone earns it by having every
          // subtask checked off, so the column reflects the work rather than setting it.
          if (w.k === "done") {
            return (
              <div className="column done-col" key={w.k}>
                <div className="column-head"><span className="word">{w.word}</span><span className="pr">Shipped</span><span className="n">{tasks.length}</span></div>
                <div className="column-list">
                  {tasks.length
                    ? tasks.map((t) => <Card key={t.id} task={t} />)
                    : <div className="column-empty">{s.ui.filter ? "No matching tasks" : "Milestones arrive here once every subtask under them is checked off."}</div>}
                </div>
              </div>
            );
          }
          return (
            <div className="column" key={w.k}>
              <div className="column-head"><span className="word">{w.word}</span><span className="pr">{`P${w.p}`}</span><span className="n">{tasks.length}</span></div>
              {tasks.length ? (
                <div className="column-list" onDragOver={ctx.onColOver} onDrop={(e) => ctx.onColDrop(e, w.p)}>
                  <DropLine parent="root" priority={w.p} before={tasks.length ? tasks[0].id : ""} />
                  {tasks.map((t, i) => (
                    <Fragment key={t.id}>
                      <Card task={t} />
                      <DropLine parent="root" priority={w.p} before={tasks[i + 1] ? tasks[i + 1].id : ""} />
                    </Fragment>
                  ))}
                </div>
              ) : (
                <div className="column-list" onDragOver={ctx.onColOver} onDrop={(e) => ctx.onColDrop(e, w.p)}><DropLine parent="root" priority={w.p} before="" /><div className="column-empty">{s.ui.filter ? "No matching tasks" : "Nothing here yet"}</div></div>
              )}
            </div>
          );
        })}
      </div>
    </BoardContext.Provider>
  );
}
