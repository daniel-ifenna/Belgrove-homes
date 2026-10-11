# Payments & Ledger Audit — Phase 0 (read-only)

Date: 2026-10-11. Branch: `main`. Method: code + schema reading and read-only DB counts.
No edits, migrations, or data writes were made for this audit (this file is the only write).

## 0.1 Repo orientation

### Git state
- `git log --oneline -15` (newest first):
  `cdb97af`, `2486f20`, `75b2795`, `ba06aef`, `305b918`, `7aa2795`, `0ddfe78`,
  `8abd5cb`, `8224d39`, `ab4a7fa`, `3360956`, `ab93009`, `b9c80b2`, `154626e`.
  Headline themes: receipt PDF/outbox hardening, serverless PDF survival, booking refs.
- `git status --porcelain=v1`: **35 modified files, 9 untracked**. Nothing is committed;
  Phase 1 must reckon with this working tree (see §Risks).

Modified files relating to payments / transactions / receipts / bookings / admin portal
(all of the list below except the last group):
- `prisma/schema.prisma` (adds `Receipt.pdfData`, `EmailOutbox.priority/startedAt`)
- `src/app/admin/bookings/[id]/page.tsx`
- `src/app/admin/receipts/[id]/page.tsx`, `src/app/admin/receipts/page.tsx`
- `src/app/admin/search/page.tsx`
- `src/app/admin/transactions/[id]/page.tsx`, `src/app/admin/transactions/page.tsx`
- `src/app/api/admin/bookings/export/route.ts`
- `src/app/api/admin/receipts/[id]/pdf/route.ts`, `src/app/api/admin/receipts/[id]/resend/route.ts`
- `src/app/api/admin/transactions/[id]/payments/route.ts`
- `src/app/api/admin/transactions/[id]/payments/[paymentId]/confirm/route.ts`
- `src/app/api/admin/transactions/ledger/route.ts`
- `src/app/api/r/[token]/pdf/route.ts`
- `src/app/r/[token]/page.tsx`, `src/app/receipts/[ref]/page.tsx`
- `src/lib/__tests__/paymentConfirmation.test.ts`, `outbox.test.ts`,
  `receiptDelivery.test.ts`, `exports-wrapping.test.ts`, `phase1.test.ts`
- `src/lib/documents/exportTables.ts`
- `src/lib/email/outbox.ts`, `receiptOutboxSender.ts`, `resendProvider.ts`
- `src/lib/finance/index.ts`
- `src/lib/paymentConfirmation.ts`, `src/lib/paymentService.ts`
- `src/lib/receipt-render.ts`, `src/lib/receipt-storage.ts`, `src/lib/receiptDelivery.ts`
- `src/lib/receipts/emailReceipt.ts`, `src/lib/receipts/generateReceiptPdf.ts`,
  `src/lib/receipts/qr.ts`
- `scripts/regenerate-receipts.ts` (1-line diff)
- Unrelated to this audit: none — every modified file touches the money/receipt/email
  surface except arguably `src/app/admin/search/page.tsx` (1-line diff, search surface).

Untracked (new, uncommitted): `prisma/migrations/20261001000000_add_pdfdata_startedat/`,
`scripts/verify-qr-targets.ts`, and 7 new test files
(`bookings-export`, `bookings-pdf-acceptance`, `email-acceptance`, `financials`,
`ledger-sameday`, `ledger`, `receipt-sender` tests).

### Database
- Postgres 16 via `docker-compose.yml:1-12` (service `postgres`, port `5544`).
- `DATABASE_URL` in `.env.example:1`;
  `prisma.config.ts:4-9` sets schema `prisma/schema.prisma`, migrations dir, seed.
- Prisma schema location: `prisma/schema.prisma`. Provider: `postgresql`
  (`prisma/schema.prisma:6-8`).

### Relevant routes and components
- Admin UI: `src/app/admin/page.tsx` (dashboard), `src/app/admin/payments/page.tsx`
  (payments ledger), `src/app/admin/transactions/page.tsx` (list),
  `src/app/admin/transactions/[id]/page.tsx` (detail),
  `src/app/admin/transactions/[id]/RecordPaymentForm.tsx` (record form),
  `src/app/admin/transactions/[id]/PaymentSchedule.tsx` (schedule table),
  `src/app/admin/transactions/[id]/PaymentVerificationButtons.tsx` (confirm/void),
  `src/app/admin/transactions/new/` + `NewTransactionForm.tsx` (creation + plan selector),
  `src/app/admin/receipts/page.tsx`, `src/app/admin/receipts/[id]/page.tsx` +
  `ReceiptActions.tsx`, `src/app/admin/bookings/[id]/page.tsx` + `BookingActions.tsx`.
- API: `src/app/api/admin/transactions/route.ts` (list/create),
  `src/app/api/admin/transactions/[id]/payments/route.ts` (record POST, detail GET),
  `src/app/api/admin/transactions/[id]/payments/[paymentId]/confirm/route.ts`,
  `src/app/api/admin/transactions/[id]/payments/[paymentId]/void/route.ts`,
  `src/app/api/admin/transactions/ledger/route.ts` (company ledger PDF export),
  `src/app/api/admin/receipts/[id]/pdf/route.ts`, `.../resend/route.ts`,
  `src/app/api/admin/bookings/[id]/route.ts` (booking actions incl. Sold),
  `src/app/api/bookings/route.ts` (public intake), `src/app/api/r/[token]/pdf/route.ts`.
