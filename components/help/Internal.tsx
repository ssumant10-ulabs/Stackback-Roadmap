"use client";
import { useMemo, useState } from "react";
import { CHECKLIST, RUNBOOKS, TOTAL_STEPS, type Step } from "@/lib/help/checklist";
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

      <ol className="hc-timeline">
      {CHECKLIST.map((phase, pi) => {
        const steps = phase.steps;
        const doneHere = steps.filter((x) => state.get(x.id)?.done).length;
        const state_ = doneHere === steps.length ? "done" : doneHere > 0 ? "doing" : "todo";
        return (
        <li key={phase.id} className={"hc-tlphase " + state_}>
          <span className="hc-tlnode" aria-hidden="true">{state_ === "done" ? "\u2713" : pi + 1}</span>
          <div className="hc-tlbody">
            <h2 className="hc-h2">{phase.title}<em>{doneHere} of {steps.length}</em></h2>
            <p className="hc-tlpurpose">{phase.purpose}</p>
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
                  {step.message && <Message step={step} />}
                  {blocked && !st?.done && <p className="hc-stepblock">Waiting on the step above it.</p>}
                  {st?.done && st.at && (
                    <p className="hc-stepwho">{new Date(st.at).toLocaleDateString()}{st.by ? ` · ${st.by}` : ""}</p>
                  )}
                </li>
              );
            })}
          </ul>
          </div>
        </li>
        );
      })}
      </ol>
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
      <h1 className="hc-h1">Onboarding</h1>
      <p className="hc-blurb">
        Five phases, in order. Every store is measured against the same spine, and the message we
        send at a step sits on that step.
      </p>

      {/* Buttons, not anchors. `href="#phase-access"` writes the document hash, and the hash
          is this app's router: `parseHash` did not recognise it, fell back to the FAQ, and
          the click left the Internal tab entirely instead of scrolling down it. Scrolling the
          element directly never touches the address. The landing offset is
          `scroll-margin-top` on the phase, so the sticky bar does not sit over the heading. */}
      <nav className="hc-tlnav" aria-label="Phases">
        {CHECKLIST.map((phase, i) => (
          <button key={phase.id} type="button"
            onClick={() => document.getElementById(`phase-${phase.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <b>{i + 1}</b><span>{phase.title}</span><em>{phase.steps.length}</em>
          </button>
        ))}
      </nav>

      <ol className="hc-timeline">
        {CHECKLIST.map((phase, pi) => (
          <li key={phase.id} id={`phase-${phase.id}`} className="hc-tlphase">
            <span className="hc-tlnode" aria-hidden="true">{pi + 1}</span>
            <div className="hc-tlbody">
              <h3 className="hc-h2">{phase.title}<em>{phase.steps.length} steps</em></h3>
              <p className="hc-tlpurpose">{phase.purpose}</p>
              <ul className="hc-steps flat">
                {phase.steps.map((step) => (
                  <li key={step.id}>
                    <span className="hc-steptitle">{step.title}<em className={"hc-owner o-" + step.owner}>{OWNER_LABEL[step.owner]}</em></span>
                    <p className="hc-stepdetail">{step.detail}</p>
                    {step.message && <Message step={step} />}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="hc-h2">Copy we hand over</h2>
      <p className="hc-blurb">
        Not messages we send: text the merchant puts on their own pages, and one runbook that only
        applies to stores taking AutoPay.
      </p>
      {RUNBOOKS.map((r) => (
        <details key={r.id} className="hc-runbook">
          <summary><b>{r.title}</b><span>{r.blurb}</span></summary>
          <pre>{r.body}</pre>
          <CopyBtn text={r.body} label="Copy" />
        </details>
      ))}
    </>
  );
}

/** The message we send at a step, with the thread's own wording. */
function Message({ step }: { step: Step }) {
  const m = step.message;
  if (!m) return null;
  return (
    <details className="hc-msg">
      <summary>What we send: <b>{m.subject}</b></summary>
      <pre>{m.body}</pre>
      {m.note && <p className="hc-msgnote">{m.note}</p>}
      <CopyBtn text={m.body} label="Copy the message" />
    </details>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="hc-btn ghost hc-msgcopy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => setDone(true), () => setDone(false));
        setTimeout(() => setDone(false), 2000);
      }}>
      {done ? "Copied" : label}
    </button>
  );
}
