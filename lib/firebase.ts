import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/** The app runs with or without Firebase. With no config it stays on browser localStorage,
 *  unauthenticated, exactly as before, so a missing env var degrades rather than breaks.
 *
 *  None of these values are secret. Firebase access is enforced by the Firestore and Storage
 *  rules, which check the signed-in user's email domain; the client config is public by design. */
const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

/** Domains permitted to sign in. Mirrors the rules; this only shapes the UI, since a client
 *  check alone would be trivially bypassed. Blank allows any Google account. */
export const ALLOWED_DOMAINS = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || "")
  .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

export function emailAllowed(email: string | null | undefined): boolean {
  if (!ALLOWED_DOMAINS.length) return true;
  const at = (email || "").toLowerCase().split("@")[1];
  return !!at && ALLOWED_DOMAINS.includes(at);
}

let _app: FirebaseApp | null = null;
function app(): FirebaseApp | null {
  if (!firebaseEnabled) return null;
  if (!_app) _app = getApps().length ? getApp() : initializeApp(cfg as Required<typeof cfg>);
  return _app;
}

export const fbAuth = (): Auth | null => { const a = app(); return a ? getAuth(a) : null; };
/** `ignoreUndefinedProperties` is the safety net, not the fix. Firestore throws synchronously
 *  out of setDoc when any field is undefined, and because our three documents are written
 *  from one map() that throw aborted the other two before they were ever sent: a single
 *  stray undefined stopped the whole app saving. Callers still omit undefined keys; this
 *  makes sure the next one that slips through drops a field instead of a session of edits. */
let _db: Firestore | null = null;
export const fbDb = (): Firestore | null => {
  const a = app();
  if (!a) return null;
  if (!_db) {
    try { _db = initializeFirestore(a, { ignoreUndefinedProperties: true }); }
    catch { _db = getFirestore(a); }   // already initialised elsewhere (fast refresh)
  }
  return _db;
};
/** Firebase Storage requires the Blaze plan, so it is opt-in rather than assumed present.
 *  Set NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED=true once the project is upgraded and Storage
 *  rules are published; until then uploads are refused and the link route is used instead. */
export const storageConfigured = (): boolean =>
  firebaseEnabled && process.env.NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED === "true";

export const fbStorage = (): FirebaseStorage | null => { const a = app(); return a ? getStorage(a) : null; };