- Public: `src/app/r/[token]/page.tsx` (client receipt), `src/app/receipts/[ref]/page.tsx`
  (admin-only by-ref view, despite the path).
- Lib: `src/lib/paymentCalculation.ts` (amounts + schedule),
  `src/lib/transactionService.ts` (creation), `src/lib/paymentService.ts` (single-step
  record+confirm), `src/lib/paymentConfirmation.ts` (confirm/void DB core),
  `src/lib/finance/index.ts` (read-side money service),
  `src/lib/receipts/generateReceiptPdf.ts`, `src/lib/receipts/qr.ts`,
  `src/lib/receipts/emailReceipt.ts`, `src/lib/receipt-render.ts`,
  `src/lib/receipt-storage.ts`, `src/lib/receiptDelivery.ts`,
  `src/lib/email/outbox.ts`, `src/lib/email/receiptOutboxSender.ts`,
  `src/lib/ref.ts`, `src/lib/receipt-amounts.ts`, `src/lib/currency.ts`,
  `src/lib/app-url.ts`, `src/lib/receipt-access.ts`, `src/lib/documents/brand.ts`,
  `src/lib/inbox.ts`, `src/lib/time.ts`.

## 0.2 Data model (`prisma/schema.prisma`)

### Booking — `InspectionBooking` (`schema.prisma:40-142`)
Money/sale fields: `soldPrice Int?` (:86), `discount Int?` (:87), `totalPaid Int?` (:88),
`paymentMethod String?` (:89), `paymentHistory Json?` (:90), `soldAt`, `receiptSentAt` (:92),
`receiptUrl` (:93). These are **legacy/dead**: both bookings in the DB have `soldPrice`,
`receiptSentAt`, `receiptUrl` all NULL (§0.7), and no writer was found (see §0.5).
`isTest Boolean @default(false)` (:108). Status `BookingStatus` new/under_review/on_hold/
approved/rescheduled/active/closed; outcome `SaleOutcome` sold/interested/not_sold.

### Transaction (`schema.prisma:423-467`)
`ref String @unique` (TXN-YYYY-XXXXX), `bookingId String? @unique` (one booking ↔ at most
one transaction), `plotQuantity Int @default(1)`, `unitPrice Int`, `baseAmount Int`
(unitPrice × qty), `paymentPlanId`, `interestRate Decimal(5,2)`, `interestMethod String`,
`interestAmount Int @default(0)`, `totalPayable Int`, **`totalPaid Int @default(0)` stored**,
**`outstandingBalance Int` stored**, `status TransactionStatus @default(ACTIVE)`,
`isTest`, `customerId`, `manualReason`.

### Installment (`schema.prisma:469-485`)
`installmentNumber Int` (0 = initial), `type InstallmentType` (INITIAL/MONTHLY),
`dueDate DateTime`, `scheduledAmount Int`, **`paidAmount Int @default(0)` stored**,
**`status InstallmentStatus @default(PENDING)` stored**.

### Payment (`schema.prisma:496-526`)
`transactionId`, `installmentId String?` (nullable; set at record, re-pointed at confirm
if null), `paymentReference String @unique` (PAY-YYYY-XXXXX),
`amount Int`, `paymentDate DateTime`, `paymentMethod String?`, `bankReference String?`,
`notes String?`, `status PaymentStatus @default(PENDING_VERIFICATION)`,
`recordedById`, `confirmedAt`, `confirmedById`, `verificationNotes String?`,
`source String?`, **`idempotencyKey String? @unique`** (:519 — exists but has **no
writer and no reader**; see §0.4).

### Receipt (`schema.prisma:294-370`)
`ref String @unique` (RCT-YYYY-XXXXX), `bookingId?`, `transactionId?`,
`paymentId String @unique` (strict 1:1 payment↔receipt), `source ReceiptSource
@default(PAYMENT_CONFIRMATION)`, snapshot fields `property/estate/plotCode/unitType/sqm/
customerName/customerEmail/customerPhone`, `amountBeforeDiscount Int`,
`discount Int @default(0)`, `finalAmount Int` (= the payment amount),
`amountInWords String`, `currency` default NGN, `paymentDescription`,
`paymentMethod?`, `paymentHistory Json?` (**single-row snapshot of THIS payment only**,
written at confirm — `paymentConfirmation.ts:305`), `unitPrice?`, `plotQuantity?`,
`paymentPlanCode?/paymentPlanName?`, `issuedAt` (= payment date, not confirm time),
`sentAt?`, `recipientEmail`, `status ReceiptStatus @default(pending)`,
`receiptUrl`, `qrTargetUrl`, `pdfPath?` (legacy disk path),
`pdfStatus` default PENDING, `emailStatus` default PENDING, `lastError?`,
`accessToken String? @unique`, `accessTokenRevokedAt?`,
`pdfData Bytes?` (:354, **uncommitted schema change**) — stored PDF bytes.
Indexes on status/customerEmail/estate/issuedAt/bookingId (:365-369).

