"use client";
import { useEffect, useMemo, useState } from "react";
import type { PilotStore } from "@/lib/types";
import {
  categoryReferences, discountBand, freqLabel, parseDiscounts, parsePlans,
  paymentLabel, shippingLabel, type CategoryReference,
} from "@/lib/help/references";
import { REFERENCE_SNAPSHOT, REFERENCE_SNAPSHOT_TAKEN, type ReferenceSnapshotStore } from "@/lib/help/reference-snapshot";

/** Every store the snapshot names, by lowercased name, so a row handed to this drawer can be
 *  filled in from the live read when the screen that handed it over has nothing. */
const SNAPSHOT_BY_NAME = new Map<string, ReferenceSnapshotStore>(
  REFERENCE_SNAPSHOT.flatMap((c) => c.named.map((st) => [st.name.trim().toLowerCase(), st] as const)),
);

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

  /* Counted over what the cards actually show, not over the page's own columns. The cards
     fill from the live read where the page has nothing, so counting the page said "11 with
     their plans" above a list where forty of them had plans printed underneath. */
  const total = refs.reduce((n, r) => n + r.stores.length, 0);
  const withPlans = pilots.filter((p) => planOf(p).logged).length;
  /* Nothing to read off this page: `/help` has no signed-in store list, and that is exactly
     where the merchant link points. The snapshot is the same answer, by category. */
  if (!refs.length || anonymous) return <Snapshot onClose={onClose} />;

  return (
    <div className="hc-drawerwrap" role="dialog" aria-modal="true" aria-label="What some of our live stores run on">
      <div className="hc-drawerscrim" onClick={onClose} role="presentation" />
      <aside className="hc-drawer">
        <header className="hc-drawerh">
          <div>
            <b>Here&rsquo;s what some of our live stores run on</b>
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
  const rows = pilots.filter((p) => (p.category || "").trim() === r.label);
  /* The summary follows whichever source knows more about this category. The page's rows are
     fresher when they are filled in; the snapshot is a live read and covers the categories
     the page happens to be thin on, which locally is all of them. */
  const snap = REFERENCE_SNAPSHOT.find((x) => x.label === r.label);
  const pageSet = rows.length - r.unlogged.length;
  const useSnap = Boolean(snap && snap.withPlans > pageSet);
  const everyDays = useSnap ? snap!.everyDays : r.everyDays;
  const deliveries = useSnap ? snap!.deliveries : r.deliveries;
  const pageBand = discountBand(r);
  const band = useSnap && snap!.discountLow != null
    ? { low: snap!.discountLow, mid: snap!.discountLow, high: snap!.discountHigh ?? snap!.discountLow }
    : pageBand;
  const set = useSnap ? snap!.withPlans : pageSet;
  const of = useSnap ? snap!.stores : rows.length;
  const thin = of > 0 && set / of < 0.34;

  return (
    <>
      {/* The category in one line, before the stores: it is the answer most calls need, and
          the stores under it are the working. */}
      <p className="hc-drawersum">
        {everyDays[0]
          ? <>Most of them deliver <b>{freqLabel(everyDays[0]).toLowerCase()}</b></>
          : <>None of them has a delivery schedule set yet</>}
        {deliveries.length > 0 && <>, sold at <b>{deliveries.slice(0, 4).sort((a, b) => a - b).join(", ")} deliveries</b></>}
        {band && <>, discounting <b>{band.low === band.high ? `${band.mid}%` : `${band.low} to ${band.high}%`}</b></>}
        .
      </p>
      {thin && (
        <p className="hc-drawerthin">
          {set} of {of} {set === 1 ? "store has" : "stores have"} their plans set up, so read
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
  /* The page's own row first, the snapshot behind it, field by field.
   *
   *  The rows this drawer is handed come from whatever screen opened it, and that is not
   *  always the live sheet: locally it is the seed, where most plan columns are blank, so
   *  every store read "we do not have their plans yet" while the live data sat in the
   *  snapshot beside it. The page row still wins where it has something, because on the live
   *  Pilots screen it is fresher than a file generated last Tuesday. */
  const snap = SNAPSHOT_BY_NAME.get((p.name || "").trim().toLowerCase());
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
  const snapLines = (snap?.plans || []).map((pl) =>
    pl.deliveries.length
      ? `${pl.cadence ?? "Schedule not set"} \u00b7 ${pl.deliveries.join(", ")} deliveries`
      : (pl.cadence ?? "Schedule not set"));

  const shownLines = lines.length ? lines : snapLines;
  const discount = d.length ? Math.max(...d) : snap?.discount ?? null;
  const payment = paymentLabel(clean(p.paymentType) ?? snap?.payment);
  const shipping = shippingLabel(clean(p.shipping) ?? snap?.shipping);
  const bundles = clean(p.bundles) ?? snap?.bundles ?? null;

  const fields: [string, string | null][] = [
    ["their plans", shownLines.length ? "x" : null],
    ["their discount", discount != null ? "x" : null],
    ["how it is paid for", payment],
    ["shipping", shipping],
    ["bundles", bundles],
  ];

  return {
    logged: Boolean(shownLines.length || discount != null || payment),
    lines: shownLines,
    discount, payment, bundles, shipping,
    missing: fields.filter(([, v]) => !v).map(([k]) => k),
  };
}

/** One store, as a card: the plans it sells, what each one saves, how it is paid for and
 *  what shipping costs. Its activation state, its open bugs, who runs it here and how many
 *  subscribers it has are not a reference for anybody's plan shape, so they are off this card.
 *
 *  Subscriber counts came off: how many customers another store has is that store's number,
 *  not a reference point for anybody else's plan shape, and it is the one figure on this card
 *  that is nobody's business but theirs.
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

      {/* The plans are what a merchant compares; how it is paid for and what shipping costs
          are the follow-up question, so they fold away. `details` rather than state: it is
          one per card in a list of forty and the browser already knows how to do this. */}
      <Facts payment={plan.payment} bundles={plan.bundles} shipping={plan.shipping} />

      {plan.missing.length > 0 && (
        <p className="hc-scardgap">We do not have {plan.missing.join(", ")} for this store yet.</p>
      )}
    </li>
  );
}

