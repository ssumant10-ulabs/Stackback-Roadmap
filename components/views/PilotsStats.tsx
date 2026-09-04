"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { Feature, PilotStore } from "@/lib/types";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

const REQ_STATUS = ["Not started", "In progress", "Done"];
const REQ_TONE: Record<string, string> = { "Not started": "dash", "In progress": "gold", Done: "ok" };
const URGENCY = ["High", "Medium", "Low"];
const URGENCY_TONE: Record<string, string> = { High: "red", Medium: "gold", Low: "info" };

type Row = { label: string; n: number; tone?: string };

function Bars({ rows, total }: { rows: Row[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="ps-none">Nothing logged yet.</p>;
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

/** Blanks used to be dropped while the percentages stayed out of the full count, so a chart
 *  of 44 stores could add up to 70% and read as if the rest did not exist. They now get their
 *  own row, which is also the one worth acting on. */
const countBy = (list: PilotStore[], key: (p: PilotStore) => string | null | undefined): Row[] => {
  const m = new Map<string, number>();
  let blank = 0;
  list.forEach((p) => { const v = (key(p) || "").trim(); if (v) m.set(v, (m.get(v) || 0) + 1); else blank++; });
  const rows: Row[] = [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  if (blank) rows.push({ label: "Not set", n: blank, tone: "dash" });
  return rows;
};

/** A fixed vocabulary counted in its own order rather than by size, so the shape of the chart
 *  stays put between visits and can be compared at a glance.
 *
 *  A value outside the vocabulary keeps its own name instead of being folded into "Not set".
 *  The seed carries one request marked "Planned", which the Requests tab's own dropdown does
 *  not offer: calling that unset says there is nothing to do, when the thing to do is to give
 *  it one of the three. Genuinely empty values are a separate row. */
const countFixed = (
  list: Feature[], key: (f: Feature) => string | null | undefined,
  vocab: string[], tones: Record<string, string>,
): Row[] => {
  const rows: Row[] = vocab.map((v) => ({
    label: v, tone: tones[v],
    n: list.filter((f) => (key(f) || "").trim() === v).length,
  }));
  const others = new Map<string, number>();
  let blank = 0;
  list.forEach((f) => {
    const v = (key(f) || "").trim();
    if (!v) blank++;
    else if (!vocab.includes(v)) others.set(v, (others.get(v) || 0) + 1);
  });
  [...others.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([label, n]) => rows.push({ label, n, tone: "orange" }));
  if (blank) rows.push({ label: "Not set", n: blank, tone: "dash" });
  return rows.filter((r) => r.n > 0);
};

const isDone = (f: Feature) => (f.sheetStatus || "").toLowerCase() === "done";

export function PilotsStats() {
  const s = useStore();
  const version = s.getSnapshot();
  const p = s.pilots;
  const requests = s.requests;

  /* Open work is counted from the request records themselves. The store sheet also has an
     "open bugs" number column, but it is typed in by hand and drifts from the bugs actually
     logged, so a tile adding it up reported the typing rather than the work. */
  const st = useMemo(() => {
    const bugs = requests.filter((f) => f.kind === "bug");
    const feats = requests.filter((f) => f.kind !== "bug");
    return {
      openBugs: bugs.filter((f) => !isDone(f)).length,
      openReqs: feats.filter((f) => !isDone(f)).length,
      noPoc: p.filter((x) => !x.poc),
      /* Was "active with no last-touch date", which only ever looked at the Active status, so
         a store parked on a status the team added counted nowhere. */
      noTouch: p.filter((x) => !x.lastTouch),
      looseBugs: bugs.filter((f) => !isDone(f) && !f.storeId),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, requests, version]);

  /* Every status, in the order and colour the values panel sets. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byStatus = useMemo(() => s.statusBuckets(p).filter((b) => b.n > 0), [p, s, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byPoc = useMemo(() => countBy(p, (x) => x.poc), [p, version]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const req = useMemo(() => ({
    status: countFixed(requests, (f) => f.sheetStatus || "Not started", REQ_STATUS, REQ_TONE),
    kind: [
      { label: "Bugs", n: requests.filter((f) => f.kind === "bug").length, tone: "red" },
      { label: "Feature requests", n: requests.filter((f) => f.kind !== "bug").length, tone: "info" },
    ].filter((r) => r.n > 0),
    urgency: countFixed(requests, (f) => f.urgency, URGENCY, URGENCY_TONE),
  }), [requests, version]);

  return (
    <>
      <div className="ps-tiles">
        <div className="ps-tile"><b>{p.length}</b><span>pilot stores</span></div>
        <div className="ps-tile"><b>{requests.length}</b><span>logged by merchants</span></div>
        <div className={`ps-tile${st.openReqs ? " st t-info" : ""}`}><b>{st.openReqs}</b><span>open requests</span></div>
        <div className={`ps-tile${st.openBugs ? " bad" : ""}`}><b>{st.openBugs}</b><span>open bugs</span></div>
      </div>

      <div className="ps-grid">
        <section className="ps-card">
          <h3>Activation status</h3>
          <Bars rows={byStatus.map((b) => ({ label: b.label, n: b.n, tone: b.tone }))} total={p.length} />
        </section>
        <section className="ps-card">
          <h3>Requests and bugs</h3>
          <h4 className="ps-sub">Where they stand</h4>
          <Bars rows={req.status} total={requests.length} />
          <h4 className="ps-sub">What they are</h4>
          <Bars rows={req.kind} total={requests.length} />
          <h4 className="ps-sub">Urgency</h4>
          <Bars rows={req.urgency} total={requests.length} />
        </section>
        <section className="ps-card">
          <h3>Owner load</h3>
          <Bars rows={byPoc} total={p.length} />
        </section>
      </div>

      <section className="ps-card ps-attn">
        <h3>Needs attention</h3>
        <div className="ps-attn-grid">
          <div>
            <b>{st.noPoc.length}</b> stores with no owner
            <p>{st.noPoc.map((x) => x.name).join(", ") || "None"}</p>
          </div>
          <div>
            <b>{st.noTouch.length}</b> stores with no last-touch date
            <p>{st.noTouch.map((x) => x.name).join(", ") || "None"}</p>
          </div>
          <div>
            <b>{st.looseBugs.length}</b> open bugs with no store attached
            <p>{st.looseBugs.map((x) => x.title).join(", ") || "None"}</p>
          </div>
        </div>
      </section>

    </>
  );
}
