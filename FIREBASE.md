# Firebase setup (shared backend + login)

With no Firebase env vars the app runs exactly as it always did: browser localStorage, no
login, one private copy per person. Set the six values below and it switches to a shared
Firestore backend behind a Google sign-in, with screenshots in Firebase Storage.

## 1. Project

console.firebase.google.com, add a project. Spark (free) is enough: this app's whole state is
roughly 77 KB against a 1 GiB limit, and a team of ten against 50,000 monthly active users.

Free tier, confirmed 2026-08-31: Auth 50k MAU, Firestore 1 GiB and 50k reads / 20k writes a
day, Storage 5 GB. No idle pause, which is why this was chosen over Supabase free (that one
pauses a project after 7 days of inactivity and needs a manual restore).

## 2. Web app

Project settings, Your apps, the web icon. Firebase Hosting is not needed: Vercel serves the
app. Copy the six `firebaseConfig` values.

None of them are secret. Firebase access is enforced by the rules in `firebase/`, not by
hiding the client config. Never commit a service account key: nothing here needs one.

## 3. Authentication

Build, Authentication, Sign-in method, enable **Google**.

Then Settings, **Authorized domains**, add `stackback-roadmap.vercel.app`. Google sign-in
fails silently without it, which is the most common setup mistake.

## 4. Firestore

Build, Firestore Database, Create, **Production mode**.

The location is permanent. Pick `asia-south1` (Mumbai) for an India-based team; a US region
adds roughly 200ms to every read and write for good.

Paste `firebase/firestore.rules` into the Rules tab and publish.

## 5. Storage

Build, Storage, Get started, Production mode. Paste `firebase/storage.rules`, publish.

## 6. Environment

Local: copy `.env.example` to `.env.local` and fill it in. Vercel: the same six under Project
Settings, Environment Variables, then redeploy.

`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` decides who may sign in. It shapes the UI only; the rules
enforce the same list, and they are what actually protects the data.

## How it works

- Three documents under `app/`: `roadmap`, `features`, `pilots`. Split rather than one blob
  because Firestore caps a document at 1 MB, which a single blob would eventually hit as the
  activity log and both lists grow, and because a pilot edit should not rewrite the roadmap.
- Every write stamps `updatedBy` with a per-tab id, and the live listener drops snapshots
  carrying its own id, so a save coming back cannot clobber what was typed since.
- Screenshots upload to Storage under `shots/` and only the URL is stored. Without Firebase
  they fall back to downscaled data URLs in localStorage, under a byte budget.
- Your display name and theme stay local even with the shared backend on.

## Switching over

The first browser to load after the env vars are live writes its state as the shared copy.
**Do it from the browser holding the data you want to keep**, and take a backup first from
Settings, Backup and restore.

## Known limit

Writes replace a whole document, so two people editing different rows of the same module
inside the same moment will have one edit overwritten. Fine at this team size; the fix is
per-record documents, which is the natural next step if it ever bites.
