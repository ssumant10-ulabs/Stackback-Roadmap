"use client";
import { useMemo, useState } from "react";
import type { PilotStore } from "@/lib/types";
import {
  byFrequency, categoryReferences, coverage, discountBand, median,
  type CategoryReference,
} from "@/lib/help/references";

/** What the cohort runs, by category. Its own item rather than a panel inside the plan
 *  wizard: it is the thing worth sending somebody on its own, and burying it under a "what
 *  other stores are doing" button is how nobody read it.
 *
 *  Everything here is derived from the pilot rows at render, so it is whatever the team last
 *  typed into the Pilots tab. Nothing is copied into this file and nothing can go stale.
 *  Where a category is thinly logged it says so instead of quoting a median over three rows:
 *  a reference nobody can check is worse than a gap somebody can fill. */
export default function References({ pilots = [] }: { pilots?: PilotStore[] }) {
  const refs = useMemo(() => categoryReferences(pilots), [pilots]);
  const [open, setOpen] = useState<string | null>(null);

  if (!pilots.length) {
    return (
      <section>
        <h1 className="hc-h1">Category references</h1>
        <div className="hc-empty">
          <p>
            These are read off the pilot rows, and this page is not holding any. Open the Help
            Centre from inside the Pilots screen and they come with it.
          </p>
        </div>
      </section>
    );
  }

  const logged = refs.reduce((n, r) => n + r.stores.length - r.unlogged.length, 0);
  const total = refs.reduce((n, r) => n + r.stores.length, 0);

  return (
    <section>
      <h1 className="hc-h1">Category references</h1>
      <p className="hc-blurb">
        What the pilot cohort actually runs, by category. Read off the Pilots tab as it stands
        right now, so it is whatever the team last logged: {logged} of {total} stores have
        their plan columns filled in.
      </p>

      <div className="hc-refgrid">
        {refs.map((r) => (
          <Ref key={r.label} r={r} open={open === r.label} onToggle={() => setOpen(open === r.label ? null : r.label)} />
        ))}
      </div>

      <p className="hc-note hc-reffoot">
        A category with few rows logged is marked thin rather than averaged. The numbers are
        parsed out of the sheet&rsquo;s free-text columns, so a cell written in a shape nobody
        has used before is counted as unread, never as zero.
      </p>
    </section>
  );
}

function Ref({ r, open, onToggle }: { r: CategoryReference; open: boolean; onToggle: () => void }) {
  const band = discountBand(r);
  const cov = coverage(r);
  const thin = cov < 0.34;
  const every = r.everyDays[0];
  const run = r.deliveries[0];
  const pay = topPayment(r);

  return (
    <article className={"hc-ref" + (open ? " on" : "")}>
      <button type="button" className="hc-refh" onClick={onToggle} aria-expanded={open}>
        <b>{r.label}</b>
        <em>{r.stores.length} store{r.stores.length === 1 ? "" : "s"}</em>
      </button>

      <dl className="hc-reffacts">
        <div><dt>Discount</dt><dd>{band ? `${band.mid}%${band.low !== band.high ? `, ${band.low} to ${band.high}` : ""}` : <span className="hc-refgap">not logged</span>}</dd></div>
        <div><dt>Every</dt><dd>{every ? `${every} days` : <span className="hc-refgap">not logged</span>}</dd></div>
        <div><dt>Run</dt><dd>{run ? `${run} deliveries` : <span className="hc-refgap">not logged</span>}</dd></div>
        <div><dt>Paid</dt><dd>{pay || <span className="hc-refgap">not logged</span>}</dd></div>
        <div><dt>Bundles</dt><dd>{r.bundles ? `${r.bundles} of ${r.stores.length}` : "none"}</dd></div>
      </dl>

      {thin && (
        <p className="hc-refthin">
          Thin: {r.stores.length - r.unlogged.length} of {r.stores.length} logged. Read it as
          one or two stores, not as the category.
        </p>
      )}

      {open && (
        <div className="hc-refopen">
          {r.discounts.length > 1 && (
            <p className="hc-refline">
              <b>Every discount logged:</b> {[...r.discounts].sort((a, b) => a - b).map((d) => `${d}%`).join(", ")}
              {" "}(median {median(r.discounts)}%).
            </p>
          )}
          {r.everyDays.length > 1 && (
            <p className="hc-refline"><b>Cadences in use:</b> {byFrequency(r.everyDays).map((d) => `${d} days`).join(", ")}.</p>
          )}
          {r.deliveries.length > 1 && (
            <p className="hc-refline"><b>Run lengths in use:</b> {byFrequency(r.deliveries).join(", ")} deliveries.</p>
          )}
          <p className="hc-refline"><b>Stores:</b> {r.stores.join(", ")}.</p>
          {r.unlogged.length > 0 && (
            <p className="hc-refline hc-refgap"><b>Nothing logged yet:</b> {r.unlogged.join(", ")}.</p>
          )}
        </div>
      )}
    </article>
  );
}

function topPayment(r: CategoryReference): string | null {
  const { prepaid, payg, both } = r.payment;
  if (!prepaid && !payg && !both) return null;
  const parts: string[] = [];
  if (prepaid) parts.push(`${prepaid} prepaid`);
  if (payg) parts.push(`${payg} pay as you go`);
  if (both) parts.push(`${both} both`);
  return parts.join(", ");
}
