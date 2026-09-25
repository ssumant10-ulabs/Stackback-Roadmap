"use client";
import { useStore } from "@/lib/store";
import { UserButton } from "./UserButton";
import { SaveState } from "./SaveState";
import { firebaseEnabled } from "@/lib/firebase";
import { IcActivity, IcSettings, Logo, ThemeIcon } from "./icons";
import { AppNav } from "./AppNav";
import { useAppUi } from "./appui";

const THEME_LABEL = { auto: "Auto", light: "Light", dark: "Dark" } as const;

/** Icon-only control with a hover tooltip. The header carries eight things now, so
 *  everything that has a recognisable glyph loses its label to buy the space. */
function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="ibtn" onClick={onClick} aria-label={label} data-tip={label}>{children}</button>
  );
}

export function Header() {
  const s = useStore();
  const ui = useAppUi();
  const name = s.activeRoadmap().name;

  return (
    <div className="topbar-main">
      <a className="brandmark" href="/" title="Back to the roadmap">
        <Logo />
        <h1>{name} Roadmap</h1>
      </a>
      <div className="top-actions">
        {/* The same six destinations, in the same order, on every screen. See AppNav. */}
        <AppNav here={s.ui.view === "features" ? "features" : "board"}
          onBoard={() => s.setView("board")}
          onFeatures={() => s.setView("features")} />
        <SaveState />
        <span className="icon-group">
          <IconAction label="Activity" onClick={() => s.setActivityOpen(true)}><IcActivity /></IconAction>
          <IconAction label={`Theme: ${THEME_LABEL[s.ui.theme]}`} onClick={() => s.cycleTheme()}><ThemeIcon theme={s.ui.theme} /></IconAction>
          <IconAction label="Settings" onClick={ui.openSettings}><IcSettings /></IconAction>
          <UserButton />
        </span>
      </div>
    </div>
  );
}
