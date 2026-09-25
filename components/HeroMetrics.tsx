"use client";
import { useStore } from "@/lib/store";
import type { Stage } from "@/lib/board";

/** The header, counting the board rather than the tree.
 *
 *  It used to be four horizon counts, a three-segment bar, a pip per milestone and three
 *  totals: eleven numbers describing how much work exists. None of them answered the question
 *  somebody opening this screen actually has, which is where the work is right now. These
 *  five are the board's own stages, grouped, and every one is a column you can go and look
 *  at, so a number here and a column there can never disagree. */
const GROUPS: { key: string; label: string; stages: Stage[] }[] = [
  { key: "bugs", label: "Bugs posted", stages: ["bug"] },
  { key: "features", label: "Features posted", stages: ["feature"] },
  { key: "design", label: "Design in progress", stages: ["design_progress", "design_review"] },
  { key: "dev", label: "With dev", stages: ["design_to_dev", "dev_progress", "dev_review"] },
  { key: "prod", label: "Pushed to prod", stages: ["prod"] },
];

export function HeroMetrics() {
  const s = useStore();
  const cards = s.boardCards();

  const n = (stages: Stage[]) => cards.filter((c) => stages.includes(c.stage)).length;
  const total = cards.length;
  const shipped = n(["prod"]);
  const pct = total ? Math.round((shipped / total) * 100) : 0;

  return (
    <div className="hero-metrics hm-flat">
      <div className="hm-lead">
        <span className="hm-pct">{pct}%</span>
        <span className="lbl">in production</span>
      </div>
      <div className="hm-groups">
        {GROUPS.map((g) => (
          <div className="hm-group" key={g.key}>
            <b>{n(g.stages)}</b><span>{g.label}</span>
          </div>
        ))}
      </div>
      <div className="hm-stats">
        <div className="hm-stat"><b>{total}</b><span>Cards</span></div>
      </div>
    </div>
  );
}
