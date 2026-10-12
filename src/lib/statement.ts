import { orderLedgerEntries } from "./finance/ledger";
import { formatDateDMY } from "@/lib/time";

// Statement of Account: chronological ledger for one transaction — every
// charge, payment, discount, waiver and reversal with a running balance,
// closing balance and generation date. Same branding as receipts. No QR
// graphic: there is no public statement page to point it at; each payment
// row carries its verifiable receipt ref instead.

export type StatementEntry = {
  id: string;
  type: string;
  amount: number;
  direction: string; // DEBIT | CREDIT
  effectiveDate: Date | string;
  createdAt: Date | string;
  method?: string | null;
  bankReference?: string | null;
  paymentReference?: string | null;
  receiptRef?: string | null;
  note?: string | null;
  // Second grey line override, used for the contract charge's property line
  // ("Sunrise Estate, SUN-P1-500SQM"). Set via withChargeSubtitle so the PDF
  // and the web panel print it identically; payments always use the ref line.
  subtitle?: string | null;
};

export type StatementRow = {
  date: string;
  details: string;
  // Small grey second line: `Ref <bank ref> · Receipt <RCT>` — segments
  // omitted when missing, never trailing separators or empty dots.
  line2: string | null;
  debit: number | null;
  credit: number | null;
  balance: number;
};

export function refLine(bankReference: string | null | undefined, receiptRef: string | null | undefined): string | null {
  const parts: string[] = [];
  if (bankReference) parts.push(`Ref ${bankReference}`);
  if (receiptRef) parts.push(`Receipt ${receiptRef}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Property second line for the contract charge, matching the layout
// reference ("Sunrise Estate, SUN-P1-500SQM"): estate + SKU, segments omitted
// when missing, never trailing separators.
export function chargeSubtitle(estate: string | null | undefined, plotCode: string | null | undefined): string | null {
  const parts = [estate?.trim(), plotCode?.trim()].filter((s): s is string => !!s);
  return parts.length > 0 ? parts.join(", ") : null;
}

// Attach the property line to every CHARGE entry. Call it in the statement
// issuer, the DRAFT preview route and the transaction-page preview alike —
// all three consume the same line model, so panel and PDF can never disagree.
export function withChargeSubtitle(entries: StatementEntry[], subtitle: string | null): StatementEntry[] {
  if (!subtitle) return entries;
  return entries.map((e) => (e.type.startsWith("CHARGE") ? { ...e, subtitle } : e));
}

export function describeStatementEntry(e: StatementEntry): string {
  switch (e.type) {
    case "CHARGE_BASE":
      return "Contract price";
    case "CHARGE_INTEREST":
      return "Interest (one-time charge)";
    case "CHARGE_FEE":
      return "Fee";
    case "PAYMENT":
      return `Payment received${e.method ? `, ${e.method}` : ""}`;
    case "DISCOUNT":
      return "Discount";
    case "WAIVER":
      return "Waiver";
    case "ADJUSTMENT":
      return e.note ? `Adjustment — ${e.note}` : "Adjustment";
    case "REVERSAL":
      return "Reversal (voided payment)";
    default:
      return e.note ? `${e.type} — ${e.note}` : e.type;
  }
}



// Ordered by the shared ledger rule (effective date, charge before payment,
// recorded time, id) — backdated payments land correctly. Running balance =
// amount still owed after each row.
export function buildStatementRows(entries: StatementEntry[]): { rows: StatementRow[]; closing: number; totalCharges: number; totalPaid: number } {
  const ordered = orderLedgerEntries(entries);
  let balance = 0;
  let totalCharges = 0;
  let totalPaid = 0;
  const rows: StatementRow[] = ordered.map((e) => {
    const isDebit = e.direction === "DEBIT";
    balance += isDebit ? e.amount : -e.amount;
    // Discounts, waivers and downward adjustments read as negative amounts
    // in the Charges column; genuine refunds (negative payments) read as
    // negative amounts in the Payments column (the sign rides the value).
    const negativeCharge = isDebit && (e.type === "DISCOUNT" || e.type === "WAIVER" || (e.type === "ADJUSTMENT" && e.amount < 0));
    if (e.type.startsWith("CHARGE")) totalCharges += e.amount;
    if (e.type === "DISCOUNT" || e.type === "WAIVER") totalCharges -= e.amount;
    if (e.type === "PAYMENT") totalPaid += e.amount;
    if (e.type === "REVERSAL") totalPaid -= e.amount;
    return {
      date: formatDateDMY(e.effectiveDate),
      details: describeStatementEntry(e),
      line2: e.subtitle || refLine(e.bankReference, e.receiptRef),
      debit: isDebit ? (negativeCharge ? -e.amount : e.amount) : null,
      credit: isDebit ? null : e.amount,
      balance,
    };
  });
  return { rows, closing: balance, totalCharges, totalPaid };
}