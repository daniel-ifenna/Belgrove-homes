# Runbook: Step 2 ledger tables → production

Apply from YOUR machine (never from the dev machine). Order is load-bearing:
migration → backfill → deploy code. The new code dual-writes ledger rows, so
it requires the tables to exist; the backfill must run before the code deploy
(or immediately after — it is idempotent, rerun safely any time).

Expected values below were rehearsed on a scratch copy of production
(2026-10-11). Abort on any deviation and investigate before proceeding.

## 0. Pre-checks (production, read-only)

```sql
SELECT (SELECT COUNT(*) FROM "Transaction") AS txn,          -- expect 7
       (SELECT COUNT(*) FROM "Installment") AS inst,         -- expect 31
       (SELECT COUNT(*) FROM "Payment") AS pay,               -- expect 8
       (SELECT COUNT(*) FROM "Payment" WHERE status='CONFIRMED') AS confirmed, -- expect 8
       (SELECT COUNT(*) FROM "Receipt") AS rcpt,              -- expect 8
       (SELECT COUNT(*) FROM "LedgerEntry") AS entries,       -- expect 0 (table missing = ok, see step 1)
       (SELECT COUNT(*) FROM "PaymentAllocation") AS allocs;  -- expect 0 (table missing = ok)
```

If `LedgerEntry`/`PaymentAllocation` already exist with rows, a previous
partial apply happened — run the backfill dry-run first and compare.

## 1. Apply the migration

From the repo at the Step 2 commit, with production `DATABASE_URL`:

```sh
npx prisma migrate deploy
```

Expect: `20261012000000_step2_ledger_entries` applied, no other pending.
This migration is purely additive (two new tables, no changes to existing
tables). Verify:

```sql
SELECT COUNT(*) FROM "LedgerEntry";      -- expect 0
SELECT COUNT(*) FROM "PaymentAllocation"; -- expect 0
-- old counts unchanged: 7 / 31 / 8 / 8
```

## 2. Backfill (writes ledger rows only; rerun-safe)

```sh
npx tsx scripts/backfill-ledger.ts          # dry-run first: 7 WOULD lines, no writes
npx tsx scripts/backfill-ledger.ts --apply  # expect: 17 entries + 8 allocations, 0 mismatched
```

Expected per-transaction lines (ledger vs stored, all OK):

| ref | ledger paid / out | stored paid / out |
|---|---|---|
| TXN-2026-18517 | ₦10,185,000 / ₦10,185,000 | same |
| TXN-2026-89439 (PAID_IN_FULL) | ₦5,800,000 / ₦0 | same |
| TXN-2026-87153 | ₦2,598,750 / ₦2,598,750 | same |
| TXN-2026-86823 | ₦0 / ₦18,500,000 | same |
| TXN-2026-13217 | ₦0 / ₦18,500,000 | same |
| TXN-2026-19537 | ₦300,000 / ₦18,200,000 | same |
| TXN-2026-62831 (4 irregular payments) | ₦12,000,000 / ₦6,500,000 | same |

## 3. Verify (read-only, exit 1 on mismatch)

```sh
npx tsx scripts/verify-ledger.ts   # expect: 7 OK lines, "All agree."
```

## 4. Deploy the Step 2 code

Reads still come from the legacy stored columns — user-visible behavior is
unchanged. New confirms/voids additionally write ledger rows in the same DB
transaction (they fail loudly, never diverge silently).

## 5. Post-deploy

- Re-run `scripts/verify-ledger.ts` (a payment confirmed between backfill and
  deploy is covered by the new code; a void in that window is picked up by
  re-running the backfill once — it is idempotent).
- Keep the old balance reads until Step 6 switches them after nightly
  reconciliation proves ongoing agreement.

## Rollback

Additive release: rolling back means redeploying the previous code release.
`LedgerEntry`/`PaymentAllocation` rows are inert without the new code. Do not
drop the tables outside a planned cleanup release.
