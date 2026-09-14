/** What was asked, and whether we had an answer.
 *
 *  The Firestore rules allow writes only from a signed-in ulabsglobal.com account, so a
 *  merchant reading the public Help Centre cannot write anything here, by design: exposing
 *  a public write path to collect analytics would be a worse trade than not collecting it.
 *  Merchant-side history therefore stays in that browser's localStorage and never leaves it.
 *  Internal sessions sync, which is what the Insights view reads.
 *
 *  The gap this leaves is real and is on the follow-up list: cross-merchant miss telemetry
 *  needs either a rules change with a write-only collection, or the escalation route below,
 *  which carries the question to the team the moment a merchant chooses to send it. */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { emailAllowed, fbDb, firebaseEnabled } from "../firebase";

export interface AskRecord {
  q: string;
  /** Article the reader was given, when there was one. */
  hit: string | null;
  kind: "answer" | "choose" | "miss";
  at: number;
  /** Set on internal records so a ULABS query is never counted as a merchant's. */
  by?: string;
}

const KEY = "sb-help-asks";
const CAP = 400;

export function readLocal(): AskRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as AskRecord[]; }
  catch { return []; }
}

function writeLocal(rows: AskRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-CAP))); } catch { /* private window, quota: losing history is not worth an error */ }
}

export function record(r: AskRecord, email?: string | null): AskRecord[] {
  const rows = [...readLocal(), { ...r, by: email || undefined }];
  writeLocal(rows);
  if (email && emailAllowed(email)) void push(rows.slice(-CAP), email);
  return rows;
}

/** Internal history is merged rather than replaced, so two people with the Help Centre open
 *  do not overwrite each other's questions. Last write wins per row, keyed on time and text,
 *  which is enough for a log nobody edits. */
async function push(local: AskRecord[], email: string) {
  const db = fbDb();
  if (!db) return;
  try {
    const ref = doc(db, "app", "help");
    const snap = await getDoc(ref);
    const remote: AskRecord[] = (snap.exists() ? snap.data().asks : []) || [];
    const seen = new Set(remote.map((r) => `${r.at}|${r.q}`));
    const merged = [...remote, ...local.filter((r) => r.by && !seen.has(`${r.at}|${r.q}`))]
      .sort((a, b) => a.at - b.at).slice(-CAP * 4);
    await setDoc(ref, { asks: merged, updatedAt: new Date().toISOString(), by: email }, { merge: true });
  } catch { /* the log is not worth surfacing an error over; the reader still got their answer */ }
}

export async function readShared(): Promise<AskRecord[]> {
  const db = fbDb();
  if (!firebaseEnabled || !db) return [];
  try {
    const snap = await getDoc(doc(db, "app", "help"));
    return (snap.exists() ? snap.data().asks : []) || [];
  } catch { return []; }
}
