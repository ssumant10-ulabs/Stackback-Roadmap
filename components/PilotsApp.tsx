"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { UserButton } from "./UserButton";
import { Logo, IcActivity, IcSettings, ThemeIcon } from "./icons";
import { AppNav } from "./AppNav";
import HelpApp from "./help/HelpApp";
import type { LoggedQuery, StoreRecord, StoreSummary } from "@/lib/sanity/queries";
import { PilotsLog } from "./views/PilotsLog";
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
  /* One view. Requests & bugs are cards on the work board now, and the stats they fed are
     the five numbers in the roadmap header, so keeping tabs here was the same data in a
     third place with its own idea of the truth. */
  /* The Help Centre is not a fourth pilots view, it is the whole module shown in this
     screen. So it sits beside Roadmap in the header and takes over the body. */
  /* `/pilots?help=1` is how the Help Centre is reached from a screen that cannot show it in
     place, so the menu can be the same six everywhere. Read once, on mount. */
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("help") === "1") setHelpOpen(true);
  }, []);
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
              {/* The same six, same order. This header used to carry two of them. */}
              <AppNav here={helpOpen ? "help" : "pilots"} onHelp={() => setHelpOpen((v) => !v)} />
              <SaveState />
              <span className="icon-group">
                <button className="ibtn" data-tip="Activity" aria-label="Activity" onClick={() => s.setActivityOpen(true)}><IcActivity /></button>
                <button className="ibtn" data-tip="Theme" aria-label="Theme" onClick={() => s.cycleTheme()}><ThemeIcon theme={s.ui.theme} /></button>
                <button className="ibtn" data-tip="Settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}><IcSettings /></button>
                <UserButton />
              </span>
            </div>
          </div>
        </div>
        <main data-view={helpOpen ? "help" : "log"}>
          {helpOpen ? <HelpApp {...help} theme={resolvedTheme} embedded pilots={s.pilots}
              onExit={() => setHelpOpen(false)} exitLabel="Pilot stores" />
            : <PilotsLog />}
        </main>
      </div>
      {s.ui.activityOpen && <ActivityDrawer onClose={() => s.setActivityOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </AppUiContext.Provider>
  );
}
