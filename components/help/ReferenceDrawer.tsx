"use client";
import { useEffect, useMemo, useState } from "react";
import type { PilotStore } from "@/lib/types";
import {
  categoryReferences, coverage, discountBand, freqLabel, parseDiscounts, parsePlans,
  type CategoryReference,
} from "@/lib/help/references";
import { REFERENCE_SNAPSHOT, REFERENCE_SNAPSHOT_TAKEN } from "@/lib/help/reference-snapshot";

/** What our live stores run, by category, read off the store rows as the page renders.
 *
 *  A merchant on a call asks one question: what do stores like mine do. So the category is
 *  the first choice and the only navigation — a rail across the top, biggest group first —
 *  and everything under it belongs to that category. It was a stack of collapsed accordions,
 *  which made the reader open categories to find out whether theirs was in the list at all.
 *
 *  Written for the merchant, not for us: no "pilot", no "cohort", no "logged", and nothing
 *  about activation state, open bugs or who runs the account here. A store whose plan
 *  columns are empty is still listed, with what we do have, because a list that quietly
 *  omits half the stores reads as a complete answer. */
export default function ReferenceDrawer({ pilots, onClose, anonymous }: {
  pilots: PilotStore[];
  onClose: () => void;
  /** No store named. On `/help` and on the merchant link the reader is a merchant, and a
   *  list of other merchants with their discounts and subscriber counts beside them is a
   *  commercial disclosure nobody agreed to. Categories answer the question either way. */
  anonymous?: boolean;
}) {
  const refs = useMemo(() => categoryReferences(pilots), [pilots]);
  const [pick, setPick] = useState<string | null>(refs[0]?.label ?? null);
  const cat = refs.find((r) => r.label === pick) ?? refs[0] ?? null;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const withPlans = refs.reduce((n, r) => n + r.stores.length - r.unlogged.length, 0);
  const total = refs.reduce((n, r) => n + r.stores.length, 0);
  /* Nothing to read off this page: `/help` has no signed-in store list, and that is exactly
     where the merchant link points. The snapshot is the same answer, by category. */
  if (!refs.length || anonymous) return <Snapshot onClose={onClose} />;

  return (
    <div className="hc-drawerwrap" role="dialog" aria-modal="true" aria-label="What our live stores run">
      <div className="hc-drawerscrim" onClick={onClose} role="presentation" />
      <aside className="hc-drawer">
        <header className="hc-drawerh">
          <div>
            <b>What our live stores run</b>
            <span>{total} stores across {refs.length} categories, {withPlans} with their plans set up.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">&times;</button>
        </header>

        {/* The category IS the navigation: find yours, read the stores under it. */}
        <nav className="hc-drawerrail" aria-label="Categories">
          {refs.map((r) => (
            <button key={r.label} type="button"
              className={"hc-drawercat" + (cat?.label === r.label ? " on" : "")}
              aria-pressed={cat?.label === r.label}
              onClick={() => setPick(r.label)}>
              {r.label}<em>{r.stores.length}</em>
            </button>
          ))}
        </nav>

        <div className="hc-drawerbody">
          {!refs.length && (
            <p className="hc-note">
              No stores are loaded on this page. Open the Help Centre from inside the
              Pilots screen and they come with it.
            </p>
          )}
          {cat && <Category r={cat} pilots={pilots} />}
        </div>
      </aside>
    </div>
  );
}

function Category({ r, pilots }: { r: CategoryReference; pilots: PilotStore[] }) {
  const band = discountBand(r);
  const thin = coverage(r) < 0.34;
  const rows = pilots.filter((p) => (p.category || "").trim() === r.label);
  const set = rows.length - r.unlogged.length;

  return (
    <>
      {/* The category in one line, before the stores: it is the answer most calls need, and
          the stores under it are the working. */}
      <p className="hc-drawersum">
        {r.everyDays[0]
          ? <>Most of them deliver <b>{freqLabel(r.everyDays[0]).toLowerCase()}</b></>
          : <>None of them has a delivery schedule set yet</>}
        {r.deliveries.length > 0 && <>, sold at <b>{r.deliveries.slice(0, 4).sort((a, b) => a - b).join(", ")} deliveries</b></>}
        {band && <>, discounting <b>{band.low === band.high ? `${band.mid}%` : `${band.low} to ${band.high}%`}</b></>}
        .
      </p>
      {thin && (
        <p className="hc-drawerthin">
          {set} of {r.stores.length} {set === 1 ? "store has" : "stores have"} their plans set up, so read
          this as one or two stores rather than as the category.
        </p>
      )}
      <ul className="hc-drawerstores">
        {rows.map((p) => <StoreCard key={p.id} p={p} />)}
      </ul>
    </>
  );
}

