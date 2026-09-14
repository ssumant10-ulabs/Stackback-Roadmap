"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { UserButton } from "./UserButton";
import { Logo, IcActivity, IcRoadmap, IcSettings, ThemeIcon } from "./icons";
import HelpApp from "./help/HelpApp";
import type { LoggedQuery, StoreRecord, StoreSummary } from "@/lib/sanity/queries";
import { PilotsLog } from "./views/PilotsLog";
import { PilotsStats } from "./views/PilotsStats";
import { PilotsRequests } from "./views/PilotsRequests";
import { ActivityDrawer } from "./ActivityDrawer";
import { SettingsModal } from "./SettingsModal";
import { SaveState } from "./SaveState";
import { AppUiContext, type AppUi } from "./appui";

/** The pilots module. Its own route so CS and growth can live here without the roadmap's
 *  chrome, sharing the same store so edits land in the same shared state. */
export interface HelpData {
  answered: LoggedQuery[];
  openQueries: LoggedQuery[];
  store: StoreRecord | null;
  stores: StoreSummary[];
  sanityConnected: boolean;
}

export default function PilotsApp({ help }: { help: HelpData }) {
  const s = useStore();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"log" | "requests" | "stats" | "help">("log");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { let alive = true; s.hydrate().then(() => { if (alive) setMounted(true); }); return () => { alive = false; }; }, [s]);

  // Nothing here opens a card popover, but the drawer and modals expect the context.
  const ui: AppUi = {
    openAssignee: () => {}, openDates: () => {}, openMove: () => {}, openFilter: () => {}, openAddTask: () => {},
    openSettings: () => setSettingsOpen(true),
    // Cards live on the roadmap, so a jump leaves this module for that board.
    jumpToCard: (id) => { window.location.href = `/?view=board#${id}`; },
  };

  /* The Help Centre draws its own palette, so it has to be told which one the app is on
     rather than reading a cookie it does not own here. */
  const resolvedTheme: "light" | "dark" = s.ui.theme === "auto"
    ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : (s.ui.theme as "light" | "dark");

  if (!mounted) return null;

  return (
    <AppUiContext.Provider value={ui}>
      <div className="app">
        <div className="topbar">
          <div className="topbar-main">
            <a className="brandmark" href="/" title="Back to the roadmap">
              <Logo />
              <h1>Pilot stores</h1>
            </a>
            <div className="top-actions">
              <a className="btn ghost" href="/" title="Back to the roadmap"><IcRoadmap /><span>Roadmap</span></a>
              <SaveState />
              <span className="icon-group">
                <button className="ibtn" data-tip="Activity" aria-label="Activity" onClick={() => s.setActivityOpen(true)}><IcActivity /></button>
                <button className="ibtn" data-tip="Theme" aria-label="Theme" onClick={() => s.cycleTheme()}><ThemeIcon theme={s.ui.theme} /></button>
                <button className="ibtn" data-tip="Settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}><IcSettings /></button>
                <UserButton />
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
              <button type="button" className={`vpill${tab === "help" ? " active" : ""}`} onClick={() => setTab("help")}>
                <span>Help Center</span>
              </button>
            </nav>
          </div>
        </div>
        <main data-view={tab}>
          {tab === "log" ? <PilotsLog />
            : tab === "requests" ? <PilotsRequests />
            : tab === "stats" ? <PilotsStats />
            : <HelpApp {...help} theme={resolvedTheme} embedded />}
        </main>
      </div>
      {s.ui.activityOpen && <ActivityDrawer onClose={() => s.setActivityOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </AppUiContext.Provider>
  );
}
