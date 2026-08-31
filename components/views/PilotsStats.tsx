"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { PilotStore } from "@/lib/types";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function Bars({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="ps-bars">
      {rows.map((r) => (
        <div className="ps-bar" key={r.label}>
          <span className="ps-lbl" title={r.label}>{r.label}</span>
          <span className="ps-track"><span style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="ps-n">{r.n}<em>{pct(r.n, total)}%</em></span>
        </div>
      ))}
    </div>
  );
}

const countBy = (list: PilotStore[], key: (p: PilotStore) => string | null | undefined) => {
  const m = new Map<string, number>();
  list.forEach((p) => { const v = (key(p) || "").trim(); if (v) m.set(v, (m.get(v) || 0) + 1); });
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
};

export function PilotsStats() {
  const s = useStore();
  const version = s.getSnapshot();
  const p = s.pilots;

  const st = useMemo(() => {
    const live = p.filter((x) => x.status === "Live");
    const activated = p.filter((x) => x.activationStatus === "Activated");
    const active = p.filter((x) => x.activationStatus === "Active");
    const inactive = p.filter((x) => x.activationStatus === "Inactive");
    const subs = p.reduce((a, x) => a + (x.activeSubs || 0), 0);
    const total = p.reduce((a, x) => a + (x.totalSubs || 0), 0);
    const prepaid = p.reduce((a, x) => a + (x.prepaidSubs || 0), 0);
    const bundles = p.reduce((a, x) => a + (x.oneTimeBundles || 0), 0);
    const bugs = p.reduce((a, x) => a + (x.openBugs || 0), 0);
    const noPoc = p.filter((x) => !x.poc);
    const noTouch = p.filter((x) => !x.lastTouch && x.activationStatus === "Active");
    return { live, activated, active, inactive, subs, total, prepaid, bundles, bugs, noPoc, noTouch };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, version]);

  const byStatus = useMemo(() => countBy(p, (x) => x.activationStatus), [p, version]);
  const byCategory = useMemo(() => countBy(p, (x) => x.category), [p, version]);
  const byPoc = useMemo(() => countBy(p, (x) => x.poc), [p, version]);
  const byPayment = useMemo(() => countBy(p, (x) => x.paymentType), [p, version]);

  return (
    <>
      <div className="ps-tiles">
        <div className="ps-tile"><b>{p.length}</b><span>stores</span></div>
        <div className="ps-tile"><b>{st.live.length}</b><span>live</span></div>
        <div className="ps-tile"><b>{st.activated.length}</b><span>activated</span></div>
        <div className="ps-tile"><b>{st.active.length}</b><span>in conversation</span></div>
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
            <b>{st.noTouch.length}</b> active with no last-touch date
            <p>{st.noTouch.map((x) => x.name).join(", ") || "None"}</p>
          </div>
        </div>
      </section>

    </>
  );
}
