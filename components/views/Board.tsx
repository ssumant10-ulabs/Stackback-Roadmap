"use client";
import { createContext, DragEvent, Fragment, useContext, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PRIORITIES } from "@/lib/constants";
import { statusLabel, subtreeCounts } from "@/lib/derive";
import type { Node } from "@/lib/types";
import { Avatar, ReorderBtns } from "../bits";
import { IcAddSub, IcCheck, IcChevron, IcGrip, IcPlus, IcTrash } from "../icons";
import { useAppUi } from "../appui";

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
}
const BoardContext = createContext<BoardCtx | null>(null);
const useBoard = () => useContext(BoardContext)!;

function DropLine({ parent, priority, before }: { parent: string; priority: number | null; before: string }) {
  const b = useBoard();
  const key = `${parent}|${priority ?? ""}|${before}`;
  return <div className={`dropline${b.overDrop === key ? " over" : ""}`} onDragOver={(e) => b.onDropOver(e, key)} onDrop={(e) => b.onDrop(e, parent, before, priority)} />;
}

function Assignees({ node, small }: { node: Node; small?: boolean }) {
  const ui = useAppUi();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      {(node.assignees || []).map((a, i) => <Avatar key={i} a={a} small={small} />)}
      <button ref={ref} type="button" className="assign-add" data-assign-anchor aria-label="Assign owners" onClick={() => ref.current && ui.openAssignee(node.id, ref.current)}><IcPlus /></button>
    </>
  );
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
  const open = s.ui.collapsed[node.id] !== true;
  return (
    <div className={`subnode${node.status === "done" ? " done" : ""}${b.dragId === node.id ? " dragging-src" : ""}`} data-node-id={node.id}>
      <div className={`subnode-row nest-target${b.overNest === node.id ? " nest-over" : ""}`} onDragOver={(e) => b.onNestOver(e, node.id)} onDrop={(e) => b.onNestDrop(e, node.id)}>
        <span className="sub-grip" draggable title="Drag to move" onDragStart={(e) => b.start(e, node.id)} onDragEnd={b.end}><IcGrip /></span>
        <button type="button" className="status-btn" aria-label={`Status: ${statusLabel(node.status)}. Click to change.`} onClick={() => s.cycleStatus(node.id)}>
          <span className={`status-ring ${node.status}`}>{node.status === "done" && <IcCheck />}</span>
        </button>
        <div className="sn-main">
          <div className="sn-line"><span className="sn-text">{node.title}</span>{hasKids && <span className="sn-count">{counts.done}/{counts.total}</span>}</div>
          <div className="sn-line"><span className="sn-assignees"><Assignees node={node} small /></span>{node.eta && <span className="eta-badge">{node.eta}</span>}</div>
        </div>
        <div className="sn-tools">
          <ReorderBtns id={node.id} up={up} down={down} />
          <button type="button" className="icon-btn" aria-label="Add subtask" title="Add subtask" onClick={() => s.addChild(node.id)}><IcAddSub /></button>
          <button type="button" className="icon-btn danger" aria-label="Delete" onClick={() => { if (counts.total && !confirm(`Delete this and its ${counts.total} subtask(s)?`)) return; s.del(node.id); }}><IcTrash /></button>
        </div>
      </div>
      {hasKids && <button type="button" className={`collapse-toggle${open ? " open" : ""}`} style={{ marginLeft: 22 }} onClick={() => s.toggleCollapse(node.id)}><IcChevron />{open ? "Hide" : `Show ${counts.total}`}</button>}
      {hasKids && open && <div className="child-wrap"><NodeList items={node.children} parentId={node.id} /><AddRow parentId={node.id} /></div>}
    </div>
  );
}