function Facts({ payment, bundles, shipping }: { payment: string | null; bundles: string | null; shipping: string | null }) {
  const rows: [string, string][] = [
    ["Payment", payment ?? ""], ["Shipping", shipping ?? ""], ["Bundles", bundles ?? ""],
  ].filter(([, v]) => v) as [string, string][];
  if (!rows.length) return null;
  return (
    <details className="hc-scarddet">
      <summary>
        <span className="hc-scardsum">
          {payment}{payment && shipping ? " \u00b7 " : ""}{shipping ? `Shipping ${shipping}` : ""}
        </span>
      </summary>
      <dl className="hc-scardfacts">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </details>
  );
}

/** The same question, answered from the snapshot, for the pages with no store list to read.
 *
 *  `/help` has none — there is no signed-in Pilots screen behind it — and that is exactly
 *  where the merchant link points. Named on our own link and anonymous on the merchant one:
 *  a link merchants open should not carry other merchants by name with their discounts
 *  beside them, and on our own surfaces the names are the useful half.
 *
 *  Read from the URL rather than threaded down through two parents, because `public` is a
 *  property of the address and both parents would only be passing it along. */
function Snapshot({ onClose }: { onClose: () => void }) {
  const [pick, setPick] = useState(REFERENCE_SNAPSHOT[0]?.label ?? "");
  const [anon, setAnon] = useState(false);
  const r = REFERENCE_SNAPSHOT.find((x) => x.label === pick) ?? REFERENCE_SNAPSHOT[0];
  const total = REFERENCE_SNAPSHOT.reduce((n, x) => n + x.stores, 0);
  const withPlans = REFERENCE_SNAPSHOT.reduce((n, x) => n + x.withPlans, 0);

  useEffect(() => {
    setAnon(new URLSearchParams(window.location.search).get("public") !== null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="hc-drawerwrap" role="dialog" aria-modal="true" aria-label="What some of our live stores run on">
      <div className="hc-drawerscrim" onClick={onClose} role="presentation" />
      <aside className="hc-drawer">
        <header className="hc-drawerh">
          <div>
            <b>Here&rsquo;s what some of our live stores run on</b>
            <span>{total} stores across {REFERENCE_SNAPSHOT.length} categories, {withPlans} with their plans set up.</span>
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
                {r.withPlans} of {r.stores} {r.stores === 1 ? "store" : "stores"} in this category
                {r.withPlans === 1 ? " has" : " have"} their plans set up.
                {anon && " We do not name stores here; ask us on a call if you want a like-for-like comparison."}
              </p>
              {!anon && (
                <ul className="hc-drawerstores">
                  {r.named.map((st) => (
                    <li className="hc-scard" key={st.name}>
                      <div className="hc-scardh">
                        <b>{st.name}</b>
                        {st.discount != null && <span className="hc-drawerpct">up to {st.discount}% off</span>}
                      </div>
                      {st.plans.length > 0 && (
                        <ul className="hc-drawerplans">
                          {st.plans.map((pl, i) => (
                            <li key={i}>
                              {pl.cadence ?? "Schedule not set"}
                              {pl.deliveries.length > 0 && ` \u00b7 ${pl.deliveries.join(", ")} deliveries`}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Facts payment={paymentLabel(st.payment)} bundles={st.bundles}
                        shipping={shippingLabel(st.shipping)} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="hc-note">Read from our live stores on {REFERENCE_SNAPSHOT_TAKEN}.</p>
        </div>
      </aside>
    </div>
  );
}
