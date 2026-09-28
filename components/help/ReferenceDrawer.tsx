"use client";
import { useEffect, useMemo, useState } from "react";
import type { PilotStore } from "@/lib/types";
import { categoryReferences, coverage, discountBand, type CategoryReference } from "@/lib/help/references";

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
          {band ? `${band.mid}%` : "no discount logged"}
          {r.everyDays[0] ? ` · every ${r.everyDays[0]} days` : ""}
          {r.deliveries[0] ? ` · ${r.deliveries[0]} deliveries` : ""}
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
          <table className="hc-drawertable">
            <thead>
              <tr><th>Store</th><th>Discount</th><th>Frequency</th><th>Payment</th><th>Bundles</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const blank = (v: string | null | undefined) => {
                  const t = (v || "").trim();
                  return !t || t === "—" ? null : t;
                };
                const d = blank(p.discountMargin);
                const f = blank(p.frequency);
                const pay = blank(p.paymentType);
                return (
                  <tr key={p.id} className={!d && !f && !pay ? "hc-drawergap" : ""}>
                    <td><b>{p.name}</b></td>
                    <td>{d || <i>not logged</i>}</td>
                    <td>{f || <i>not logged</i>}</td>
                    <td>{pay || <i>not logged</i>}</td>
                    <td>{blank(p.bundles) || <i>&mdash;</i>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
