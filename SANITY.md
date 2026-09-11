# Help Centre query log

The Help Centre at `/help` is two parts, and only one of them needs Sanity.

| Part | Content | Source | Needs Sanity |
|---|---|---|---|
| Your plans | One store: its recommended plans, the queries it still has to answer, its widget settings | Sanity, `store` + `merchantQuery` | Yes |
| Help Centre | The FAQs, 17 topics, the order-flow diagrams, the simulator | Generated from the Help Centre HTML deliverable | No |
| Internal | The onboarding checklist, per store | Spine in `lib/help/checklist.ts`, progress on the store in Sanity | Yes |

The FAQ half stays out of the CMS on purpose. Those words live in
`Project Deliverables/stackback/Operations/StackBack_Merchant_Help_Centre_v<n>.html`, and
`npm run help:corpus <path-to-that-file>` re-cuts `lib/help/corpus.ts` from it. Putting a
second editable copy in Sanity would give the same sentence two owners.

## Setup, once

```
npx sanity login
npx sanity init --create-project "StackBack Help" --dataset production
```

Take the project id it prints and put it in `.env.local` (and in Vercel > Settings >
Environment Variables):

```
SANITY_PROJECT_ID=<the id>
SANITY_DATASET=production
SANITY_API_WRITE_TOKEN=<Editor token from sanity.io/manage > API > Tokens>
```

Put the same id in `studio/.env`:

```
SANITY_STUDIO_PROJECT_ID=<the id>
SANITY_STUDIO_DATASET=production
```

No CORS entries are needed for the site: the browser never talks to Sanity, only the server
does. The Studio talks to it from `localhost:3333`, which Sanity allows by default.

## Running the Studio

```
npm run studio          # http://localhost:3333
npm run studio:deploy   # publishes to <name>.sanity.studio
```

The Studio is standalone rather than mounted at `/studio` in this app. `next build` here
takes about three seconds and the team deploys on every push; compiling the Studio into
that build would spend most of the budget on a tool two people open once a day. Standalone
Studios also auto-update, which an embedded one cannot.

## The workflow

1. A client sends a query from the Subscription queries tab. It arrives as `status: new`,
   invisible to everybody except the Studio. The team can also post one directly, which is
   the usual case: the queries we work through with a client during plan setup.
2. Somebody answers it in **Needs an answer** and sets the status to **Answered and public**.
   The schema refuses to accept "answered" with an empty answer.
3. It appears in the tab within a minute, ordered by how many clients raised it.

Nothing auto-publishes. A merchant's words never reach the public page until a person has
read them and written a reply.

## Per-store links, and the free-plan limit behind how they work

Each store gets `/help/<slug>`, and the slug is **random, not their name**. That is the link
you send them; it carries their plan recommendations and the queries you need answered.

On Sanity's free tier a dataset is **public-read**: anyone holding the project id can list
every document in it, which here would mean every store's pricing. So:

- the project id is **not** exposed to the browser. `SANITY_PROJECT_ID` has no
  `NEXT_PUBLIC_` prefix, `lib/sanity/client.ts` is `server-only`, and every read happens in
  a server component and reaches the page as props.
- the slug is random, so one client's link does not suggest another's.

Be honest about what that is: **obscurity, not a boundary.** It is a reasonable posture for
a pilot and the wrong one for GA. The real fix is a paid plan with a private dataset, and
**no code changes when you do it**: it is a setting in `sanity.io/manage`. This narrows the
open question in `memory/projects/stackback/open-questions.md` (2026-08-31) to the datasets
that now hold client pricing and client-written text.

Keep contact details out of `askedBy` and `internalNotes` until that switch is made.

## The internal tab

`lib/help/checklist.ts` holds the onboarding spine: 22 steps across Access, Data and plan
queries, Build, Review and Go live, each owned by us, the client, or both, and each naming
the step that blocks it. The spine lives in code so every store is measured against the same
one; only the tick state is per store, on the store document.

Ticking writes through `app/api/help/progress`, which verifies a Firebase ID token against
Google and checks the email domain before it touches Sanity. A client-side auth check alone
would mean anyone who can reach the URL can rewrite any store's progress.
