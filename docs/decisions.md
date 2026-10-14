# Product decisions (Phase 1)

Owner-overridden decisions first; then defaults for audit questions not yet answered.
Conservative option chosen wherever the owner was silent. Updated as answers arrive.

## Owner decisions (2026-10-11, Step 1 brief)

1. **Receipt numbering**: keep `RCT-2026-xxxxx` (one per confirmed payment already).
   No `-R01` suffixes. Show transaction + booking refs on the receipt as
   "Account reference" (Step 4).
2. **Canonical public URL**: `https://www.belgrovehomes.com` (matches all sent links).
   Single `getAppUrl()` reader (kept, not renamed); `.env.example` updated to www;
   production refuses localhost/127.0.0.1 origins loudly. Apex→www redirect is a
   hosting/DNS task (owner): checked 2026-10-11, apex returns 200 with NO redirect.
3. **Dead enums / legacy booking receipt columns** (`BOOKING_FLOW`, `ADMIN_MANUAL`,
   `InspectionBooking.soldPrice/discount/totalPaid/paymentMethod/paymentHistory/
   soldAt/receiptSentAt/receiptUrl`): removed in the final cleanup migration after
   proving zero rows/paths reference them. Walk-in manual flow
   (`manualReason` transactions → same payment-confirm path) verified working first.
4. **Overpayment**: reject above outstanding unless admin explicitly records the extra
   as credit (Step 3). Never silently truncate.
   **Overridden 2026-10-14 (owner request):** no amount gate anywhere. Any positive
   whole-naira amount records and confirms; schedule excess auto-parks as a visible
   credit balance (`isCredit + creditAmount`, negative outstanding shown as credit).
   Still never truncated — but no longer explicitly ticked. `OverScheduleError` /
   `wouldExceedSchedule` remain exported for backward compatibility only.
5. **Payment idempotency**: `Payment.idempotencyKey` wired up properly; 60s guard
   retired once enforced (Step 3). Email sends: same key + byte-identical body for
   retries of one logical send; fresh key per user-initiated resend (Step 1).

## Defaults for unanswered audit questions (conservative)

6. **Discounts/waivers** (Step 2): explicit ledger entries, admin-only, approval
   recorded in audit; always printed on receipts (no silent ₦0 lines dropped).
7. **Re-plan** (Step 5): admin-only, regenerates remaining expected schedule only,
   full audit entry, ledger untouched. No shortening of past-due expectations without
   a second admin note (recorded, not enforced in v1).
8. **Proof uploads** (Step 3): optional `proofUrl` at record time; same storage rules
   as today (no new store introduced in v1).
9. **Backdating** (Step 3): allowed, no date floor, but every backdated payment keeps
   an audit entry with both effective and recorded dates.
10. **Failed RCT-2026-69739**: resend via the new Resend button after Step 1 lands;
    do not touch it before (its 409 state is evidence for the fix verification).
11. **Statement of Account** (Step 4): admin view + on-demand PDF + emailable to the
    client on request. No automatic client link in v1.
12. **Flexible plan** (Step 5): no interest, no intermediate expectations; deadline
    required, minimum deposit optional; overdue only after deadline.
13. **Resend log retention**: 30 days across all plans (Resend docs, checked
    2026-10-11). `resendEmailId` deep-links within that window; our three stored
    fields are the permanent proof.

## Hosting secrets (Step 1b)
- Deleted from code: Zoho SMTP path. After deploy, remove from hosting env:
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ZOHO_APP_PASSWORD`,
  `EMAIL_PROVIDER`. Keep `SMTP_FROM` (sender address, now used for Resend),
  `RESEND_API_KEY`, `APP_URL` (= `https://www.belgrovehomes.com`).
- Rotate/revoke: the Zoho app password for `info@belgrovehomes.com` (no longer used
  anywhere); audit who else holds it before revoking.

## Step 2 ledger deviations from target (conservative)

- **No PENDING entries**: only CONFIRMED payments become `PAYMENT` entries.
  Pending money lives in `Payment` rows only. (Target listed a PENDING status;
  redundant once pendings are excluded.)
- **TEXT types, not enums**: entry `type`/`direction` are validated in
  `src/lib/finance/ledger.ts` so new types never need an enum migration.
  Amount positivity likewise enforced in the service (no DB CHECK, keeping
  `migrate diff` clean).
- **Void deletes allocation rows** for that payment (attribution of live money),
  while the money correction is the append-only `REVERSAL` entry. Stored
  `paidAmount` reversal logic unchanged.
- **Pre-backfill voids** (no `PAYMENT` entry found) log loudly and still reverse
  stored columns — never block the void.
- **Dual-write until read-switch**: confirm/void/creation write ledger rows AND
  legacy stored columns in the same transaction. Reads unchanged (stored +
  finance service). `verify-ledger.ts` proves agreement; nightly reconciliation
  (Step 6) takes over thereafter.

## Step 3 recording deviations from target (conservative)

- **Installment picker removed entirely** (not even as a start hint): confirm
  always waterfalls from the oldest unpaid installment. The form suggests the
  next due amount as a hint and previews the exact allocation pre-save.
- **Credit model**: `Payment.isCredit + creditAmount`; allocation capped at
  schedule capacity, `PAYMENT` entry holds the full amount, negative
  outstanding displayed as "Credit ₦X". No separate credit table, no
  refund/reassignment flow yet (needs Step 4+ receipt/statement work).
- **Idempotency**: client UUID per form open, server requires it (400 if
  missing), unique constraint enforces; 60s window deleted. Same-key replay
  returns the existing row even across restarts.
- **Backdating**: allowed, flagged in the `payment.record` audit
  (`backdated` + paymentDate); no date floor (per decision 9).
- **Void flow unchanged** (status flip + REVERSAL entry from Step 2); no delete
  path exists anywhere — verified, not just asserted.

## Step 4 receipt/statement deviations from target (conservative)

- **No QR graphic on the Statement of Account**: there is no public statement
  page to point it at, and a QR to an unrelated URL would mislead. Branding,
  letterhead, footer and generation date match receipts; every payment row
  carries its verifiable receipt ref instead. Revisit if a public statement
  page is ever built.
- **Helvetica fallback removed by making Noto mandatory**: missing fonts or
  signature now throw (loud, recoverable PDF failure) instead of silently
  rendering ₦ as ¦ or an unsigned receipt. Assets resolve module-relative so
  serverless file tracing bundles them.
- **No schema changes in Step 4**: all new content (history, labels, refs)
  derives from already-stored rows. Bank reference renders from the Payment
  row (never copied onto the receipt snapshot).
