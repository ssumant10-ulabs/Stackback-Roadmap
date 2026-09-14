"use client";
import { useMemo, useState } from "react";
import { CHECKLIST, TOTAL_STEPS, type Step } from "@/lib/help/checklist";
import type { StepState, StoreRecord, StoreSummary } from "@/lib/sanity/queries";

const OWNER_LABEL: Record<Step["owner"], string> = { ulabs: "Us", client: "Client", both: "Together" };

/** Tab three. What has to happen for a store, in order, against one spine every store
 *  shares. The value is not the ticking: it is being able to see at a glance that four
 *  stores are all stuck on the same client-side step, which a per-store list in someone's
 *  notes can never show. */
export default function Internal({ store, stores, connected, getToken }: {
  store: StoreRecord | null;
  stores: StoreSummary[];
  connected: boolean;
  getToken: () => Promise<string | null>;
}) {
  const [progress, setProgress] = useState<StepState[]>(store?.progress || []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const state = useMemo(() => new Map(progress.map((p) => [p.step, p])), [progress]);
  const doneCount = progress.filter((p) => p.done).length;

  async function toggle(step: Step, done: boolean) {
    if (!store) return;
    setBusy(step.id); setErr(null);
    const token = await getToken();
    if (!token) { setErr("Your sign-in expired. Sign in again and retry."); setBusy(null); return; }
    try {
      const res = await fetch("/api/help/progress", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId: store._id, step: step.id, done }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error || "That did not save."); return; }
      setProgress((prev) => [
        ...prev.filter((p) => p.step !== step.id),
        { step: step.id, done, at: json.at, by: json.by, note: null },
      ]);
    } catch { setErr("No connection. The tick did not save."); }
    finally { setBusy(null); }
  }

  if (!connected) {
    return (
      <section>
        <p className="hc-eyebrow">Internal</p>
        <h1 className="hc-h1">Store checklists</h1>
        <div className="hc-empty">
          <p>Not connected to the CMS yet, so there are no stores to track. The checklist below is the
          spine every store gets measured against; it lives in the code, not in Sanity, so it is the same
          for everybody.</p>
        </div>
        <Spine />
      </section>
    );
  }

  if (!store) {
    return (
      <section>
        <p className="hc-eyebrow">Internal</p>
        <h1 className="hc-h1">Store checklists</h1>
        <p className="hc-blurb">
          Every store against the same {TOTAL_STEPS} steps. Open one to tick it off, or read the spine below.
        </p>
        {stores.length === 0
          ? <div className="hc-empty"><p>No stores in the CMS yet. Add one in the Studio and its link appears here.</p></div>
          : <StoreTable stores={stores} />}
        <Spine />
      </section>
    );
  }

  return (
    <section>
      <p className="hc-eyebrow">Internal · {store.name}</p>
      <h1 className="hc-h1">Onboarding checklist</h1>
      <p className="hc-blurb">
        {doneCount} of {TOTAL_STEPS} done. Steps are ordered, and a step whose blocker is open is
        marked: it is nearly always the client-side one, which is worth saying out loud on a status call.
      </p>

      <div className="hc-progress" role="img" aria-label={`${doneCount} of ${TOTAL_STEPS} steps complete`}>
        <i style={{ width: `${(doneCount / TOTAL_STEPS) * 100}%` }} />
      </div>

      {err && <p className="hc-result bad" role="status">{err}</p>}

      {CHECKLIST.map((phase) => (
        <div key={phase.id} className="hc-phase">
          <h2 className="hc-h2">{phase.title}</h2>
          <ul className="hc-steps">
            {phase.steps.map((step) => {
              const st = state.get(step.id);
              const blocked = step.blockedBy ? !state.get(step.blockedBy)?.done : false;
              return (
                <li key={step.id} className={(st?.done ? "done " : "") + (blocked ? "blocked" : "")}>
                  <label>
                    <input type="checkbox" checked={Boolean(st?.done)} disabled={busy === step.id}
                      onChange={(e) => toggle(step, e.target.checked)} />
                    <span className="hc-steptitle">
                      {step.title}
                      <em className={"hc-owner o-" + step.owner}>{OWNER_LABEL[step.owner]}</em>
                    </span>
                  </label>
                  <p className="hc-stepdetail">{step.detail}</p>
                  {blocked && !st?.done && <p className="hc-stepblock">Waiting on the step above it.</p>}
                  {st?.done && st.at && (
                    <p className="hc-stepwho">{new Date(st.at).toLocaleDateString()}{st.by ? ` · ${st.by}` : ""}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function StoreTable({ stores }: { stores: StoreSummary[] }) {
  return (
    <table className="hc-table">
      <thead><tr><th>Store</th><th>Stage</th><th>Plans</th><th>Steps done</th><th>Link</th></tr></thead>
      <tbody>
        {stores.map((s) => {
          const done = (s.progress || []).filter((p) => p.done).length;
          return (
            <tr key={s._id}>
              <td><a href={`/help/${s.slug}#/internal`}>{s.name}</a></td>
              <td>{s.stage}</td>
              <td className="hc-num">{(s.recommendations || []).length}</td>
              <td className="hc-num">{done} of {TOTAL_STEPS}</td>
              <td><a href={`/help/${s.slug}`}>client view</a></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Spine() {
  return (
    <>
      <h2 className="hc-h2">The spine</h2>
      {CHECKLIST.map((phase) => (
        <div key={phase.id} className="hc-phase">
          <h3 className="hc-h3">{phase.title}</h3>
          <ul className="hc-steps flat">
            {phase.steps.map((step) => (
              <li key={step.id}>
                <span className="hc-steptitle">{step.title}<em className={"hc-owner o-" + step.owner}>{OWNER_LABEL[step.owner]}</em></span>
                <p className="hc-stepdetail">{step.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
