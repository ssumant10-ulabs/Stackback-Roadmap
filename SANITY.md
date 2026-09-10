# Help Centre query log

The Help Centre at `/help` is two parts, and only one of them needs Sanity.

| Part | Content | Source | Needs Sanity |
|---|---|---|---|
| Queries | Questions merchants and the team raise, and the answers we write | Sanity, document type `merchantQuery` | Yes |
| Help Centre | 234 FAQs, 17 topics, 4 order-flow diagrams, 8 screens | Generated from the Help Centre HTML deliverable | No |

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
NEXT_PUBLIC_SANITY_PROJECT_ID=<the id>
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_WRITE_TOKEN=<Editor token from sanity.io/manage > API > Tokens>
```

Put the same id in `studio/.env`:

```
SANITY_STUDIO_PROJECT_ID=<the id>
SANITY_STUDIO_DATASET=production
```

Then allow the site to read the dataset from the browser and let the Studio talk to it:

```
npx sanity cors add http://localhost:4341
npx sanity cors add https://stackback-roadmap.vercel.app
```

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

1. A merchant sends a question from the Queries tab. It arrives as `status: new`, invisible
   to everybody except the Studio. The team can also add one directly for a question that
   came in over WhatsApp or on a call.
2. Somebody answers it in **Needs an answer** and sets the status to **Answered and public**.
   The schema refuses to accept "answered" with an empty answer.
3. It appears in the Queries tab within a minute, ordered by how many stores raised it.

Nothing auto-publishes. A merchant's words never reach the public page until a person has
read them and written a reply.

## One thing to know about the free plan

On Sanity's free tier a dataset is **public-read**: anyone with the project id can read
every document in it, including a query still sitting at `status: new`. That is why:

- the submission form tells merchants not to include card details, passwords, or customer
  contact details, and
- `askedBy` carries the same warning in the Studio.

If inbound queries need to be genuinely private, move to a paid plan and switch the dataset
to private. Nothing in the code changes: it is a setting in `sanity.io/manage`. This is the
open question recorded in `memory/projects/stackback/open-questions.md` (2026-08-31),
narrowed to the one dataset that now holds merchant-written text.
