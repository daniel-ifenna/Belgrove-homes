# Runbook: Step 3 recording flow → production

Apply from YOUR machine. Order: migration → backfill → verify → deploy code.
The migration is additive (two nullable-friendly columns); the code requires
it (confirm reads `isCredit`), so migration-first is mandatory.

## 0. Pre-checks (production, read-only)

```sql
SELECT (SELECT COUNT(*) FROM "Transaction") AS txn,            -- expect 7
       (SELECT COUNT(*) FROM "Payment") AS pay,                 -- expect 8
       (SELECT COUNT(*) FROM "Payment" WHERE "isCredit") AS credit; -- expect 0
-- NOTE: pre-checks fail before the migration (columns missing) — that is
-- expected. Run the txn/pay counts only; check credit after step 1.
```

Step 2 post-state must hold: `scripts/verify-ledger.ts` → "All agree."

## 1. Apply the migration

```sh
npx prisma migrate deploy
```

Expect: `20261012000001_step3_payment_credit` applied, nothing else pending.
Verify:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name='Payment' AND column_name IN ('isCredit','creditAmount');
-- expect both rows
SELECT COUNT(*) FROM "Payment" WHERE "isCredit"; -- expect 0
```

## 2. Backfill + verify (idempotent, rerun-safe)

```sh
npx tsx scripts/backfill-ledger.ts --apply  # expect: 0 new writes, 0 mismatched
npx tsx scripts/verify-ledger.ts            # expect: 7 OK lines, "All agree."
```

(The backfill now understands credit rows; with zero credit payments live it
writes nothing. Any payment confirmed between this run and the code deploy is
covered by the new code; re-run verify after deploy.)

## 3. Deploy the Step 3 code

User-visible changes: free-amount record form with live allocation preview,
explicit-credit overpayment path, idempotency-key dedupe (60s window retired),
backdate audit flags, credit display on transaction detail. Reads still come
from the legacy stored columns — no balance figures change.

## 4. Post-deploy

- Re-run `scripts/verify-ledger.ts` → "All agree."
- Record-then-void one test payment only if test fixtures exist (none live —
  do NOT test on real transactions).

## Rollback

Redeploy the previous code release. `isCredit`/`creditAmount` columns are
ignored by old code (reads/writes unaffected). No data migration to undo.
