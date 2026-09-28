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
            {rows.map((p) => <StoreCard key={p.id} p={p} />)}
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
function planOf(p: PilotStore) {
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
  const num = (v: number | null | undefined) => (v == null ? null : String(v));
  const fields: [string, string | null][] = [
    ["the plans", plans.length ? "x" : null],
    ["the discount", d.length ? "x" : null],
    ["payment", clean(p.paymentType)],
    ["shipping", clean(p.shipping)],
    ["bundles", clean(p.bundles)],
  ];

  return {
    logged: Boolean(plans.length || d.length || clean(p.paymentType)),
    lines,
    discount: d.length ? Math.max(...d) : null,
    payment: clean(p.paymentType),
    bundles: clean(p.bundles),
    shipping: clean(p.shipping),
    theme: clean(p.themeNotes),
    status: clean(p.activationStatus) || clean(p.status),
    poc: clean(p.poc),
    subs: num(p.activeSubs) ? `${p.activeSubs} active of ${p.totalSubs ?? "?"}` : null,
    bugs: p.openBugs ? String(p.openBugs) : null,
    notes: clean(p.activationNotes) || clean(p.overviewNotes),
    missing: fields.filter(([, v]) => !v).map(([k]) => k),
    raw: raws || "",
  };
}

/** One store, as a card, with everything the app holds about how it sells.
 *
 *  A row of five cells made you read the sheet again. This is the store's setup as it would
 *  be described on a call: the plans it offers, what each one saves, how it is paid for,
 *  what shipping costs, whether bundles are on, and the state of its pilot. A field nobody
 *  has filled in is shown as a gap rather than omitted, because a reference that quietly
 *  drops what it does not know reads as a complete answer. */
function StoreCard({ p }: { p: PilotStore }) {
  const plan = planOf(p);
  const gaps = plan.missing;

  return (
    <li className={"hc-scard" + (plan.logged ? "" : " empty")}>
      <div className="hc-scardh">
        <b>{p.name}</b>
        {plan.discount != null && <span className="hc-drawerpct">up to {plan.discount}% off</span>}
      </div>

      {plan.lines.length > 0 && (
        <ul className="hc-drawerplans">
          {plan.lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}

      <dl className="hc-scardfacts">
        <Fact k="Payment" v={plan.payment} />
        <Fact k="Bundles" v={plan.bundles} />
        <Fact k="Shipping" v={plan.shipping} />
        <Fact k="Theme" v={plan.theme} />
        <Fact k="Status" v={plan.status} />
        <Fact k="POC" v={plan.poc} />
        <Fact k="Live subs" v={plan.subs} />
        <Fact k="Open bugs" v={plan.bugs} />
      </dl>

      {plan.notes && <p className="hc-scardnote">{plan.notes}</p>}
      {plan.raw && <p className="hc-drawerraw">{plan.raw}</p>}
      {gaps.length > 0 && (
        <p className="hc-scardgap">Not logged yet: {gaps.join(", ")}.</p>
      )}
    </li>
  );
}

function Fact({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return <div><dt>{k}</dt><dd>{v}</dd></div>;
}
