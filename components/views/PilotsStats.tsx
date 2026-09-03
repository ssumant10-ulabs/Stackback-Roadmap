"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { PilotStore } from "@/lib/types";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function Bars({ rows, total }: { rows: { label: string; n: number; tone?: string }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="ps-bars">
      {rows.map((r) => (
        <div className={`ps-bar${r.tone ? ` t-${r.tone}` : ""}`} key={r.label}>
          <span className="ps-lbl" title={r.label}>{r.label}</span>
          <span className="ps-track"><span style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="ps-n">{r.n}<em>{pct(r.n, total)}%</em></span>
        </div>
      ))}
    </div>
  );
}

/** Blanks used to be dropped while the percentages stayed out of the full store count, so a
 *  chart of 44 stores could add up to 70% and read as if the rest did not exist. They now get
 *  their own row, which is also the one worth acting on. */
const countBy = (list: PilotStore[], key: (p: PilotStore) => string | null | undefined) => {
  const m = new Map<string, number>();
  let blank = 0;
  list.forEach((p) => { const v = (key(p) || "").trim(); if (v) m.set(v, (m.get(v) || 0) + 1); else blank++; });
  const rows = [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  if (blank) rows.push({ label: "Not set", n: blank, tone: "dash" } as { label: string; n: number; tone?: string });
  return rows as { label: string; n: number; tone?: string }[];
};

export function PilotsStats() {
  const s = useStore();
  const version = s.getSnapshot();
  const p = s.pilots;

  const st = useMemo(() => {
    const live = p.filter((x) => x.status === "Live");
    const subs = p.reduce((a, x) => a + (x.activeSubs || 0), 0);
    const prepaid = p.reduce((a, x) => a + (x.prepaidSubs || 0), 0);
    const bundles = p.reduce((a, x) => a + (x.oneTimeBundles || 0), 0);
    const bugs = p.reduce((a, x) => a + (x.openBugs || 0), 0);
    const noPoc = p.filter((x) => !x.poc);
    /* Was "active with no last-touch date", which only ever looked at the Active status, so
       a store parked on a status the team added counted nowhere. Every store with no contact
       recorded is the honest question, and it cannot go stale when the statuses change. */
    const noTouch = p.filter((x) => !x.lastTouch);
    return { live, subs, prepaid, bundles, bugs, noPoc, noTouch };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, version]);

  /* Every status, in the order and colour the values panel sets. The tiles used to name
     Activated and In conversation only, so moving a store to any other status took it out of
     the tiles while the store count kept counting it. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byStatus = useMemo(() => s.statusBuckets(p).filter((b) => b.n > 0), [p, s, version]);
  const byCategory = useMemo(() => countBy(p, (x) => x.category), [p, version]);
  const byPoc = useMemo(() => countBy(p, (x) => x.poc), [p, version]);
  const byPayment = useMemo(() => countBy(p, (x) => x.paymentType), [p, version]);

  return (
    <>
      <div className="ps-tiles">
        <div className="ps-tile"><b>{p.length}</b><span>stores</span></div>
        <div className="ps-tile"><b>{st.live.length}</b><span>live</span></div>
        {byStatus.map((b) => (
          <div className={`ps-tile st t-${b.tone}`} key={b.value || "none"}>
            <b>{b.n}</b><span>{b.label.toLowerCase()}</span>
          </div>
        ))}
        <div className="ps-tile"><b>{st.subs}</b><span>active subs</span></div>
        <div className="ps-tile"><b>{st.prepaid}</b><span>prepaid subs</span></div>
        <div className="ps-tile"><b>{st.bundles}</b><span>one-time bundles</span></div>
        <div className={`ps-tile${st.bugs ? " bad" : ""}`}><b>{st.bugs}</b><span>open bugs</span></div>
      </div>

      <div className="ps-grid">
        <section className="ps-card">
          <h3>Activation status</h3>
          <Bars rows={byStatus} total={p.length} />
        </section>
        <section className="ps-card">
          <h3>Owner load</h3>
          <Bars rows={byPoc} total={p.length} />
        </section>
        <section className="ps-card">
          <h3>Brand category</h3>
          <Bars rows={byCategory} total={p.length} />
        </section>
        <section className="ps-card">
          <h3>Payment type</h3>
          <Bars rows={byPayment} total={p.length} />
        </section>
      </div>

      <section className="ps-card ps-attn">
        <h3>Needs attention</h3>
        <div className="ps-attn-grid">
          <div>
            <b>{st.noPoc.length}</b> with no owner
            <p>{st.noPoc.map((x) => x.name).join(", ") || "None"}</p>
          </div>
          <div>
            <b>{st.noTouch.length}</b> with no last-touch date
            <p>{st.noTouch.map((x) => x.name).join(", ") || "None"}</p>
          </div>
        </div>
      </section>

    </>
  );
}
