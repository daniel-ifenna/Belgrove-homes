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
