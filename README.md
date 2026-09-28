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

## Email outbox + production cron (required)

All transactional email is queued in the `EmailOutbox` table and delivered by
`processOutbox()` with exponential backoff (2/4/8/16/32 min, 5 attempts, then
FAILED). Every enqueue also triggers a non-blocking in-app kick, but
production MUST run a cron every minute as the reliable driver:

```bash
curl -X POST "https://belgrovehomes.com/api/cron/outbox" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` (see `.env.example`) to a long random string, identical in
the app environment and the cron caller. Without it the route returns 401;
without the cron, mail still sends via the kick but has no retry driver if
the process restarts mid-queue.

Money figures come from `src/lib/finance/` (CONFIRMED payments only).
Data-changing scripts live in `/scripts` and default to `--dry-run`.
