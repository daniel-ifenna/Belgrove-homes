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
