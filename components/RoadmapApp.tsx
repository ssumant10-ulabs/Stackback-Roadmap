"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { AppUiContext, type AppUi } from "./appui";
import { Header } from "./Header";
import { HeroMetrics } from "./HeroMetrics";
import { ViewRow } from "./ViewRow";
import { Timeline } from "./views/Timeline";
import { Overview } from "./views/Overview";
import { TeamsPeople } from "./views/TeamsPeople";
import { Board } from "./views/Board";
import { Features } from "./views/Features";
import { FilterPopover } from "./FilterPopover";
import { AssigneePopover } from "./AssigneePopover";
import { DatesPopover } from "./DatesPopover";
import { AddTaskModal } from "./AddTaskModal";
import { SettingsModal } from "./SettingsModal";
import { ActivityDrawer } from "./ActivityDrawer";

const cssEscape = (v: string) => (typeof window !== "undefined" && window.CSS && CSS.escape ? CSS.escape(v) : v);

export default function RoadmapApp() {
  const s = useStore();
  const [mounted, setMounted] = useState(false);
  const [assignPop, setAssignPop] = useState<{ nodeId: string; left: number; top: number } | null>(null);
  const [datesPop, setDatesPop] = useState<{ nodeId: string; left: number; top: number } | null>(null);
  const [filterPop, setFilterPop] = useState<{ left: number; top: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const urlApplied = useRef(false);

  useEffect(() => {
    let alive = true;
    s.hydrate().then(() => {
      if (!alive) return;
      // A shared link decides the opening view and filter, once, before first paint.
      if (!urlApplied.current) {
        urlApplied.current = true;
        s.applyUrl(window.location.search);
      }
      setMounted(true);
    });
    return () => { alive = false; };
  }, [s]);

  // Keep the address bar in step with the view and filter, so the URL is always shareable.
  const version = s.getSnapshot();
  useEffect(() => {
    if (!mounted) return;
    const q = s.toQuery();
    const next = window.location.pathname + q;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next);
    }
  }, [mounted, version, s]);

  // Back and forward should move between shared states, not out of the app.
  useEffect(() => {
    const onPop = () => s.applyUrl(window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [s]);

  const place = (anchor: HTMLElement, w: number, h: number) => {
    const r = anchor.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    let top = r.bottom + 8;
    if (top + h > window.innerHeight) top = Math.max(12, r.top - h);
    return { left, top };
  };

  const ui: AppUi = useMemo(() => ({
    openAssignee(nodeId, anchor) {
      setAssignPop({ nodeId, ...place(anchor, 260, 340) });
      setFilterPop(null); setDatesPop(null);
    },
    openDates(nodeId, anchor) {
      setDatesPop({ nodeId, ...place(anchor, 260, 260) });
      setFilterPop(null); setAssignPop(null);
    },
    openFilter(anchor) {
      const r = anchor.getBoundingClientRect();
      const pw = 290;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
      setFilterPop({ left, top: r.bottom + 8 });
      setAssignPop(null); setDatesPop(null);
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
          {view === "board" ? <Board /> : view === "simple" ? <Overview /> : view === "teams" ? <TeamsPeople /> : view === "features" ? <Features /> : <Timeline />}
        </main>
        <div className="footnote">
          <button onClick={() => { if (confirm(`Reset “${s.activeRoadmap().name}”? Added tasks and edits in this roadmap will be lost.`)) s.resetActive(); }}>Reset this roadmap</button>
        </div>
      </div>
      {filterPop && <FilterPopover pos={filterPop} onClose={() => setFilterPop(null)} />}
      {assignPop && <AssigneePopover pos={{ left: assignPop.left, top: assignPop.top }} nodeId={assignPop.nodeId} onClose={() => setAssignPop(null)} />}
      {datesPop && <DatesPopover pos={{ left: datesPop.left, top: datesPop.top }} nodeId={datesPop.nodeId} onClose={() => setDatesPop(null)} />}
      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {s.ui.activityOpen && <ActivityDrawer onClose={() => s.setActivityOpen(false)} />}
    </AppUiContext.Provider>
  );
}
