<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# Belgrove Homes Operations — Agent Rules

## Stack
Next.js (App Router, Turbopack) + Prisma. Admin app for inspection bookings, transactions
(installment payment plans), payments, receipts, agents. Currency NGN.

## Non-negotiable rules
1. Money: never use floats. Use the existing money type (Decimal or integer kobo); if floats
   are found, flag them. All money formatting goes through one shared formatter.
2. Transactions: prisma.$transaction callbacks contain DB work ONLY. No PDF generation,
   file I/O, email, HTTP, or heavy computation inside. Side effects run after commit.
3. Single source of truth: all financial figures (collected revenue, paid, outstanding,
   overdue, target progress) come from the shared finance service in src/lib/finance/.
   No page or component computes money totals with its own query.
4. Confirmed payments are the financial truth. Pending and voided payments never count
   as paid or as revenue. Records flagged isTest never appear in metrics or queues.
5. Receipts are only ever created from a confirmed payment. No manual receipt path.
6. Schema changes go through `prisma migrate dev` with descriptive names. Never edit
   existing migrations. Never use prisma db push. All schema changes go through migration
   files. Run `npm run check:migrations` after any migration change — it deploys history
   to a fresh database and requires an empty diff against schema.prisma.
7. Data-changing scripts live in /scripts, default to --dry-run, print exactly what they
   would change, and only apply with --apply.
8. Never render raw errors, stack traces, Prisma messages or file paths in the UI. Return
   friendly messages; log full errors server-side.
9. No hardcoded origins (localhost, ports, domains). Use getAppUrl() from src/lib/app-url.ts.
10. Emails go through the email outbox (once it exists). Never block a user request on
    sending an email.
11. Every phase ends with: type-check, lint, tests, `next build` all passing, and a summary
    of files changed, migrations, scripts, and open TODOs.
12. Keep the existing visual identity (colors, fonts, Belgrove branding). No unrelated
    refactors.