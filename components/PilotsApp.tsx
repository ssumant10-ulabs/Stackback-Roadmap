"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Logo, IcActivity, IcRoadmap, IcSettings, ThemeIcon } from "./icons";
import { PilotsLog } from "./views/PilotsLog";
import { PilotsStats } from "./views/PilotsStats";
import { PilotsRequests } from "./views/PilotsRequests";
import { ActivityDrawer } from "./ActivityDrawer";
import { SettingsModal } from "./SettingsModal";
import { AppUiContext, type AppUi } from "./appui";

/** The pilots module. Its own route so CS and growth can live here without the roadmap's
 *  chrome, sharing the same store so edits land in the same shared state. */
export default function PilotsApp() {
  const s = useStore();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"log" | "requests" | "stats">("log");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { let alive = true; s.hydrate().then(() => { if (alive) setMounted(true); }); return () => { alive = false; }; }, [s]);

  // Nothing here opens a card popover, but the drawer and modals expect the context.
  const ui: AppUi = {
    openAssignee: () => {}, openDates: () => {}, openFilter: () => {}, openAddTask: () => {},
    openSettings: () => setSettingsOpen(true),
    // Cards live on the roadmap, so a jump leaves this module for that board.
    jumpToCard: (id) => { window.location.href = `/?view=board#${id}`; },
  };

  if (!mounted) return null;

  return (
    <AppUiContext.Provider value={ui}>
      <div className="app">
        <div className="topbar">
          <div className="topbar-main">
            <div className="brandmark">
              <Logo />
              <h1>Pilot stores</h1>
            </div>
            <div className="top-actions">
              <a className="btn ghost" href="/" title="Back to the roadmap"><IcRoadmap /><span>Roadmap</span></a>
              <span className="icon-group">
                <button className="ibtn" data-tip="Activity" aria-label="Activity" onClick={() => s.setActivityOpen(true)}><IcActivity /></button>
                <button className="ibtn" data-tip="Theme" aria-label="Theme" onClick={() => s.cycleTheme()}><ThemeIcon theme={s.ui.theme} /></button>
                <button className="ibtn" data-tip="Settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}><IcSettings /></button>
              </span>
            </div>
          </div>
          <div className="view-row">
            <nav className="view-switch" aria-label="Pilot views">
              <button type="button" className={`vpill${tab === "log" ? " active" : ""}`} onClick={() => setTab("log")}>
                <span>Activation log</span>
              </button>
              <button type="button" className={`vpill${tab === "requests" ? " active" : ""}`} onClick={() => setTab("requests")}>
                <span>Requests &amp; bugs</span>
              </button>
              <button type="button" className={`vpill${tab === "stats" ? " active" : ""}`} onClick={() => setTab("stats")}>
                <span>Stats</span>
              </button>
            </nav>
          </div>
        </div>
        <main data-view={tab}>
          {tab === "log" ? <PilotsLog /> : tab === "requests" ? <PilotsRequests /> : <PilotsStats />}
        </main>
      </div>
      {s.ui.activityOpen && <ActivityDrawer onClose={() => s.setActivityOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </AppUiContext.Provider>
  );
}
