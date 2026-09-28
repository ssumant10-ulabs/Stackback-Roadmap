"use client";
import { useStore } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import { IcBoard, IcHelp, IcPalette, IcPilots } from "./icons";

/** One menu, the same on every screen.
 *
 *  Four entries, one order, everywhere, with the current one marked. The backlog left the
 *  menu when it became a board tab: it is a column set over the same cards, not a place.
 *  Design holds both surfaces, because the storefront work and the merchant admin are the
 *  same job at two ends and were sitting as two peers of the roadmap.
 *
 *  `here` is which of them this screen is. `onHelp` is passed only by a screen that can show
 *  the Help Centre in place rather than navigating to it. */
export type NavHere = "roadmap" | "pilots" | "help";

export function AppNav({ here, onHelp, onBoard }: {
  here: NavHere;
  onHelp?: () => void;
  onBoard?: () => void;
}) {
  const s = useStore();
  const cls = (on: boolean) => `btn ghost${on ? " on" : ""}`;

  const [designOpen, setDesignOpen] = useState(false);
  const designRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!designOpen) return;
    const away = (e: MouseEvent) => {
      if (!designRef.current?.contains(e.target as HTMLElement)) setDesignOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDesignOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [designOpen]);

  return (
    <>
      {onBoard
        ? <button type="button" className={cls(here === "roadmap")} onClick={onBoard}>
            <IcBoard /><span>Roadmap</span>
          </button>
        : <a className={cls(here === "roadmap")} href="/" title="The work board"><IcBoard /><span>Roadmap</span></a>}

      {/* One Design entry holding the two surfaces, because they are the same job at two
          ends: the storefront work and the merchant admin. They were two peers of Roadmap. */}
      {/* Opens on hover, closes on a click elsewhere or Escape, never on the cursor leaving
          it: a menu that vanishes on the way to the thing you are reaching for cannot be
          used with a mouse at all. */}
      <span className="nav-group" ref={designRef}>
        <button type="button" className={cls(false)} aria-expanded={designOpen}
          onClick={() => setDesignOpen((v) => !v)} onMouseEnter={() => setDesignOpen(true)}>
          <IcPalette /><span>Design</span>
        </button>
        {designOpen && (
          <span className="nav-menu">
            <a href={s.uiuxUrl} target="_blank" rel="noreferrer" onClick={() => setDesignOpen(false)}>
              <b>Frontend design</b><em>UI/UX work</em>
            </a>
            <a href={s.adminUrl} target="_blank" rel="noreferrer" onClick={() => setDesignOpen(false)}>
              <b>Backend design</b><em>Merchant UI</em>
            </a>
          </span>
        )}
      </span>

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
    </>
  );
}