### Agent (`schema.prisma:185-201`), Customer (`:211-225`), audit/timeline
`Agent` (name/phone/email unique/category/isActive). `Customer` canonical record
(email unique, isTest). `BookingActivity` (:243-263) for bookings;
`AuditEvent` (:579-593) for payment/transaction/receipt mutations
(`payment.confirm|payment.void|payment.record|transaction.create|receipt.send|receipt.resend`).
`ReceiptSendAttempt` (:372-385) per send. `EmailOutbox` (:539-574) durable mail queue
with `dedupeKey @unique`, `priority` + `startedAt` (uncommitted additions).

### Money field types — no Float anywhere
All money columns are **`Int` (whole naira)**: booking soldPrice/discount/totalPaid,
receipt amountBeforeDiscount/discount/finalAmount/unitPrice, transaction
plotQuantity/unitPrice/baseAmount/interestAmount/totalPayable/totalPaid/
outstandingBalance, installment scheduledAmount/paidAmount, payment amount.
`interestRate` is `Decimal(5,2)` on `PaymentPlan` (:413) and `Transaction` (:440).
`grep Float|float` hits only `AGENTS.md`, float-rejection comments, and the
unrelated `FloatingWhatsApp` component name. **No Float in schema or money code.**
Caveat: the unit is whole **naira**, not kobo — internally consistent (validation
rejects non-integers, e.g. `payments/route.ts:16-18`), but finer than kobo is
unrepresentable.

### Stored vs computed balances
- **Stored**: `Transaction.totalPaid`, `Transaction.outstandingBalance`,
  `Installment.paidAmount`, `Installment.status`, `Booking.soldPrice/discount/
  totalPaid/paymentHistory` (dead), `Receipt.finalAmount/paymentHistory` (per-payment snapshots).
- **Every writer of the live stored balances**:
  1. `transactionService.ts:54-55,192-193` — create (0 / totalPayable).
  2. `paymentConfirmation.ts:265-273` — confirm path recomputes from CONFIRMED payments.
  3. `paymentConfirmation.ts:458-468` — void path recomputes.
  4. `scripts/reconcile-installments.ts:43-48,68-78` — manual `--apply` fix-up.
- **Computed at read time**: `src/lib/finance/index.ts` — `getCollectedRevenue`,
  `getTransactionSummary`, `getTransactionOverviews`, `getTransactionFinancials`,
  `getOverdueInstallments`, `getPendingVerification` — all derive from CONFIRMED
  payments and ignore the stored columns (except reading `totalPayable` as the contract term).

### Unique constraints / indexes
Booking.ref; Transaction.ref; Transaction.bookingId (unique, 1:1);
Payment.paymentReference; Payment.idempotencyKey; Receipt.ref; Receipt.paymentId;
Receipt.accessToken; EmailOutbox.dedupeKey; Customer.email; Agent.email; User.email.
Indexes: `Transaction(status,customerEmail,estate,paymentPlanId)`,
`Installment(transactionId+installmentNumber, status, dueDate)`,
`Payment(transactionId,installmentId,status)`, `Receipt(status,customerEmail,estate,
issuedAt,bookingId)`, `AuditEvent(entityType+entityId, createdAt)`.

### Statuses / enums and transitions
- `TransactionStatus` DRAFT/ACTIVE/PAID_IN_FULL/CANCELLED. Real transitions:
  create→ACTIVE; confirm→PAID_IN_FULL when outstanding hits 0
  (`paymentConfirmation.ts:270`, incl. force-PAID on all installments :275-280);
  void→ACTIVE (or DRAFT preserved) (`:465`). **DRAFT is never created** (model default
  is ACTIVE; both create paths hardcode `"ACTIVE"`) — the DRAFT branches are dead.
  No transaction-cancel flow exists.
- `InstallmentStatus` PENDING/DUE/PAID/PARTIALLY_PAID/OVERDUE/WAIVED (stored) vs the
  finance display vocabulary Paid/Late/Partial/Pending (`finance/index.ts:19-26`).
  **Two parallel status systems**; confirm/void derive stored status via
  `deriveInstallmentStatus` (`paymentConfirmation.ts:54-64`), reads display via
  `toDisplayStatus`. WAIVED is never written by current code (no waive path).
- `PaymentStatus` PENDING/PENDING_VERIFICATION/CONFIRMED/FAILED/CANCELLED/WAIVED.
  Used: PENDING_VERIFICATION (record) → CONFIRMED (atomic claim `:161-171`) or
  →CANCELLED (void). **PENDING/FAILED/WAIVED are never written** by current code.
- `ReceiptStatus` draft/pending/generated/sent/failed. Used: `generated` at confirm
  (`paymentConfirmation.ts:312`); `sent`/`failed` by the outbox sender
  (`receiptOutboxSender.ts:91-100`). `draft`/`pending` legacy.
- Receipt void status: **not found** — no VOID concept on receipts (target's void-banner
  is missing).

## 0.3 How the schedule is generated

- Code: `calculateTransactionAmounts` + `generateInstallmentSchedule`
  (`src/lib/paymentCalculation.ts:20-101`); called from both create paths
  (`transactionService.ts:22-27,61` and `:155-160,199`).
- Formulas: `baseAmount = round(unitPrice × plotQuantity)` (:26);
  `interestAmount = round(base × rate/100)` iff `interestMethod == "ONE_TIME_PERCENTAGE"`
  (:29-31); `totalPayable = base + interest` (:32). Interest is one-time at creation;
  nothing recomputes it on payment timing.
