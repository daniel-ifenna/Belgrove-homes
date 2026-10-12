# Statement diagnosis: why the app still produces the OLD statement

Date: 2026-10-12. All database reads read-only; nothing written anywhere.
Reference staged at `docs/reference/statement-template/` (4 PNGs, `sample-issued.pdf`,
`render-fixtures.mjs` — viewed). **Missing: `statement-html.mjs`, `fixture-62831.json`**
(searched repo, /tmp, Downloads, Desktop, Documents — absent everywhere).

## 1. What is running

- Branch `feat/ledger-flexible-payments`, HEAD `5733bf7`, plus a large **uncommitted**
  tree (all statement work — `src/lib/statements.ts`, `src/app/s/`, statement routes —
  is untracked; `src/lib/statement.ts` is modified).
- The app runs as local `next dev` (Next 16.3.3 Turbopack; `next-server` observed in
  this repo dir; `.next/` present).
- **Not a stale build.** Proof, 2026-10-12: ran the repo's own `getEffectiveEntries`
  + `buildStatementRows` + `generateStatementPdf` against the **live production
  ledger** and reproduced every reported defect exactly:
  `09-08 bal -3,000,000 → 12-08 -6,250,000 → 19-08 -9,250,000 → 24-09 -12,000,000 →
  09-10-2026 Contract price → closing 6,500,000`, no `stmt-v1` marker in the PDF text.
  The defects are inherent in the current code + live data (contractDate NULL,
  uncorrected amounts), not caching. (An earlier same-day `.next` staleness incident
  was resolved by rebuild and is unrelated.)

## 2. What produces the DRAFT today

- Route: `src/app/api/admin/transactions/[id]/statement/preview/route.ts`
- Handler: `GET` → `getEffectiveEntries(prisma, id)` (`src/lib/finance/ledger.ts`)
  → `generateStatementPdf({... statementNumber: null ...})` (`src/lib/statement.ts`).
- Library: **jsPDF** with hand-set coordinates (`doc.text(str, x, y)` throughout).
  The overprint is literal in the code: Details line 1 and line 2 are both drawn at
  `y + 4.5` (`src/lib/statement.ts`, payment-row block). The "tall dark band" is the
  14-unit totals rect vs 7-unit rows. No layout marker exists anywhere in `src/`
  (grep for `stmt-v1`/`layoutVersion`: only the Statement-record select in
  `src/app/s/[token]/page.tsx` has no such field — the Prisma model has none).

## 3. Generator inventory (exhaustive, non-test code)

| Generator | File | Callers |
|---|---|---|
| `generateStatementPdf` (jsPDF — the ONLY statement PDF producer) | `src/lib/statement.ts` | preview route (`statement/preview/route.ts`); `issueStatement` (`src/lib/statements.ts`) |
| `issueStatement` (store + hash-reuse, serves stored bytes, never regenerates) | `src/lib/statements.ts` | `statements/route.ts` (Generate), `statements/[statementId]/route.ts` (View/Download), `statement/route.ts` (Download), `statements/[statementId]/email/route.ts`, `corrections/email/route.ts` (both attachments = stored bytes) |
| Panel tables (no PDF) | `page.tsx` via `buildStatementRows` | preview + internal tables |

No second/old statement module exists. Receipt PDFs (`generateReceiptPdf`) and the
Excel exports (`bookings/export`, `transactions/ledger`) are separate documents,
not statements. No code path emails a statement except the two explicit
admin-confirmed endpoints (`statements/[statementId]/email`, `corrections/email` —
both require session + `confirm:true`-style explicit action and write audit rows);
payment confirm/settle/correct/generate paths send nothing about statements
(receipt emails only). No statement has ever been emailed: production holds
**0 Statement rows** (verified 2026-10-12).

## 4. Caching: ruled out

Preview responds `Cache-Control: private, no-store, must-revalidate`; `next.config.ts`
+ `src/proxy.ts` force `no-store` on all `/api/admin/*`; the route is
`force-dynamic`, renders on the fly, performs no stored-PDF lookup. The output is
"unchanged" because the code path is unchanged.

