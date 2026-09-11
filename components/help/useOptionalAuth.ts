"use client";
import { useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from "firebase/auth";
import { emailAllowed, fbAuth, firebaseEnabled } from "@/lib/firebase";

/** AuthGate blocks until somebody signs in, which is right for the roadmap and wrong here:
 *  the Help Centre is public and sign-in only adds a layer. So this watches the same session
 *  without ever standing in front of the page. Somebody already signed in on /pilots lands
 *  on /help with the internal layer on, and nobody else is asked for anything. */
export function useOptionalAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseEnabled);

  useEffect(() => {
    const auth = fbAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u && emailAllowed(u.email) ? u : null);
      setReady(true);
    });
  }, []);

  const signIn = async () => {
    const auth = fbAuth();
    if (!auth) return;
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch { /* a closed popup is a decision, not an error */ }
  };
  const signOut = () => { const a = fbAuth(); if (a) void fbSignOut(a); };

  /** A fresh ID token for the privileged write routes. The server verifies it; this side
   *  only fetches it, and lets the Firebase SDK refresh it when it is close to expiring. */
  const getToken = async (): Promise<string | null> => {
    try { return user ? await user.getIdToken() : null; } catch { return null; }
  };

  return { user, ready, internal: !!user, available: firebaseEnabled, signIn, signOut, getToken };
}
