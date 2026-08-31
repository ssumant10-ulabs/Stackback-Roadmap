"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User,
} from "firebase/auth";
import { ALLOWED_DOMAINS, emailAllowed, fbAuth, firebaseEnabled } from "@/lib/firebase";
import { useStore } from "@/lib/store";
import { Logo } from "./icons";

interface AuthState {
  user: User | null;
  ready: boolean;
  signOut: () => void;
}
const AuthContext = createContext<AuthState>({ user: null, ready: true, signOut: () => {} });
export const useAuth = () => useContext(AuthContext);

/** Wraps the whole app. Without Firebase configured it renders its children untouched, so
 *  local development and the pre-Firebase deployment behave exactly as before. With Firebase
 *  on, nothing renders until somebody is signed in from an allowed domain. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const s = useStore();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseEnabled);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = fbAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      if (u && !emailAllowed(u.email)) {
        // Signed in with the wrong account: reject here as well as in the rules, so the
        // message explains itself rather than surfacing as a permission error later.
        setError(`${u.email} is not on an allowed domain.`);
        fbSignOut(auth);
        setUser(null);
      } else {
        setUser(u);
        // Comments and activity are stamped with a name; take it from the account rather
        // than asking each person to type one.
        if (u && !s.me) s.setMe(u.displayName || (u.email || "").split("@")[0]);
      }
      setReady(true);
    });
  }, [s]);

  if (!firebaseEnabled) return <>{children}</>;
  if (!ready) return <div className="auth-wait" />;

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <Logo />
          <h1>StackBack Roadmap</h1>
          <p>
            Sign in to reach the roadmap, features and pilot stores.
            {ALLOWED_DOMAINS.length > 0 && <> Restricted to {ALLOWED_DOMAINS.join(", ")}.</>}
          </p>
          <button className="btn primary auth-btn" disabled={busy}
            onClick={async () => {
              const auth = fbAuth();
              if (!auth) return;
              setBusy(true); setError(null);
              try { await signInWithPopup(auth, new GoogleAuthProvider()); }
              catch (e) {
                const c = (e as { code?: string }).code || "";
                setError(
                  c === "auth/popup-blocked" ? "Your browser blocked the sign-in popup. Allow popups and retry."
                  : c === "auth/unauthorized-domain" ? "This domain is not in Firebase's authorized list. Add it under Authentication, Settings, Authorized domains."
                  : c === "auth/popup-closed-by-user" ? "Sign-in was cancelled."
                  : (e as Error).message);
              } finally { setBusy(false); }
            }}>
            {busy ? "Signing in…" : "Continue with Google"}
          </button>
          {error && <p className="auth-err">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, ready, signOut: () => { const a = fbAuth(); if (a) fbSignOut(a); } }}>
      {children}
    </AuthContext.Provider>
  );
}
