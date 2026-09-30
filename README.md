This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Email delivery flow (no cron)

Transactional email sends **inline, seconds after the request that queued it**.
There is no scheduler — every layer below runs inside request traffic:

1. **Enqueue** — each route writes `EmailOutbox` rows first (inside the
   business `$transaction` where one exists), so the mail is durable. Every
   row carries a deterministic `dedupeKey`; a repeat enqueue returns the
   existing row instead of inserting a duplicate (a concurrent-race insert
   hits the unique index and is converted to the same "return existing" via
   P2002 — a duplicate enqueue never fails the request).
2. **Inline send** — after the transaction commits, the route calls
   `scheduleInlineOutboxSend(ids)`, which runs inside `after()`,
   post-response: first `processOutbox({ ids })` for its own rows, then a
   batch drain of older due rows. Never blocks the request; an exception
   only defers rows to a later drain. Each claim is an atomic
   `PENDING → SENDING` conditional update, so concurrent drains racing on a
   row send it exactly once.
3. **In-process retries** — a failed send is retried twice more in-process
   (waits of 2s then 5s) before the row is deferred with `attempts`
   incremented, `lastError` set, and `nextAttemptAt` on exponential backoff
   (0.5/2/8/32/128 min, 5 attempts, then FAILED). Fits inside
   `maxDuration = 30` on every sending route.
4. **Drain on admin inbox load** — the inbox page and its counts route call
   `drainOutboxOnAdminInboxLoad()`, one background pass over due rows at
   most once per 60s per server instance, so deferred mail keeps moving
   while an admin works.
5. **Retry now** — each "Stuck emails" (`EMAIL_STUCK`) inbox item has a
   button posting the row id to the admin-session-authenticated
   `POST /api/admin/outbox/retry`, which runs the row through the standard
   path and returns its new status.
6. **Manual drain** — `GET`/`POST /api/cron/outbox`, bearer-protected with
   the app's `CRON_SECRET` (header or `?secret=`), for manual recovery:

```bash
curl -X POST "https://belgrove-homes-uu1x.vercel.app/api/cron/outbox" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: `{"ok":true,"sent":N,"failed":N,"deferred":N}`. `401` means the
caller secret differs from the app's `CRON_SECRET`; `500` means the app has
no `CRON_SECRET` configured at all.

Ops signal: mail unsent for >15 min appears in the admin inbox as
"Stuck emails"; claims orphaned by a dead worker (>3 min in `SENDING`)
are automatically reset to `PENDING` on the next run.

Email provider: `EMAIL_PROVIDER` is `"smtp"` by default (Zoho). When direct
SMTP stalls from the host (Vercel → Zoho), flip it to `"resend"` and set
`RESEND_API_KEY` (Vercel project env too) — but verify the sending domain in
Resend first, or every row fails fast with a permanent 4xx. Each send carries
the outbox row id as Resend's `Idempotency-Key`, so retried rows never
double-send.

Money figures come from `src/lib/finance/` (CONFIRMED payments only).
Data-changing scripts live in `/scripts` and default to `--dry-run`.