- Schedule: OUTRIGHT (`remainingInstallments == 0`) → single INITIAL for 100% (:50-58).
  Otherwise initial = `round(total × initialPct/100)` (:61), remainder split with
  `floor Hawkins` + remainder absorbed by the **last** monthly (:73-88), plus a
  verify-sum pass adjusting the last row (:93-98). **Sums exactly — no drift by
  construction.**
- Due dates: initial due = creation instant; month *i* due = startDate + *i* months via
  `setMonth` (`:81-82`). Statuses at creation: installment 0 = DUE, rest PENDING
  (`transactionService.ts:71,209`).
- Plan parameters live in the **database** (`PaymentPlan` rows); seeded by
  `prisma/seed.ts:30-58`. **Seed/DB drift found**: seed upserts codes
  `OUTRIGHT/PLAN_3M/PLAN_6M`, but the live DB holds `OUTRIGHT/3M/6M`
  (names "Outright", "0–3 Months" 50%+3×0%, "0–6 Months" 50%+6×5%).
  The UI and API read live DB rows (`transactions/route.ts:52`,
  `NewTransactionForm.tsx:29-30`), so the seed file as committed would create
  *duplicate* plans if re-run. No Flexible plan exists.

## 0.4 How a payment is recorded today

End-to-end ("Record Payment & Generate Receipt"):
1. UI: `RecordPaymentForm.tsx` — **installment picker is mandatory** (`:111-131`,
   locked to one row in the per-row drawer variant), amount **pre-filled from the
   selected installment's remaining due** (`:31,50-54`) but **editable** (`:134-136`):
   less = "Partial" hint, greater = "Over scheduled … will still be applied" hint.
   Client-side cap: amount > transaction outstanding is rejected (`:66-69,158`).
   Backdated dates allowed (plain date input, no lower bound).
2. API record: `POST .../payments/route.ts` — validates whole-naira integer (:16-18),
   re-checks outstanding (:28), defaults to next unpaid installment when none given
   (:30-34), **60-second duplicate guard** on identical pending rows (:46-57),
   creates `PENDING_VERIFICATION` + `payment.record` audit in a DB transaction
   (:61-89). **No per-installment cap at record time** (comment :36-40).
3. Confirm: `POST .../payments/[paymentId]/confirm/route.ts` + `PaymentVerificationButtons.tsx`
   (explicit dialog showing amount/installment/totals effect). DB unit
   `applyConfirmationDbUnit` (`paymentConfirmation.ts:157-366`): atomic
   PENDING→CONFIRMED claim (`updateMany` count check :161-171), installment resolution,
   **waterfall allocation** filling the targeted installment then rolling forward
   (:214-252), over-schedule excess → `OverScheduleError` with **zero writes** (:233-241),
   totals recomputed from CONFIRMED sum (:255-273), receipt row created (:283-321),
   receipt email queued via outbox in the same unit (:328-334), audit row (:337-347).
   PDF render + QR + email send happen **post-commit** (`confirm/route.ts:105-195`,
   `paymentService.ts:90-152` for the single-step initial-payment variant).
- One payment **can** span multiple installments (waterfall); multiple payments **can**
  hit one installment (partials). Early payments pre-fill later installments via the same
  waterfall. There is **no allocation-row table** — attribution lives only in
  `Installment.paidAmount` aggregates (per-payment explainability is missing).
- Idempotency: atomic confirm-claim (double-confirm → 409 `PaymentAlreadyHandledError`);
  60s record guard (double-click → returns existing row with `deduped:true`);
  outbox `dedupeKey` unique + P2002 mapping (`toUserFacingError`, `:111`).
  **But `Payment.idempotencyKey` is unimplemented**: column + unique index exist
  (`schema.prisma:519`, migration `20260928000000_phase1`), comment describes
  client-generated keys — no code writes or reads it. A retry with a changed
  amount/date after 60s creates a genuinely new row (arguably correct, but the
  documented key mechanism does not exist).
- Pending vs confirmed: yes — `PENDING_VERIFICATION` money never touches totals;
  only CONFIRMED counts. Single-step `recordPaymentAndGenerateReceipt`
  (`paymentService.ts:20-153`) records **and** confirms atomically for the optional
  initial payment at transaction creation.
- Edit/delete/reverse: **no edit, no delete**. Void only via `void/route.ts`:
  pending→CANCELLED without touching totals; confirmed→CANCELLED via
  `reverseConfirmedPaymentDbUnit` (`paymentConfirmation.ts:392-509`) which subtracts
  back across installments, recomputes totals, leaves the receipt row in place
  (audit trail that no longer counts), and flips a Sold booking back to Interested
  when the last confirmed payment is voided (:487-506). No RATE for REVERSAL entries,
  no corrected-receipt flow, no receipt VOID marking.

## 0.5 How receipts are generated today

### The "two origins" premise is stale — one active path exists
- **All 8 receipts in the DB are `source=PAYMENT_CONFIRMATION`** (§0.7). The only
  `receipt.create` in `src/` is the confirm unit (`paymentConfirmation.ts:283-321`).
