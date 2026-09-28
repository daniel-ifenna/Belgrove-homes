type Decimal = { toString(): string };

export type PaymentPlanConfig = {
  id: string;
  code: string;
  name: string;
  durationMonths: number;
  interestRate: Decimal | number | string;
  interestMethod: string; // NONE, ONE_TIME_PERCENTAGE
  initialPaymentPercentage: number; // 100, 50
  remainingInstallments: number; // 0, 3, 6
};

export type CalculatedTransaction = {
  baseAmount: number;
  interestAmount: number;
  totalPayable: number;
};

export function calculateTransactionAmounts(
  unitPrice: number,
  plotQuantity: number,
  interestRate: number | string | Decimal,
  interestMethod: string
): CalculatedTransaction {
  const baseAmount = Math.round(unitPrice * plotQuantity);
  const rate = typeof interestRate === "object" ? Number((interestRate as Decimal).toString()) : Number(interestRate);
  let interestAmount = 0;
  if (interestMethod === "ONE_TIME_PERCENTAGE" && rate > 0) {
    interestAmount = Math.round((baseAmount * rate) / 100);
  }
  const totalPayable = baseAmount + interestAmount;
  return { baseAmount, interestAmount, totalPayable };
}

export type InstallmentInput = {
  scheduledAmount: number;
  dueDate: Date;
  type: "INITIAL" | "MONTHLY";
  installmentNumber: number;
};

export function generateInstallmentSchedule(
  totalPayable: number,
  initialPaymentPercentage: number,
  remainingInstallments: number,
  startDate: Date
): InstallmentInput[] {
  const schedule: InstallmentInput[] = [];
  if (remainingInstallments === 0) {
    // Outright: single payment 100%
    schedule.push({
      installmentNumber: 0,
      type: "INITIAL",
      dueDate: new Date(startDate),
      scheduledAmount: totalPayable,
    });
    return schedule;
  }

  const initialAmount = Math.round((totalPayable * initialPaymentPercentage) / 100);
  const remainingTotal = totalPayable - initialAmount;

  // Initial payment
  schedule.push({
    installmentNumber: 0,
    type: "INITIAL",
    dueDate: new Date(startDate),
    scheduledAmount: initialAmount,
  });

  if (remainingInstallments > 0) {
    // Split remainingTotal across remainingInstallments with rounding, last absorbs remainder
    const baseMonthly = Math.floor(remainingTotal / remainingInstallments);
    let remainder = remainingTotal - baseMonthly * remainingInstallments;
    for (let i = 1; i <= remainingInstallments; i++) {
      let amount = baseMonthly;
      if (i === remainingInstallments) amount += remainder; // last absorbs
      // For the 0-3 case with 5,533,333.33 example, baseMonthly = 5,533,333, remainder = 1 (since 5,533,333*3=16,599,999, remainder 1), so final will be 5,533,334
      // Actually for total 16,600,000 remaining, baseMonthly = 5,533,333, remainder = 1, so final = 5,533,334
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      schedule.push({
        installmentNumber: i,
        type: "MONTHLY",
        dueDate,
        scheduledAmount: amount,
      });
    }
  }

  // Verify sum
  const sum = schedule.reduce((a, b) => a + b.scheduledAmount, 0);
  if (sum !== totalPayable) {
    // Adjust last installment
    const diff = totalPayable - sum;
    schedule[schedule.length - 1].scheduledAmount += diff;
  }

  return schedule;
}
