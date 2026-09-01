"use client";
import { useAuth } from "./AuthGate";
import { firebaseEnabled } from "@/lib/firebase";

/** The signed-in account, and the way back out. Shared so both headers carry it: it lived
 *  inline in the roadmap header, which is why it was missing from Pilots entirely. */
export function UserButton() {
  const { user, signOut } = useAuth();
  if (!firebaseEnabled || !user) return null;
  const label = user.displayName || user.email || "?";
  return (
    <button className="ibtn avatar-btn" data-tip={`${label}, sign out`}
      aria-label={`Signed in as ${label}. Sign out.`}
      onClick={() => { if (confirm("Sign out?")) signOut(); }}>
      {user.photoURL
        ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        : <span>{label.slice(0, 1).toUpperCase()}</span>}
    </button>
  );
}
