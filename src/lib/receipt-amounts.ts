// Single source of truth for the receipt amounts block order and wording.
// Used by the admin receipt page, the client receipt page, and the PDF
// template so all three read: This payment · Installment · Total price ·
// Paid to date · Balance remaining, with Discount only when > 0.
export type ReceiptAmountsInput = {
  thisPayment: number;
  installmentLabel?: string | null;
  totalPrice: number;
  paidToDate: number;
  balanceRemaining: number;
  discount?: number | null;
};

export type ReceiptAmountsRow = {
  key: "this-payment" | "installment" | "total-price" | "paid-to-date" | "balance" | "discount";
  label: string;
  value: number | string;
  emphasize?: boolean;
};

export function receiptAmountsRows(input: ReceiptAmountsInput): ReceiptAmountsRow[] {
  const rows: ReceiptAmountsRow[] = [
    { key: "this-payment", label: "This payment", value: input.thisPayment, emphasize: true },
  ];
  if (input.installmentLabel) {
    rows.push({ key: "installment", label: "Installment", value: input.installmentLabel });
  }
  rows.push({ key: "total-price", label: "Total price", value: input.totalPrice });
  rows.push({ key: "paid-to-date", label: "Paid to date", value: input.paidToDate });
  rows.push({ key: "balance", label: "Balance remaining", value: input.balanceRemaining, emphasize: true });
  if ((input.discount ?? 0) > 0) {
    rows.push({ key: "discount", label: "Discount", value: input.discount as number });
  }
  return rows;
}

// Plain-text settlement label (header, no stamp graphic): PART while anything
// is outstanding, FINAL once the balance reaches zero (or credit).
export type SettlementLabel = "PART PAYMENT" | "FINAL PAYMENT, ACCOUNT SETTLED";

export function settlementLabel(balanceAfter: number): SettlementLabel {
  return balanceAfter > 0 ? "PART PAYMENT" : "FINAL PAYMENT, ACCOUNT SETTLED";
}

export type HistoryPayment = {
  id: string;
  date: Date | string;
  method: string;
  amount: number;
};

export type ReceiptHistoryRow = {
  index: number;
  date: string;
  method: string;
  amount: number;
  receiptRef: string | null;
  runningBalance: number;
  isCurrent: boolean;
};

// Full payment-history table for a receipt: every confirmed payment up to and
// including this one, oldest first, each with its receipt ref and the running
// balance AFTER that payment. totalPayable anchors the balances.
export function buildReceiptHistory(
  confirmed: HistoryPayment[],
  receiptRefByPaymentId: Map<string, string>,
  currentPaymentId: string,
  totalPayable: number,
  formatDate: (d: Date | string) => string
): ReceiptHistoryRow[] {
  const ordered = [...confirmed].sort((a, b) => {
    const ta = new Date(a.date).getTime();
    const tb = new Date(b.date).getTime();
    return ta - tb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  let paid = 0;
  const rows: ReceiptHistoryRow[] = [];
  for (const p of ordered) {
    paid += p.amount;
    rows.push({
      index: rows.length + 1,
      date: formatDate(p.date),
      method: p.method,
      amount: p.amount,
      receiptRef: receiptRefByPaymentId.get(p.id) ?? null,
      runningBalance: totalPayable - paid,
      isCurrent: p.id === currentPaymentId,
    });
    if (p.id === currentPaymentId) break;
  }
  return rows;
}

// Account reference line: transaction ref + booking ref (when linked).
// Separate from the receipt number, which stays RCT-….
export function buildAccountRef(txnRef: string, bookingRef: string | null): string {
  return bookingRef ? `${txnRef} · ${bookingRef}` : txnRef;
}
