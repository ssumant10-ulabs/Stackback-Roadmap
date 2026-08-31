import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
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
export const fbDb = (): Firestore | null => { const a = app(); return a ? getFirestore(a) : null; };
export const fbStorage = (): FirebaseStorage | null => { const a = app(); return a ? getStorage(a) : null; };