/** One store's plan, parsed out of the sheet's free-text columns and said plainly.
 *
 *  The columns are `Monthly - 3, 6, 9` and `25%`, which is a plan ladder written as two
 *  cells. A reference list that shows the cells makes every reader parse them again. */
function planOf(p: PilotStore) {
  const clean = (v: string | null | undefined) => {
    const t = (v || "").trim();
    return !t || t === "—" ? null : t;
  };
  const plans = parsePlans(p.frequency);
  const d = parseDiscounts(p.discountMargin);
  /* One line per clause, each cadence with its OWN run lengths. */
  const lines = plans.flatMap((pl) =>
    (pl.everyDays.length ? pl.everyDays : [0]).map((days) => {
      const cadence = days ? freqLabel(days) : "Schedule not set";
      return pl.deliveries.length
        ? `${cadence} · ${[...pl.deliveries].sort((a, b) => a - b).join(", ")} deliveries`
        : cadence;
    }));
  const num = (v: number | null | undefined) => (v == null ? null : String(v));
  const fields: [string, string | null][] = [
    ["their plans", plans.length ? "x" : null],
    ["their discount", d.length ? "x" : null],
    ["how it is paid for", clean(p.paymentType)],
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
    subs: num(p.activeSubs) ? `${p.activeSubs} of ${p.totalSubs ?? "?"} live` : null,
    missing: fields.filter(([, v]) => !v).map(([k]) => k),
  };
}

/** One store, as a card: the plans it sells, what each one saves, how it is paid for and
 *  what shipping costs. Its activation state, its open bugs and who runs it here are ours
 *  and not a merchant's business, so they are off this card.
 *
 *  A field nobody has filled in is shown as a gap rather than omitted, because a reference
 *  that quietly drops what it does not know reads as a complete answer. */
function StoreCard({ p }: { p: PilotStore }) {
  const plan = planOf(p);

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
        <Fact k="Subscribers" v={plan.subs} />
      </dl>

      {plan.missing.length > 0 && (
        <p className="hc-scardgap">We do not have {plan.missing.join(", ")} for this store yet.</p>
      )}
    </li>
  );
}

function Fact({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return <div><dt>{k}</dt><dd>{v}</dd></div>;
}

/** The same question answered by category, with nobody named.
 *
 *  Generated by `scripts/snapshot-references.ts` from the live rows, because the page this
 *  renders on has no store list to read and because the reader here is a merchant. */
function Snapshot({ onClose }: { onClose: () => void }) {
  const [pick, setPick] = useState(REFERENCE_SNAPSHOT[0]?.label ?? "");
  const r = REFERENCE_SNAPSHOT.find((x) => x.label === pick) ?? REFERENCE_SNAPSHOT[0];
  const total = REFERENCE_SNAPSHOT.reduce((n, x) => n + x.stores, 0);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="hc-drawerwrap" role="dialog" aria-modal="true" aria-label="What our live stores run">
      <div className="hc-drawerscrim" onClick={onClose} role="presentation" />
      <aside className="hc-drawer">
        <header className="hc-drawerh">
          <div>
            <b>What our live stores run</b>
            <span>{total} stores with their plans set up, across {REFERENCE_SNAPSHOT.length} categories.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">&times;</button>
        </header>

        <nav className="hc-drawerrail" aria-label="Categories">
          {REFERENCE_SNAPSHOT.map((x) => (
            <button key={x.label} type="button"
              className={"hc-drawercat" + (r?.label === x.label ? " on" : "")}
              aria-pressed={r?.label === x.label}
              onClick={() => setPick(x.label)}>
              {x.label}<em>{x.stores}</em>
            </button>
          ))}
        </nav>

        <div className="hc-drawerbody">
          {r && (
            <>
              <p className="hc-drawersum">
                {r.everyDays[0]
                  ? <>Most of them deliver <b>{freqLabel(r.everyDays[0]).toLowerCase()}</b></>
                  : <>None of them has a delivery schedule set</>}
                {r.everyDays[1] && <>, and some <b>{freqLabel(r.everyDays[1]).toLowerCase()}</b></>}
                {r.deliveries.length > 0 && <>, sold at <b>{r.deliveries.slice(0, 4).sort((a, b) => a - b).join(", ")} deliveries</b></>}
                {r.discountLow != null && (
                  <>, discounting <b>{r.discountLow === r.discountHigh ? `${r.discountLow}%` : `${r.discountLow} to ${r.discountHigh}%`}</b></>
                )}
                .
              </p>
              <p className="hc-drawerthin">
                Based on {r.stores} {r.stores === 1 ? "store" : "stores"} in this category. We do not name
                stores here; ask us on a call if you want a like-for-like comparison.
              </p>
            </>
          )}
          <p className="hc-note">Read from our live stores on {REFERENCE_SNAPSHOT_TAKEN}.</p>
        </div>
      </aside>
    </div>
  );
}
