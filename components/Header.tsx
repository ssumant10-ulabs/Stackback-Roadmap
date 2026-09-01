"use client";
import { useStore } from "@/lib/store";
import { UserButton } from "./UserButton";
import { firebaseEnabled } from "@/lib/firebase";
import { IcActivity, IcAdmin, IcPalette, IcPilots, IcSettings, Logo, ThemeIcon, ViewIcon } from "./icons";
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
        <button className={`btn ghost${s.ui.view === "features" ? " on" : ""}`} title="The pilot sheet's feature list"
          onClick={() => s.setView(s.ui.view === "features" ? "timeline" : "features")}>
          <ViewIcon id="features" /><span>Features</span>
        </button>
        <a className="btn ghost" href={s.uiuxUrl} target="_blank" rel="noreferrer"
          title={`Open the UI/UX work surface (${s.uiuxUrl})`}>
          <IcPalette /><span>UI/UX work</span>
        </a>
        <a className="btn ghost" href={s.adminUrl} target="_blank" rel="noreferrer"
          title={`Open the merchant admin (${s.adminUrl})`}>
          <IcAdmin /><span>Merchant UI</span>
        </a>
        <a className="btn ghost" href="/pilots" title="Pilot stores: activation log and stats">
          <IcPilots /><span>Pilots</span>
        </a>
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
