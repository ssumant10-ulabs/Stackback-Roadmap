"use client";
import { useEffect, useMemo, useState } from "react";
import { ARTICLES, CATEGORIES } from "@/lib/help/corpus";
import { RISK_STATUSES, STATUS_LABEL, type HelpStatus } from "@/lib/help/types";
import { readLocal, readShared, type AskRecord } from "@/lib/help/log";

const CAT_NAME = new Map(CATEGORIES.map((c) => [c.id, c.name]));
const ORDER: HelpStatus[] = ["w", "l", "m", "x", "r", "n"];

/** The internal half. It reads the same corpus the merchant reads and asks a different
 *  question of it: not "what is the answer" but "what will this cost us in support, and
 *  what did somebody ask that we could not answer". */
export default function Insights() {
  const [asks, setAsks] = useState<AskRecord[]>([]);

  useEffect(() => {
    setAsks(readLocal());
    void readShared().then((remote) => {
      if (remote.length) setAsks((local) => {
        const seen = new Set(remote.map((r) => `${r.at}|${r.q}`));
        return [...remote, ...local.filter((r) => !seen.has(`${r.at}|${r.q}`))].sort((a, b) => b.at - a.at);
      });
    });
  }, []);

  const byStatus = useMemo(() => {
    const m = new Map<HelpStatus, number>();
    for (const a of ARTICLES) m.set(a.status, (m.get(a.status) || 0) + 1);
    return ORDER.map((s) => ({ s, n: m.get(s) || 0 }));
  }, []);

  const risk = useMemo(
    () => ARTICLES.filter((a) => RISK_STATUSES.includes(a.status)).sort((a, b) => b.asked - a.asked),
    [],
  );

  const byCat = useMemo(() => CATEGORIES.map((c) => {
    const list = ARTICLES.filter((a) => a.cat === c.id);
    return {
      c, n: list.length,
      asked: list.reduce((s, a) => s + a.asked, 0),
      risk: list.filter((a) => RISK_STATUSES.includes(a.status)).length,
    };
  }).sort((a, b) => b.asked - a.asked), []);

  const misses = asks.filter((a) => a.kind === "miss");
  const total = ARTICLES.reduce((s, a) => s + a.asked, 0);

  return (
    <section>
      <p className="hc-eyebrow">Internal</p>
      <h1 className="hc-h1">Insights</h1>
      <p className="hc-blurb">
        What the corpus says about support load, and what people asked it that it could not answer.
        Merchants never see this view.
      </p>

      <div className="hc-stats">
        <div className="hc-stat"><b>{total}</b><span>store-raisings behind {ARTICLES.length} answers</span></div>
        <div className="hc-stat"><b>{risk.length}</b><span>answers that are no, later, or a warning</span></div>
        <div className="hc-stat"><b>{asks.length}</b><span>questions logged</span></div>
        <div className="hc-stat"><b>{misses.length}</b><span>with no answer found</span></div>
      </div>

      <h2 className="hc-h2">What kind of answers these are</h2>
      <div className="hc-bars">
        {byStatus.map(({ s, n }) => (
          <div key={s} className="hc-bar">
            <span className="hc-barlabel">{STATUS_LABEL[s]}</span>
            <span className="hc-bartrack"><i className={"p-" + s} style={{ width: `${(n / ARTICLES.length) * 100}%` }} /></span>
            <span className="hc-barn">{n}</span>
          </div>
        ))}
      </div>

      <h2 className="hc-h2">Answer risk, most-asked first</h2>
      <p className="hc-note">
        Every row is a merchant being told no, not yet, or be careful. These are the calls Customer Success
        gets after the merchant has read the answer.
      </p>
      <table className="hc-table">
        <thead><tr><th>Question</th><th>Topic</th><th>Answer</th><th>Stores</th></tr></thead>
        <tbody>
          {risk.slice(0, 20).map((a) => (
            <tr key={a.id}>
              <td><a href={`#/cat/${a.cat}#a=${a.id}`}>{a.q}</a></td>
              <td>{CAT_NAME.get(a.cat)}</td>
              <td><span className={"hc-pill p-" + a.status}>{STATUS_LABEL[a.status]}</span></td>
              <td className="hc-num">{a.asked}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="hc-h2">Where the questions come from</h2>
      <table className="hc-table">
        <thead><tr><th>Topic</th><th>Answers</th><th>Store raisings</th><th>Of which no / later / warning</th></tr></thead>
        <tbody>
          {byCat.map(({ c, n, asked, risk: r }) => (
            <tr key={c.id}>
              <td><a href={`#/cat/${c.id}`}>{c.name}</a></td>
              <td className="hc-num">{n}</td>
              <td className="hc-num">{asked}</td>
              <td className="hc-num">{r || "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="hc-h2">Questions the Help Centre could not answer</h2>
      {misses.length === 0
        ? <p className="hc-note">
            Nothing logged yet. Merchant sessions stay in their own browser by design, since the Firestore
            rules allow writes only from a ULABS account: only questions asked from a signed-in session
            reach this list. Widening it needs a write-only collection and a rules change.
          </p>
        : <ul className="hc-misses">
            {misses.slice(0, 40).map((m, i) => (
              <li key={i}><b>{m.q}</b><span>{new Date(m.at).toLocaleString()}{m.by ? ` · ${m.by}` : " · local"}</span></li>
            ))}
          </ul>}
    </section>
  );
}