- The booking "Mark as Sold" flow (`record_outcome=sold` in
  `src/app/api/admin/bookings/[id]/route.ts:438-496`) **creates no receipt and sends
  no email by design** (:462-466: "No email at the raw Sold step … fires at Transaction
  creation"). `BookingActions.tsx` (842 lines) contains **zero** receipt references.
- `ReceiptSource` still lists `BOOKING_FLOW`/`ADMIN_MANUAL` (`schema.prisma:288-292`,
  migration `20260924081003`), and the booking page renders a "legacy receipt" branch
  (`bookings/[id]/page.tsx:202-217`) — but both bookings have NULL legacy receipt
  fields and no code writes them. **No double-counting path exists today**, but the
  dead enum values + dead UI branch are traps for Phase 1 (a reintroduced booking-flow
  receipt would double-count).
- `AGENTS.md:28` ("Receipts are only ever created from a confirmed payment") matches
  reality; `phase1.test.ts:125` asserts it.

### Numbering
- Independent random refs, **not** derived from any booking/transaction ref:
  `RCT-YYYY-XXXXX` (`ref.ts:57-59`), payments `PAY-YYYY-XXXXX` (`:53-55`),
  transactions `TXN-YYYY-XXXXX` (`:49-51`), bookings `BEL-YYYY-XXXXX` (`:45-47`).
  All unique-constrained; `RCT`↔`PAY` 1:1 via `Receipt.paymentId @unique`.
  One client with several payments gets one independent `RCT-…` per payment — unique
  per receipt. The target's `BEL-…-R01` scheme does not exist.

### PDF generator, fonts, naira
- `generateReceiptPdf` (`src/lib/receipts/generateReceiptPdf.ts:93-391`): jsPDF A4,
  letterhead via `drawLetterhead` (`documents/brand.ts:44-91`, Belgrove address
  printed once in header), title/number, Issued-To (contacts only), gold amount panel,
  property table, payment-details block (`receipt-amounts.ts` order: This payment ·
  Installment · Total price · Paid to date · Balance · Discount-if->0), single-row
  payment history, amount in words, server-side signature, disclaimer footer, QR.
- Fonts: `NotoSans-Regular/Bold.ttf` (`src/lib/receipts/fonts/`), embedded via
  `addFileToVFS` (`generateReceiptPdf.ts:56-72`). **Verified with fontTools that both
  files contain U+20A6 (₦)** — the `¦`-instead-of-`₦` failure occurs only on the
  `helvetica` fallback path (comment at :69: "fallback to helvetica … Naira may
  break"). Font/signature reads use `process.cwd()+src/lib/…` fs paths (:11-13,
  `loadSignatureBase64` :46-54); embed/signature failures are caught and degrade
  silently (missing font → wrong glyph; missing signature → no signature). Not
  load-tested on serverless paths in this audit.
- No stamp/watermark — already removed (comment :350-351). No PART/FINAL label (missing).

### QR and base URL
- QR encodes the tokenized client URL (`qr.ts:3-14`, Q-correction, margin 2).
- Sole URL source: `getAppUrl()` reading **only** `APP_URL` (`app-url.ts:4-15`); throws
  in production when missing (confirm routes fail fast: `confirm/route.ts:60-72`,
  `paymentService.ts:56`). `phase1.test.ts:22-53` asserts no `localhost` outside
  `app-url.ts`/fixtures.
- `localhost` today: **not found** in any stored receipt URL — all 7 sent receipts use
  `https://www.belgrovehomes.com/r/…`. Two caveats: (a) `.env.example:9` documents the
  apex `https://belgrovehomes.com` while stored rows use the `www` subdomain —
  **apex-vs-www mismatch to resolve in Phase 1**; (b) stored `qrTargetUrl` can predate
  an APP_URL change — readers already defend via canonical re-derivation from
  `accessToken` (`receipt-render.ts:42-51`); `scripts/verify-qr-targets.ts` (untracked)
  exists to flag stale rows.
- Email link uses `receipt.receiptUrl` (stored at confirm); the email template
  (`emailReceipt.ts:40-91`) prints the URL + attaches the PDF + final-payment notice.

### Email template and failure handling
- Outbox-first delivery (`email/outbox.ts`): receipt row queued **inside** the confirm
  transaction, inline-sent post-response with retries/backoff; `sendReceiptForOutbox`
  (`receiptOutboxSender.ts`) reuses stored `pdfData` (regen only on explicit
  regenerate-&-resend). Failed sends mark `emailStatus/status=FAILED + lastError`
  (`:91-100`), write `ReceiptSendAttempt` rows, and **allow resend** (`resend/route.ts`
  reuses the same ref, cooldown dedupe, force/regen options). 1 of 8 receipts is
  currently `failed` (RCT-2026-69739, Resend 409 idempotency-key error — §0.7).

### Signature
- `src/lib/receipts/belgrove-cashier-signature.png` (71 KB), **server-side only**,
  fs-loaded at render (`generateReceiptPdf.ts:11,46-54,333-340`), never a public URL.
  Render continues without it on failure.

### Partial-payment content today
- Shows: this-payment (primary), installment label, total price, paid-to-date,
  balance remaining, discount-if->0 (`receipt-amounts.ts:21-34`,
  `generateReceiptPdf.ts:230-253`, admin page `receipts/[id]/page.tsx:47-57,120-139`,
  client page `r/[token]/page.tsx:56-68,105-122`).
- **Missing vs target**: no full prior-payments history table (single-row snapshot
  only), no running balance column, no PART/FINAL label, no next-expected line,
  no statement of account.

## 0.5b Public receipt page

- `/r/[token]` (`src/app/r/[token]/page.tsx`): **public, no login**; the 256-bit random
  `accessToken` (`app-url.ts:24-28`) **is** the authorization. Unknown/revoked/missing
  tokens → `notFound()` (`:41`, `receipt-access.ts:16-23` — revoked and unknown are
  indistinguishable, no existence oracle). PDF via `/api/r/[token]/pdf` (same gate).
  Enumeration resistance = token entropy only; **no rate limiting** on these routes
  (not found in this audit).
- `/receipts/[ref]` (`src/app/receipts/[ref]/page.tsx`): **admin-only** (internal role
  required, `:14-15`) — the path name is misleading but it never serves anonymous traffic.

## 0.6 Ledger integrity

- **No single "how much paid"**: four coexisting sources that can disagree —
  (a) `SUM(Payment WHERE CONFIRMED)`, (b) `SUM(Installment.paidAmount)`,
  (c) stored `Transaction.totalPaid`, (d) `SUM(Receipt.finalAmount)`.
  The finance service (a) is what reads use; the stored columns (b,c) are what
  writes maintain; (d) is snapshot-only. Drift is a known risk: `getOverdueInstallments`
  re-confirms money because "stored status lags" (`finance/index.ts:116-118`), and
  `reconcile-installments.ts` exists specifically to detect/fix drift.
- **Reconciliation today**: manual script only (`scripts/reconcile-installments.ts`,
  `--dry-run` default, `--apply` writes). **No nightly job, no cron, no admin alert.**
  Only cron routes are `/api/cron/outbox` (email) and `decay-leads`. No auto-correct
  outside explicit `--apply`.
- **Dashboard** (`src/app/admin/page.tsx:76-100`): "Collected this month" =
  `getCollectedRevenue` over the Lagos calendar month by `paymentDate`; "Pending
  verification" = count+total of PENDING_VERIFICATION; "Overdue" = per-installment
  `getOverdueInstallments` count + Σ(scheduled−confirmed); "Active Transactions" = row
  count. No monthly sales target exists anywhere (consistent with AGENTS.md:36-37).
- **Payments ledger page** (`src/app/admin/payments/page.tsx:49-70`): all-time
  `getCollectedRevenue()` + payment rows; pending floats first.
- **Company ledger export** (`ledger/route.ts:1-351`): chronological debit (sale at
  creation) / credit (**CONFIRMED payments by paymentDate**) PDF with running
  installment + company balances, opening brought-forward row, pending excluded and
  footnoted. Event-sourced at export time — ignores stored paid columns.
- **Overdue today = per-installment due dates** (`finance/index.ts:103-130`,
  `getTransactionFinancials` overdueCount :281, `toDisplayStatus` :21-26). The target's
  cumulative definition (expected-to-date − paid) does **not** exist; flexible-plan
  overdue-after-deadline does not exist (no flexible plans, no deadline field).

## 0.7 Existing data (read-only counts, live DB 2026-10-11)

| Model | Total | By status / notes |
|---|---|---|
| Transactions | 7 | ACTIVE 6, PAID_IN_FULL 1; `isTest=true`: 0; ref LIKE '%TEST%': none |
| Installments | 31 | PAID 4, DUE 2, PARTIALLY_PAID 1, OVERDUE 1, PENDING 23 |
| Payments | 8 | **all CONFIRMED** (no pending); amounts 300000–10185000 |
| Receipts | 8 | `sent` 7, `failed` 1; **all** `source=PAYMENT_CONFIRMATION` |
| Bookings | 2 | both `sold`; legacy receipt fields NULL |

- **Real (non-test) receipts already emailed — immutable**: 7 `sent` receipts, all to
  real client addresses (full list pulled during audit):
  RCT-2026-79860, RCT-2026-83436, RCT-2026-29367 (all
  valentinenzonweluzo93@gmail.com; TXN-2026-62831, which already carries **4**
  irregular payments — the flexible-payments reality predates this task);
  RCT-2026-20448 (daniel.ifenna.daniel@gmail.com, ₦10,185,000);
  RCT-2026-82298 (anthonymaxnn@gmail.com, ₦5,800,000, the PAID_IN_FULL txn);
  RCT-2026-56189 (divinesamuel853@gmail.com); RCT-2026-15146
  (raphealemmaunella20@gmail.com). All URLs are `https://www.belgrovehomes.com/r/…`.
- **Failed, needs attention**: RCT-2026-69739 → valentinenzonweluzo93@gmail.com,
  ₦3,250,000, `lastError: Resend error 409 … idempotency key … request body was
  modified` — a resend-key collision, retryable via Regenerate & resend.
- **Test data**: none flagged (`isTest` counts all 0; no `TXN-2026-TEST01` row exists
  in this database). There is **no safe-to-reset fixture** present — Phase 1 needs a
  seeding step before destructive tests. `scripts/mark-test-data.ts`,
  `clear-dev-data.ts`, `remove-test-data.ts` exist for that workflow.
- Balances (stored): e.g. TXN-2026-18517 payable ₦20,370,000 paid ₦10,185,000;
  TXN-2026-89439 PAID_IN_FULL ₦5,800,000/₦5,800,000/₦0; two zero-payment ACTIVE txns
  at ₦18,500,000 outstanding.

## 0.8 Target-design coverage table

| Target capability | Status | Evidence |
|---|---|---|
| Obligation / payments / receipts kept separate | Partial | Receipts 1:1 with payments (`schema.prisma:301`); but no ledger-entry model, no CHARGE/DISCOUNT/WAIVER rows — obligation = `totalPayable` scalar |
| Ledger-derived balances (`outstanding = payable − paid − discounts + reversals`) | Partial | Reads derive from CONFIRMED (`finance/index.ts`); stored columns duplicate truth and can drift; no DISCOUNT/WAIVER/REVERSAL entry types |
| Schedule as guide, never a gate | Partial | Waterfall spans installments (`paymentConfirmation.ts:214-252`); but record UI mandates an installment pick (`RecordPaymentForm.tsx:111-131`) and confirm rejects past-schedule excess (`:233-241`) |
| Append-only, reversals reference original, receipts voided not deleted | Partial | Void keeps rows (`void/route.ts`, `reverseConfirmedPaymentDbUnit`); but reversal is a status flip, not a linked REVERSAL entry; receipts have no void state |
| Integer money, no floats | Exists | All money `Int`, rate `Decimal(5,2)` (`schema.prisma`); float rejection at all inputs; `grep Float` clean |
| Outright plan | Exists | `OUTRIGHT` row in DB; single-installment branch (`paymentCalculation.ts:50-58`) |
| Fixed 0-3 / 0-6 schedules as expected installments | Exists | `3M`/`6M` rows in DB; generator + waterfall (`paymentCalculation.ts`, `paymentConfirmation.ts`) |
| Flexible plan (total + deadline + min deposit, no installments) | Missing | No such plan, no deadline/deposit fields anywhere in schema or `NewTransactionForm.tsx` |
| Interest frozen at creation | Exists | One-time calc (`paymentCalculation.ts:28-32`); never recomputed |
| Late fees as separate explicit charge | Missing | No fee/charge model; no such code |
| Ledger-entry table (CHARGE/PAYMENT/DISCOUNT/WAIVER/ADJUSTMENT/REVERSAL, kobo, direction, dates, method, bankRef, proof, status, confirmer, reversesId, idempotencyKey, note) | Missing | No such model; `Payment` covers a subset (amount/method/bankRef/status/confirmer) with no direction, no proofUrl, no reverses-link; `idempotencyKey` column exists but is unwritten/unread |
| Waterfall allocation + stored allocation rows | Partial | Waterfall applied (`paymentConfirmation.ts:224-252`); **no allocation rows** — only `paidAmount` aggregates |
| Derived installment status PAID/PARTIAL/DUE/PENDING | Partial | Two vocabularies exist (stored enum vs finance display); no DUE-vs-PENDING-by-date distinction matching target wording |
| Cumulative overdue (expected-to-date − paid); flexible overdue after deadline | Missing | Per-installment flags only (`finance/index.ts:103-130,261-304`) |
| Overpayment: reject unless explicit credit/overpayment path | Partial | Rejection exists (form `:66-69`, record `:28`, confirm `:182-189`); **no credit-balance path** — `newOutstanding < 0` throws (`paymentConfirmation.ts:260-262`) |
| Free-amount record form (hint only, no picker) + allocation preview | Missing | Picker mandatory + prefilled amount (`RecordPaymentForm.tsx`); no preview component |
| Save PENDING then Confirm; only confirmation effects ledger+receipt | Exists | Two-step flow + atomic confirm unit (`payments/route.ts`, `confirm/route.ts`, `paymentConfirmation.ts:157-366`) |
| One DB transaction + idempotency key against double-click/retry | Partial | Atomic claim + 60s guard + outbox dedupe; `Payment.idempotencyKey` mechanism described in schema comment but **not implemented** |
| Backdated payments allowed + audited | Partial | Backdating allowed (no lower bound); audit row exists but carries no backdate flag |
| One receipt per confirmed payment | Exists | 1:1 unique + single creator (`schema.prisma:301`, `paymentConfirmation.ts:283`) |
| Receipt numbering `BEL-…-R01` + QR/URL on full number; old format stays valid | Missing | Independent `RCT-…` refs (`ref.ts:57-59`); QR/URL use access token, not the ref |
| Receipt content: this-payment, words, method, bankRef, summary block, prior-payments history with running balance, PART/FINAL label, next-expected line | Partial | Summary block + words + method exist; bankRef stored but **not printed**; history = this-payment row only; no PART/FINAL label; no next-expected line |
| Belgrove header address once; property line once; title-case name; server-side signature; QR to hosted receipt | Exists | `brand.ts:28-35`, `generateReceiptPdf.ts` (letterhead, Issued-To contacts-only, `formatDisplayName`, signature block, QR) |
| Naira renders via embedded U+20A6 font | Exists* | Both NotoSans files verified to contain U+20A6; embedded at render (`generateReceiptPdf.ts:56-72`). *Residual risk: silent helvetica fallback misrenders — untested on serverless |
| Base URL from prod config, never localhost | Exists* | `getAppUrl()` + fail-fast + test (`app-url.ts`, `phase1.test.ts`). *Residual: apex-vs-`www` mismatch (§0.5) |
| Failed send marks Failed + resend allowed | Exists | `receiptOutboxSender.ts:91-100`, `ReceiptSendAttempt`, resend route (same-ref) |
| Void: REVERSAL entry + receipt VOID banner + link + corrected next-number receipt | Missing | Status-flip void only; receipt untouched, no banner, no replacement numbering |
| Final settlement: txn Paid Full + final receipt + Statement of Account PDF | Partial | PAID_IN_FULL + final-payment email line exist (`paymentConfirmation.ts:270`, `receiptOutboxSender.ts:52`); **no Statement of Account** |
| Statement of Account (on-demand PDF + admin view + emailable) | Missing | Not found |
| Invariants 1–8 enforced + tested | Partial | Fragments: schedule-sum testable by construction, 1:1 receipt asserted (`phase1.test.ts:125`), totals-recompute covered (`paymentConfirmation.test.ts`); no invariant suite, no allocation-sum or receipt-balance-position checks |
| Nightly reconciliation job + admin alert, no auto-correct | Missing | Manual `reconcile-installments.ts` only; no schedule, no alert |
| Transaction detail: derived header, allocation-derived schedule, behind/on-track/ahead, payments+receipts panel with resend/download/void | Partial | Derived header + schedule + history + receipt links + confirm/void + resend/download exist; no behind/on-track/ahead indicator; no allocation detail |
| Plan selector gains Flexible + deadline + min deposit | Missing | Three fixed plans only |
| Ledger page + dashboard from ledger (collected by effective date, outstanding receivables, cumulative overdue) | Partial | Collected-by-paymentDate + finance-service reads exist; outstanding-receivables aggregate and cumulative overdue do not |
| Re-plan action (regenerate remaining schedule + audit, ledger untouched) | Missing | Not found |
| Scenario suite (exact/partial/3-month-span/early/late/top-ups/overpayment+credit/backdate/double-click/reversal+corrected/interest-timing/rounding) | Partial | Waterfall/partial/void/rounding/dedupe covered in `paymentConfirmation.test.ts`, `finance.test.ts`, `ledger.test.ts`; backdate/credit/reversal-receipt/interest-timing scenarios not found as tests |

## Risks and migration concerns

1. **7 emailed receipts are immutable.** Ref numbering change must keep old `RCT-…`
   refs/URLs/QRs/PDF bytes valid (`pdfData` now stored). The `www` vs apex question
   must be settled before minting new URLs — existing QRs point at `www`.
2. **Large uncommitted working tree** (35 modified + 9 untracked, incl. an unapplied
   migration `20261001000000_add_pdfdata_startedat`). Phase 1 must start from a
   commit or stash; the schema diff (`pdfData`, outbox priority) is load-bearing for
   current behavior. Run `npm run check:migrations` per AGENTS.md:29-33 before any
   new migration.
3. **Seed/DB plan-code drift**: `seed.ts` says `PLAN_3M/PLAN_6M`, DB says `3M/6M`.
   Re-running seed creates duplicates; fix seed or backfill before adding Flexible.
4. **Dual status vocabularies + stored-vs-derived drift**: any Phase 1 backfill must
   recompute `paidAmount`/status from CONFIRMED payments and verify
   (use `reconcile-installments.ts --dry-run` first). TXN-2026-62831's 4-payment shape
   is the backfill test case.
5. **Dead-but-live-looking constructs**: `Payment.idempotencyKey` (unique column, no
   code), `DRAFT`/`FAILED`/`WAIVED` statuses, `BOOKING_FLOW`/`ADMIN_MANUAL` sources,
   booking legacy receipt columns, `/receipts/[ref]` path naming. Phase 1 should either
   implement or remove each — leaving them invites a second receipt origin.
6. **One failed receipt outstanding** (RCT-2026-69739, Resend 409) — resolve before
   claiming delivery invariants; it evidences a real dedupe-key hazard in resends.
7. **Fonts/signature load from `src/lib` fs paths** — verify under the production
   build (Turbopack/serverless file tracing) or the ₦ glyph silently regresses to
   `¦`-class breakage on the helvetica path.
8. **No test fixtures present** — all rows are real; Phase 1 needs seeded `isTest`
   transactions before exercising void/reversal/overpayment paths.

## Questions for the product owner

1. Receipt numbering: approve `BEL/TXN-…-R01` suffix scheme, and which prefix (booking
   `BEL-…` or transaction `TXN-…`)? Do old `RCT-…` numbers stay forever?
2. Canonical domain: apex `belgrovehomes.com` or `www.belgrovehomes.com` for all future
   receipt URLs/QRs/emails? Should old `www` rows be re-pointed or left?
3. Flexible plan terms: is there truly no interest and no intermediate expectation?
   What sets the final deadline, and is a minimum initial deposit required (amount/% )?
4. Overpayment credit: allowed at all? Refundable, reassignable to another transaction,
   or apply-to-future only? Who approves?
5. Discounts/waivers: who may grant them, and do they need approval + receipt-visible
   lines? (Today every receipt prints Discount ₦0.)
6. Re-plan: may admins rewrite the remaining schedule after confirmation? Any
   constraint (e.g. not shortening past-due expectations without approval)?
7. Proof of payment uploads (`proofUrl` in target): required at record time, and where
   stored (retention/PII rules)?
8. Backdated payments: any limit (e.g. not before transaction creation, or require a
   reason/note beyond N days)?
9. The failed RCT-2026-69739 receipt: resend (Regenerate & resend) now, or leave for
   Phase 1's corrected-receipt flow?
10. Statement of Account: client-visible at the same `/r/` link family, or admin-only
    until approved per transaction?

---
*End of Phase 0 report. Awaiting approval before Phase 1.*
