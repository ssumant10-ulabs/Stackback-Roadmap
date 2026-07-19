"use client";
import { useStore } from "@/lib/store";
import { IcSettings, Logo, ThemeIcon } from "./icons";
import { useAppUi } from "./appui";

const THEME_LABEL = { auto: "Auto", light: "Light", dark: "Dark" } as const;

export function Header() {
  const s = useStore();
  const ui = useAppUi();
  const name = s.activeRoadmap().name;
  return (
    <div className="topbar-main">
      <div className="brandmark">
        <Logo />
        <div>
          <h1>{name} Roadmap</h1>
          <div className="sub">
            <span className="tag">One roadmap. Zero chaos.</span> &nbsp;Owners, milestones and progress across the team.
          </div>
        </div>
      </div>
      <div className="top-actions">
        <button className="btn ghost" aria-label="Theme" title={`Theme: ${THEME_LABEL[s.ui.theme]}`} onClick={() => s.cycleTheme()}>
          <ThemeIcon theme={s.ui.theme} /><span>{THEME_LABEL[s.ui.theme]}</span>
        </button>
        <button className="btn ghost" title="Settings" onClick={ui.openSettings}>
          <IcSettings /> Settings
        </button>
      </div>
    </div>
  );
}
