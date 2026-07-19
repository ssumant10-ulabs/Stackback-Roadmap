"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { AppUiContext, type AppUi } from "./appui";
import { Header } from "./Header";
import { HeroMetrics } from "./HeroMetrics";
import { ViewRow } from "./ViewRow";
import { Timeline } from "./views/Timeline";
import { Overview } from "./views/Overview";
import { TeamsPeople } from "./views/TeamsPeople";
import { Board } from "./views/Board";
import { FilterPopover } from "./FilterPopover";
import { AssigneePopover } from "./AssigneePopover";
import { AddTaskModal } from "./AddTaskModal";
import { SettingsModal } from "./SettingsModal";

const cssEscape = (v: string) => (typeof window !== "undefined" && window.CSS && CSS.escape ? CSS.escape(v) : v);

export default function RoadmapApp() {
  const s = useStore();
  const [mounted, setMounted] = useState(false);
  const [assignPop, setAssignPop] = useState<{ nodeId: string; left: number; top: number } | null>(null);
  const [filterPop, setFilterPop] = useState<{ left: number; top: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { s.hydrate(); setMounted(true); }, [s]);

  const ui: AppUi = useMemo(() => ({
    openAssignee(nodeId, anchor) {
      const r = anchor.getBoundingClientRect();
      const pw = 260;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
      let top = r.bottom + 8;
      if (top + 340 > window.innerHeight) top = Math.max(12, r.top - 340);
      setAssignPop({ nodeId, left, top });
      setFilterPop(null);
    },
    openFilter(anchor) {
      const r = anchor.getBoundingClientRect();
      const pw = 290;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
      setFilterPop({ left, top: r.bottom + 8 });
      setAssignPop(null);
    },
    openAddTask() { setAddOpen(true); },
    openSettings() { setSettingsOpen(true); },
    jumpToCard(id) {
      s.setView("board");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = document.querySelector(`.card[data-node-id="${cssEscape(id)}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          (el as HTMLElement).style.boxShadow = "0 0 0 3px var(--brand)";
          setTimeout(() => ((el as HTMLElement).style.boxShadow = ""), 1400);
        }
      }));
    },
  }), [s]);

  if (!mounted) return null;

  const view = s.ui.view;
  return (
    <AppUiContext.Provider value={ui}>
      <div className="app">
        <div className="topbar">
          <Header />
          <HeroMetrics />
          <ViewRow />
        </div>
        <main data-view={view}>
          {view === "board" ? <Board /> : view === "simple" ? <Overview /> : view === "teams" ? <TeamsPeople /> : <Timeline />}
        </main>
        <div className="footnote">
          Switch views along the top. The <strong>Board</strong> is the editing hub: drag the grip to move a card, drop one onto another to nest it, click a status ring to cycle it, and use ▲▼ to reorder. Every view reads the same data, so edits show up everywhere. &nbsp;·&nbsp;
          <button onClick={() => { if (confirm(`Reset “${s.activeRoadmap().name}”? Added tasks and edits in this roadmap will be lost.`)) s.resetActive(); }}>Reset this roadmap</button>
        </div>
      </div>
      {filterPop && <FilterPopover pos={filterPop} onClose={() => setFilterPop(null)} />}
      {assignPop && <AssigneePopover pos={{ left: assignPop.left, top: assignPop.top }} nodeId={assignPop.nodeId} onClose={() => setAssignPop(null)} />}
      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </AppUiContext.Provider>
  );
}
