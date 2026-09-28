"use client";
import { useEffect, useMemo, useState } from "react";
import type { PilotStore } from "@/lib/types";
import {
  categoryReferences, coverage, discountBand, freqLabel, parseDiscounts, parsePlans,
  type CategoryReference,
} from "@/lib/help/references";

/** Every pilot store and what it runs, by category, in a drawer.
 *
 *  The panel beside the form answers "what does my category do"; this answers "show me all of
 *  them", which is the question on a call when a merchant says their category is different.
 *  A drawer rather than a page because it is something you glance at mid-form and close.
 *
 *  Read off the pilot rows at open, so it is whatever the team last logged. A store with
 *  nothing in its plan columns is listed with the gap rather than left out: a reference list
 *  that quietly omits half the cohort is worse than one that shows the holes. */
export default function ReferenceDrawer({ pilots, onClose }: {
  pilots: PilotStore[];
  onClose: () => void;
}) {
  const refs = useMemo(() => categoryReferences(pilots), [pilots]);
  const [open, setOpen] = useState<string | null>(refs[0]?.label ?? null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const logged = refs.reduce((n, r) => n + r.stores.length - r.unlogged.length, 0);
  const total = refs.reduce((n, r) => n + r.stores.length, 0);

  return (
    <div className="hc-drawerwrap" role="dialog" aria-modal="true" aria-label="What every store runs">
      <div className="hc-drawerscrim" onClick={onClose} role="presentation" />
      <aside className="hc-drawer">
        <header className="hc-drawerh">
          <div>
            <b>What every store runs</b>
            <span>{total} pilot stores, {logged} with their plan columns filled in.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">&times;</button>
        </header>

        <div className="hc-drawerbody">
          {!refs.length && (
            <p className="hc-note">
              No pilot rows are loaded on this page. Open the Help Centre from inside the
              Pilots screen and they come with it.
            </p>
          )}
          {refs.map((r) => (
            <Cat key={r.label} r={r} pilots={pilots}
              open={open === r.label} onToggle={() => setOpen(open === r.label ? null : r.label)} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function Cat({ r, pilots, open, onToggle }: {
  r: CategoryReference; pilots: PilotStore[]; open: boolean; onToggle: () => void;
}) {
  const band = discountBand(r);
  const thin = coverage(r) < 0.34;
  const rows = pilots.filter((p) => (p.category || "").trim() === r.label);

  return (
    <section className={"hc-drawercat" + (open ? " on" : "")}>
      <button type="button" className="hc-drawercath" onClick={onToggle} aria-expanded={open}>
        <b>{r.label}</b>
        <em>{r.stores.length}</em>
        <span>
          {r.everyDays[0] ? freqLabel(r.everyDays[0]) : "cadence not logged"}
          {r.deliveries.length ? ` · ${[...r.deliveries].sort((a, b) => a - b).join(", ")} deliveries` : ""}
          {band ? ` · ${band.low === band.high ? band.mid : `${band.low} to ${band.high}`}%` : ""}
        </span>
      </button>

      {open && (
        <>
          {thin && (
            <p className="hc-drawerthin">
              {r.stores.length - r.unlogged.length} of {r.stores.length} logged. Read the
              summary as one or two stores, not as the category.
            </p>
          )}
          <ul className="hc-drawerstores">
            {rows.map((p) => {
              const plan = planOf(p);
              return (
                <li key={p.id} className={plan.logged ? "" : "hc-drawergap"}>
                  <div className="hc-drawerstoreh">
                    <b>{p.name}</b>
                    {plan.discount != null && <span className="hc-drawerpct">{plan.discount}% off</span>}
                  </div>
                  {plan.logged ? (
                    <>
                      {/* The plans, one line each, the way a merchant would be offered them:
                          every run length at the cadence it is sold at. The raw cell is
                          underneath, because a parser reading a free-text column has to show
                          its working. */}
                      <ul className="hc-drawerplans">
                        {plan.lines.length
                          ? plan.lines.map((l) => <li key={l}>{l}</li>)
                          : <li className="hc-drawerunknown">Cadence logged, no run lengths</li>}
                      </ul>
                      <p className="hc-drawermeta">
                        {[plan.payment, plan.bundles ? `bundles: ${plan.bundles}` : null, plan.shipping]
                          .filter(Boolean).join(" \u00b7 ") || "no payment or shipping logged"}
                      </p>
                      <p className="hc-drawerraw">{plan.raw}</p>
                    </>
                  ) : (
                    <p className="hc-drawermeta">Nothing logged in the plan columns yet.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** One store's plan, parsed out of the sheet's free-text columns and said plainly.
 *
 *  The columns are `Monthly - 3, 6, 9` and `25%`, which is a plan ladder written as two
 *  cells. A reference list that shows the cells makes every reader parse them again. */
function planOf(p: PilotStore): {
  logged: boolean; lines: string[]; discount: number | null;
  payment: string | null; bundles: string | null; shipping: string | null; raw: string;
} {
  const clean = (v: string | null | undefined) => {
    const t = (v || "").trim();
    return !t || t === "\u2014" ? null : t;
  };
  const plans = parsePlans(p.frequency);
  const d = parseDiscounts(p.discountMargin);
  const raws = [clean(p.frequency), clean(p.discountMargin)].filter(Boolean).join("  \u00b7  ");
  /* One line per clause, each cadence with its OWN run lengths. */
  const lines = plans.flatMap((pl) =>
    (pl.everyDays.length ? pl.everyDays : [0]).map((days) => {
      const cadence = days ? freqLabel(days) : "Cadence not logged";
      return pl.deliveries.length
        ? `${cadence} \u00b7 ${[...pl.deliveries].sort((a, b) => a - b).join(", ")} deliveries`
        : cadence;
    }));
  return {
    logged: Boolean(plans.length || d.length || clean(p.paymentType)),
    lines,
    discount: d.length ? Math.max(...d) : null,
    payment: clean(p.paymentType),
    bundles: clean(p.bundles),
    shipping: clean(p.shipping) ? `shipping: ${clean(p.shipping)}` : null,
    raw: raws || "",
  };
}