## 5. What of the template-build spec exists (`git log --oneline -- <files>`)

Only one committed change ever touched statement code: `433f118 step4`. Everything
else is uncommitted. The build spec (`opencode-statement-template-build.md`) was
**never implemented** (that session was stopped at the missing-reference gate).

| Spec section | Status | Evidence |
|---|---|---|
| §2 `buildStatementModel` + shape | **No** | Have `buildStatementRows` + `getEffectiveEntries`; no model fn, no `asOf`, no company block, no `layoutVersion` |
| Contract fallback → earliest payment | **No** | Charges use `contractDate ?? createdAt` (backfill) / creation (live); prod charge sits at 09-10-2026 |
| Ordering comparator | **Yes** | `compareLedgerEntries` in `finance/ledger.ts`, shared by rows + hash |
| Exclusions (pending/cancelled/reversed) | **Yes** | `getEffectiveEntries` |
| Refunds (`Refund, <M>`, negative payments) | **No** | No REFUND handling; negative payment amounts rejected upstream |
| Discount label/net first cell | **Partial** | Net totals implemented; label stays "CONTRACT PRICE" |
| Method Title Case | **Partial** | Raw stored strings pass through (`paymentMethod` free text) |
| Invariants + DATA CHECK banner + generate-blocking | **No** | |
| §3 layout (positions, pagination, slim header) | **Partial** | jsPDF approximation with the six reported defects; no measured two-line rows; no continuation header; footer math differs from reference |
| Fonts (Noto only, U+20A6 assertion, pdffonts test) | **Partial** | Noto embedded via `pdf-assets`; no assertion, no pdffonts test |
| §4 edge cases | **Partial** | Zero-payment/settled render; no discount-label/refund/credit-balance/120-row paths proven |
| §5 panel from same model + warnings/blocking | **Partial** | Same *rows* fn, not a model; no warnings dialog, no blocking, no "Issue anyway" audit |
| §6 record + storage | **Partial** | Have number/token/hash/closing/email-proof + stored `pdfData` bytes (private, in-DB — never under `public/`); **lack** `asOfDate`, `generatedBy`, `layoutVersion`, `pdfStorageKey`, `pdfSha256` |
| §7 QR + `/s/[token]` | **Mostly** | 256-bit token, QR to `getAppUrl()/s/<token>` (loud localhost refusal in prod ✓), page shows one statement + newer-link + download, generic 404, IP rate limit (30/15m) — **lack** `X-Robots-Tag: noindex`, QR-decode test |
| §8 manual email | **Yes** | Dialog + explicit endpoint + idempotency + audit + minimal record; no auto-sends found |
| §9 assets | **Yes** | Stamp PNG in private server storage, loaded server-side; receipt logo reused |
| §10 must-not-appear | **Mostly** | Corrections note already removed; no Debit/Credit labels; still: negative balances (data, not renderer), `₦-N` in panel (`formatNaira` on negatives), contract after payments (data) |

## 6. Where the app runs / Chromium viability — UNRESOLVED

No hosting config in the repo (`vercel.json`, `Dockerfile`, `fly.toml`, `render.yaml`,
`Procfile` all absent; README is boilerplate; deploy target unknown). Without the
host, approach (A) `@sparticuz/chromium` vs (B) container PDF service cannot be
chosen, and `$PORT`/memory/`maxDuration` limits are unknown. `APP_URL` loud-fails
on localhost in production, so QR URLs are safe once deployed. Localhost Chromium
could be trialled on this Mac, but that answers nothing about production.

## Blocker for PART 2

`statement-html.mjs` — the tested renderer Part 2 must call ("Do not re-style or
re-implement the layout") — was never supplied (present: 4 PNGs, sample PDF,
harness with author-machine paths, stamp, prompt-embedded fixture JSON, which
`render-fixtures.mjs` can regenerate). **Part 2/3 stopped here.** Recommended
alternatives in the closing report.
