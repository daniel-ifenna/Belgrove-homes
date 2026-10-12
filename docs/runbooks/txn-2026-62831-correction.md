# Runbook: TXN-2026-62831 correction (amounts, dates, statement)

Apply from YOUR machine (never from the dev machine). Nothing below writes to
production from anywhere else. All money changes go through the admin UI's
linked reversal-and-replacement mechanism — never raw SQL, never in-place
edits. Statements and emails send only when an admin clicks.

Rehearsed on a scratch copy of production (2026-10-12): fresh migrate deploy
clean, TXN-2026-62831 graph copied (4 installments, 4 payments, 4 receipts),
backfill wrote 5 entries + 4 allocations with 0 mismatches, verify-ledger
"All agree" (ledger paid ₦12,000,000 / outstanding ₦6,500,000 = stored).

## 0. Observed state (production, read-only, 2026-10-12)

Plan 0–3 Months (code 3M): 50% initial = ₦9,250,000; Month 1/2/3 =
₦3,083,333 / ₦3,083,333 / ₦3,083,334. Total ₦18,500,000.

| PAY ref | amount (recorded) | paymentDate (raw, no tz) | bank ref | installment link | status |
|---|---|---|---|---|---|
| PAY-2026-18756 | ₦3,000,000 | 2026-08-09 00:00:00 | 262220980712 | Initial (#0) | CONFIRMED |
| PAY-2026-87544 | ₦3,250,000 (wrong) | 2026-08-12 00:00:00 | 262240986795 | Initial (#0) | CONFIRMED |
| PAY-2026-71254 | ₦3,000,000 | 2026-08-19 00:00:00 | 2623210148410 | Initial (#0) | CONFIRMED |
| PAY-2026-18810 | ₦2,750,000 (wrong) | 2026-09-24 00:00:00 | none | Month 1 (#1) | CONFIRMED |

Installments: Initial paid ₦9,250,000 PAID (3M + 3.25M + 3M — adjusted to
close the deposit); Month 1 paid ₦2,750,000 PARTIALLY_PAID; Month 2/3 unpaid.
Receipts RCT-2026-79860 / 69739 / 83436 / 29367, all emailed. Receipt printed
payment dates all match the Lagos-formatted payment dates (no mismatches —
verified 2026-10-12, see §6).

PAY-2026-18810 carries a long free-text reconciliation note claiming the
₦3,000,000 entry "does not represent an additional payment by the client".
That is wrong: the client paid ₦3,000,000 four times. The Correct action
moves that note verbatim into the correction audit record and clears it from
the payment row automatically — see §4.

The 1-day panel disagreement (09 Aug vs 08-08 etc.) is the timestamp/zone bug:
paymentDate is `timestamp without time zone` midnight, formatted in Lagos in
one place and server-local/UTC in another. Fixed by migration
`20261011000004_payment_date_only` (DATE column) + the shared
`formatDateDMY`/`formatLagos` helpers (explicit Africa/Lagos) + noon-UTC
normalization of new inputs. After the migration, every surface (Payment
History, statement panel + PDF, receipts, Payments ledger, dashboard
collected-this-month) formats the same calendar date.

## 1. Deploy migrations (production DATABASE_URL, your machine)

Production is at `20261011000002_step1_drop_email_trackers` (29 applied).
Four pending (plus `20261012031116_add_statement_issue_fields` if the new
statement template release is deployed together — see the statement report):

```sh
npx prisma migrate deploy
# expect: 20261011000003_corrections_statements,
#         20261011000004_payment_date_only,
#         20261012000000_step2_ledger_entries,
#         20261012000001_step3_payment_credit — no other pending.
```

All four are additive (new columns/tables; paymentDate timestamp→DATE keeps
the calendar day). Verify:

```sql
SELECT COUNT(*) FROM "LedgerEntry";       -- expect 0
SELECT COUNT(*) FROM "PaymentAllocation"; -- expect 0
-- TXN-2026-62831 still: totalPaid 12000000, outstandingBalance 6500000
SELECT "totalPaid", "outstandingBalance" FROM "Transaction" WHERE ref='TXN-2026-62831';
```

## 2. Backfill ledger + verify (same machine)

```sh
npx tsx scripts/backfill-ledger.ts            # dry-run: expect a WOULD line for TXN-2026-62831
npx tsx scripts/backfill-ledger.ts --apply    # expect: entries + allocations, 0 mismatched
npx tsx scripts/verify-ledger.ts              # expect: TXN-2026-62831 OK, "All agree."
```

Rehearsed expectation for TXN-2026-62831: 5 entries (1 CHARGE_BASE +
4 PAYMENT) + 4 allocations, ledger paid ₦12,000,000 / outstanding ₦6,500,000.

## 3. Deploy this release, then set the contract date

Deploy the app code (migrations first, §1). Then on TXN-2026-62831, in
Sale date & Corrections → Set contract date: enter the real sale date
(confirmed by you — the 09-10-2026 creation date is when the transaction was
*recorded*, after the August/September payments, so charges would sort last
until this is set). This re-dates the CHARGE entries with an audit row.

## 4. Confirm dates, then correct (admin UI, IN THIS ORDER)

(a) Reconcile: open each of the four payments and confirm its date against
the bank statement (Reconcile action with the statement line). Until a
payment carries a `Reconciled:` tick it shows a **Date unconfirmed** chip —
that is expected, not an error.

(b) Correct PAY-2026-87544 (₦3,250,000 → ₦3,000,000) FIRST — order matters
(see below). Reason + bank verification note required. This voids receipt
RCT-2026-69739 (bytes untouched, VOID banner + link to replacement) and
issues the replacement receipt (new RCT number, "Replaces RCT-2026-69739").

(c) Then correct PAY-2026-18810 (₦2,750,000 → ₦3,000,000). The long
reconciliation note on this payment is moved verbatim into the correction
audit record (`after.originalNotes`) and cleared from the payment row by the
Correct action itself — verify it appears under “View correction”.

Why this order: replacements waterfall from the oldest unpaid installment.
Correcting the ₦3.25M first leaves Initial at ₦9,000,000, so the second
replacement splits ₦250,000 to Initial (clearing the ₦9,250,000 deposit) +
₦2,750,000 to Month 1 — the expected end state. Reversing the order parks the
full ₦3,000,000 in Month 1 and leaves Initial ₦250,000 short (same ₦12M
total, wrong attribution).

Expected end state on the page:
- Header: `4 payments · ₦12,000,000 confirmed · ₦6,500,000 outstanding`.
- Four effective rows at ₦3,000,000; payments 1–3 “Applied to: Initial
  deposit ₦3,000,000 of ₦9,250,000”; payment 4 “Applied to: Initial deposit
  ₦250,000 of ₦9,250,000, Month 1 ₦2,750,000 of ₦3,083,333”.
- Both corrected rows show **Corrected** + “Originally recorded as …” with
  admin, date and reason; superseded toggle reveals the two originals
  (strikethrough + **Superseded** + VOID receipt links).
- Statement preview table = the PDF line for line: contract charge first,
  four ₦3,000,000 payments, balance ₦18,500,000 → ₦6,500,000, and **no
  corrections note** — the statement is the clean confirmed position. The
  void → replacement trail lives in the Corrections panel, the internal
  ledger, the activity feed, and the correction email.

## 5. Statement + emails (admin clicks only)

Preview (DRAFT) → Generate statement. If the dialog lists warnings (assumed
contract date, unticked bank dates, pending verification), tick “Issue
anyway” — the choice is audit-logged. If it lists data-check failures,
generation is blocked: fix the ledger first. Open View/Download and check it
against §4. Email the correction (replacement receipts + statement) via the
Corrections email dialog, and the statement via the per-statement Email to
client dialog (confirmation required). Nothing sends automatically —
generating or downloading never emails.

## 6. No-change confirmations (verified 2026-10-12)

- Receipt printed-date parity (read-only check): all four issued receipts'
  printed payment dates match their confirmed dates — no receipt needs
  reprinting for dates. No issued receipt is edited by this release (voids
  only mark VOID + link; stored PDFs are byte-identical).
- No sent email changes: correction/statement emails send only through the
  explicit dialogs in §5. Existing sent receipts keep their sentAt +
  resendEmailId proof untouched.

## Rollback

Migrations are additive; rolling back means redeploying the previous code
release. Corrections are audit-trailed reversals — a mistaken correction is
undone with a second correction, never an edit. Do not drop tables or edit
money rows outside the Correct/Void actions.
