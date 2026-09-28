// Test-data visibility rules (single place, unit-tested).
// Rows flagged isTest are dev fixtures: hidden from metrics, queues and
// default list results. Payments and receipts inherit through transaction.

export function showTestFromParams(params: { showTest?: string }): boolean {
  return params.showTest === "1";
}

// Direct-model filter (Booking, Transaction).
export function excludeTestRows(showTest: boolean): { isTest?: boolean } {
  return showTest ? {} : { isTest: false };
}

// Relation filter for models that belong to a transaction
// (Payment, Receipt, Installment).
export function excludeTestTransactions(showTest: boolean): { transaction?: { isTest: boolean } } {
  return showTest ? {} : { transaction: { isTest: false } };
}