function Card({ task }: { task: Node }) {
  const s = useStore();
  const b = useBoard();
  const counts = subtreeCounts(task);
  const hasKids = (task.children || []).length > 0;
  const open = s.ui.collapsed[task.id] !== true;
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  const m = s.cardMoves(task);
  return (
    <div className={`card${b.dragId === task.id ? " dragging-src" : ""}`} data-node-id={task.id}>
      <div className={`card-head nest-target${b.overNest === task.id ? " nest-over" : ""}`} onDragOver={(e) => b.onNestOver(e, task.id)} onDrop={(e) => b.onNestDrop(e, task.id)}>
        <div className="card-head-left">
          <span className="drag-handle" draggable title="Drag to move" onDragStart={(e) => b.start(e, task.id)} onDragEnd={b.end}><IcGrip /></span>
          <span className="card-title">{task.title}</span>
        </div>
        <div className="card-tools">
          <ReorderBtns id={task.id} up={m.up} down={m.down} />
          <button type="button" className="icon-btn" title="Set status" aria-label={`Status: ${statusLabel(task.status)}`} onClick={() => s.cycleStatus(task.id)}>
            <span className={`status-ring ${task.status}`} style={{ width: 15, height: 15 }}>{task.status === "done" && <IcCheck />}</span>
          </button>
          <button type="button" className="icon-btn danger" aria-label="Delete task" onClick={() => { if (counts.total && !confirm(`Delete this and its ${counts.total} subtask(s)?`)) return; s.del(task.id); }}><IcTrash /></button>
        </div>
      </div>
      <div className="meta-row"><span className="assignees"><Assignees node={task} /></span>{task.eta && <span className="eta-badge">Target: {task.eta}</span>}</div>
      {hasKids ? (
        <div className="progress-row"><div className="progress-track"><div className="progress-fill" style={{ width: pct + "%" }} /></div><div className="progress-label">{counts.done}/{counts.total}</div></div>
      ) : (
        <div className="progress-row"><span className={`status-pill ${task.status}`}>{statusLabel(task.status)}</span></div>
      )}
      {hasKids && <button type="button" className={`collapse-toggle${open ? " open" : ""}`} onClick={() => s.toggleCollapse(task.id)}><IcChevron />{open ? "Hide checklist" : `Show checklist (${counts.total})`}</button>}
      {hasKids && open ? (
        <div className="children"><NodeList items={task.children} parentId={task.id} /><AddRow parentId={task.id} /></div>
      ) : (!hasKids && <AddRow parentId={task.id} />)}
    </div>
  );
}

export function Board() {
  const s = useStore();
  const h = s.helpers;
  const f = s.ui.filter;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDrop, setOverDrop] = useState<string | null>(null);
  const [overNest, setOverNest] = useState<string | null>(null);

  const end = () => { setDragId(null); setOverDrop(null); setOverNest(null); if (typeof document !== "undefined") document.body.classList.remove("is-dragging"); };
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
    onDropOver(e, key) { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverDrop(key); setOverNest(null); },
    onDrop(e, parent, before, priority) { if (!dragId) return; e.preventDefault(); s.moveNode(dragId, parent, before, priority); end(); },
    onNestOver(e, id) { if (!dragId || id === dragId || s.isDesc(dragId, id)) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverNest(id); setOverDrop(null); },
    onNestDrop(e, id) { if (dragId && id !== dragId && !s.isDesc(dragId, id)) { e.preventDefault(); s.nestNode(dragId, id); } end(); },
  };

  return (
    <BoardContext.Provider value={ctx}>
      <div className="board">
        {PRIORITIES.map((w) => {
          const tasks = s.tasks.filter((t) => (t.priority || null) === w.p && h.matchFilter(t, f));
          return (
            <div className="column" key={String(w.p)}>
              <div className="column-head"><span className="word">{w.word}</span><span className="pr">{w.p ? `P${w.p}` : "Unscheduled"}</span><span className="n">{tasks.length}</span></div>
              {tasks.length ? (
                <div className="column-list">
                  <DropLine parent="root" priority={w.p} before={tasks.length ? tasks[0].id : ""} />
                  {tasks.map((t, i) => (
                    <Fragment key={t.id}>
                      <Card task={t} />
                      <DropLine parent="root" priority={w.p} before={tasks[i + 1] ? tasks[i + 1].id : ""} />
                    </Fragment>
                  ))}
                </div>
              ) : (
                <div className="column-list"><DropLine parent="root" priority={w.p} before="" /><div className="column-empty">{f ? "No matching tasks" : "Nothing here yet"}</div></div>
              )}
            </div>
          );
        })}
      </div>
    </BoardContext.Provider>
  );
}
