import React from "react";

const S = (
  props: React.SVGProps<SVGSVGElement>,
  d: React.ReactNode,
  stroke = true,
) => (
  <svg viewBox="0 0 24 24" fill={stroke ? "none" : "currentColor"} stroke={stroke ? "currentColor" : undefined}
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    {d}
  </svg>
);

export const IcTeam = (p: React.SVGProps<SVGSVGElement>) =>
  S(p, <><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="3.2" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M15.5 3.16a3.2 3.2 0 0 1 0 6.2" /></>);
export const IcChevron = (p: React.SVGProps<SVGSVGElement>) => S({ strokeWidth: 2.6, ...p } as never, <path d="M9 6l6 6-6 6" />);
export const IcTrash = (p: React.SVGProps<SVGSVGElement>) => S({ strokeWidth: 2.1, ...p } as never, <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />);
export const IcCheck = (p: React.SVGProps<SVGSVGElement>) => S({ strokeWidth: 3.4, ...p } as never, <path d="M5 12.5l4.5 4.5L19 7" />);
export const IcPlus = (p: React.SVGProps<SVGSVGElement>) => S({ strokeWidth: 2.6, ...p } as never, <path d="M12 5v14M5 12h14" />);
export const IcGrip = (p: React.SVGProps<SVGSVGElement>) => S(p, <><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></>, false);
export const IcAddSub = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M4 5h10M4 10h6" /><path d="M15 14v6M12 17h6" /></>);
export const IcPencil = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M4 20h4l10-10a2.6 2.6 0 0 0-3.7-3.7L4.3 16.3 4 20Z" /><path d="M13.5 6.5l4 4" /></>);
export const IcMoveTo = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M4 6h7M4 12h7M4 18h7" /><path d="M15 12h6M18 9l3 3-3 3" /></>);
export const IcCaretUp = (p: React.SVGProps<SVGSVGElement>) => S({ strokeWidth: 3, ...p } as never, <path d="M6 15l6-6 6 6" />);
export const IcCaretDown = (p: React.SVGProps<SVGSVGElement>) => S({ strokeWidth: 3, ...p } as never, <path d="M6 9l6 6 6-6" />);
export const IcClose = (p: React.SVGProps<SVGSVGElement>) => S({ strokeWidth: 2.2, ...p } as never, <path d="M6 6l12 12M18 6L6 18" />);
export const IcFilter = (p: React.SVGProps<SVGSVGElement>) => S(p, <path d="M3 5h18M6 12h12M10 19h4" />);
export const IcBoard = (p: React.SVGProps<SVGSVGElement>) => S(p, <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="14" rx="1" /></>);
export const IcClock = (p: React.SVGProps<SVGSVGElement>) => S(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const IcComment = (p: React.SVGProps<SVGSVGElement>) => S(p, <path d="M20 12a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-3.6A7.5 7.5 0 0 1 12.5 4.5 7.5 7.5 0 0 1 20 12z" />);
export const IcActivity = (p: React.SVGProps<SVGSVGElement>) => S(p, <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />);
export const IcCollapseAll = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M8 9l4-4 4 4" /><path d="M8 15l4 4 4-4" /></>);
export const IcExpandAll = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M8 5l4 4 4-4" /><path d="M8 19l4-4 4 4" /></>);
export const IcLink = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" /><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5L12 17" /></>);
export const IcAdmin = (p: React.SVGProps<SVGSVGElement>) => S(p, <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 9v11" /></>);
export const IcPalette = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.3-1.2-1.7-1.2-2.9 0-.8.7-1.3 1.6-1.3H16a5 5 0 0 0 5-5c0-4-4-7-9-7z" /><circle cx="7.8" cy="11.5" r="1.1" fill="currentColor" /><circle cx="11" cy="7.6" r="1.1" fill="currentColor" /><circle cx="15.6" cy="9.2" r="1.1" fill="currentColor" /></>);
export const IcPilots = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M3 20h18" /><rect x="5" y="11" width="4" height="9" rx="1" /><rect x="11" y="6" width="4" height="14" rx="1" /><rect x="17" y="14" width="4" height="6" rx="1" /></>);
export const IcRoadmap = (p: React.SVGProps<SVGSVGElement>) => S(p, <><path d="M4 7h8M4 12h16M4 17h6" /><circle cx="16" cy="7" r="1.7" /><circle cx="12" cy="17" r="1.7" /></>);
export const IcSettings = (p: React.SVGProps<SVGSVGElement>) => S(p, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);

export function ViewIcon({ id }: { id: string }) {
  const map: Record<string, React.ReactNode> = {
    timeline: <><path d="M4 6h10M4 12h16M4 18h7" /><circle cx="18" cy="6" r="1.6" /><circle cx="13" cy="18" r="1.6" /></>,
    simple: <path d="M5 6h14M5 12h14M5 18h9" />,
    teams: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M17 11a3 3 0 0 0 0-6" /><path d="M17.5 20a5.5 5.5 0 0 0-2.5-4.6" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M17 11a3 3 0 0 0 0-6" /><path d="M17.5 20a5.5 5.5 0 0 0-2.5-4.6" /></>,
    person: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    workload: <><path d="M4 19V5" /><rect x="7" y="12" width="3.5" height="7" /><rect x="13" y="8" width="3.5" height="11" /><rect x="19" y="14" width="1.5" height="5" /></>,
    swim: <><rect x="3" y="4" width="18" height="5" rx="1" /><rect x="3" y="10.5" width="18" height="5" rx="1" /><rect x="3" y="17" width="18" height="3.5" rx="1" /></>,
    board: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="14" rx="1" /></>,
    features: <><path d="M12 3l2.4 5.3 5.6.6-4.2 3.9 1.2 5.6L12 15.6 6.9 18.4l1.2-5.6L4 8.9l5.6-.6z" /></>,
    pilots: <><path d="M3 20h18" /><rect x="5" y="11" width="4" height="9" rx="1" /><rect x="11" y="7" width="4" height="13" rx="1" /><rect x="17" y="13" width="4" height="7" rx="1" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{map[id] || null}</svg>;
}

export function ThemeIcon({ theme }: { theme: "auto" | "light" | "dark" }) {
  const map = {
    auto: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>,
    light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></>,
    dark: <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{map[theme]}</svg>;
}

export function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 40 26" fill="none">
        <polygon points="2,20 20,20 27,12 9,12" fill="var(--ink)" />
        <polygon points="13,14 31,14 38,6 20,6" fill="#C8F980" />
      </svg>
    </span>
  );
}
