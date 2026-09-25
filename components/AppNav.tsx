"use client";
import { useStore } from "@/lib/store";
import { IcAdmin, IcBoard, IcHelp, IcPalette, IcPilots, ViewIcon } from "./icons";

/** One menu, the same on every screen.
 *
 *  The roadmap header carried Features backlog, UI/UX work, Merchant UI and Pilots; the
 *  pilots header carried Roadmap and Help Center. Six destinations, two of which you could
 *  only reach from one of the two screens, and neither header told you where you were. This
 *  is all six, in one order, everywhere, with the current one marked.
 *
 *  `here` is which of them this screen is. `onHelp` is passed only by a screen that can show
 *  the Help Centre in place rather than navigating to it. */
export type NavHere = "board" | "features" | "pilots" | "help";

export function AppNav({ here, onHelp, onBoard, onFeatures }: {
  here: NavHere;
  onHelp?: () => void;
  onBoard?: () => void;
  onFeatures?: () => void;
}) {
  const s = useStore();
  const cls = (on: boolean) => `btn ghost${on ? " on" : ""}`;

  return (
    <>
      {onBoard
        ? <button type="button" className={cls(here === "board")} onClick={onBoard}>
            <IcBoard /><span>Board</span>
          </button>
        : <a className={cls(here === "board")} href="/" title="The work board"><IcBoard /><span>Board</span></a>}

      {onFeatures
        ? <button type="button" className={cls(here === "features")} onClick={onFeatures}>
            <ViewIcon id="features" /><span>Features backlog</span>
          </button>
        : <a className={cls(here === "features")} href="/?view=features" title="The pilot sheet's feature list">
            <ViewIcon id="features" /><span>Features backlog</span>
          </a>}

      <a className={cls(here === "pilots")} href="/pilots" title="Pilot stores: the activation log">
        <IcPilots /><span>Pilots</span>
      </a>

      {onHelp
        ? <button type="button" className={cls(here === "help")} aria-pressed={here === "help"} onClick={onHelp}>
            <IcHelp /><span>Help Centre</span>
          </button>
        : <a className={cls(here === "help")} href="/pilots?help=1" title="Setup, the how-to guides and the answers">
            <IcHelp /><span>Help Centre</span>
          </a>}

      <a className="btn ghost" href={s.uiuxUrl} target="_blank" rel="noreferrer"
        title={`Open the UI/UX work surface (${s.uiuxUrl})`}>
        <IcPalette /><span>UI/UX work</span>
      </a>
      <a className="btn ghost" href={s.adminUrl} target="_blank" rel="noreferrer"
        title={`Open the merchant admin (${s.adminUrl})`}>
        <IcAdmin /><span>Merchant UI</span>
      </a>
    </>
  );
}
