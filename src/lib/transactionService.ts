import { prisma } from "@/lib/prisma";
import { generateRef } from "@/lib/ref";
import { calculateTransactionAmounts, generateInstallmentSchedule } from "@/lib/paymentCalculation";
import { randomInt } from "node:crypto";

function generateTransactionRef(): string {
  const year = new Date().getFullYear();
  const seq = randomInt(10000, 100000);
  return `TXN-${year}-${seq}`;
}

async function generateUniqueTransactionRef(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const ref = generateTransactionRef();
    const existing = await prisma.transaction.findUnique({ where: { ref }, select: { id: true } });
    if (!existing) return ref;
  }
  throw new Error("Failed to generate unique transaction ref");
}

export async function createTransactionFromBooking(
  bookingId: string,
  paymentPlanCode: string,
  unitPrice: number,
  plotQuantity: number,
  agentId?: string | null,
  createdById?: string | null
) {
  const booking = await prisma.inspectionBooking.findUnique({ where: { id: bookingId }, include: { agent: true } });
  if (!booking) throw new Error("Booking not found");
  const plan = await prisma.paymentPlan.findUnique({ where: { code: paymentPlanCode } });
  if (!plan || !plan.isActive) throw new Error("Payment plan not found or inactive");

  const { baseAmount, interestAmount, totalPayable } = calculateTransactionAmounts(
    unitPrice,
    plotQuantity,
    plan.interestRate,
    plan.interestMethod
  );

  const ref = await generateUniqueTransactionRef();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        ref,
        bookingId: booking.id,
        customerName: booking.name,
        customerEmail: booking.email,
        customerPhone: booking.phone,
        estate: booking.estate ?? booking.location.split("·")[0].trim(),
        plotCode: booking.plotCode,
        unitType: booking.unitType,
        sqm: booking.sqm ?? booking.sqmNeeded,
        plotQuantity,
        unitPrice,
        baseAmount,
        paymentPlanId: plan.id,
        interestRate: plan.interestRate,
        interestMethod: plan.interestMethod,
        interestAmount,
        totalPayable,
        totalPaid: 0,
        outstandingBalance: totalPayable,
        status: "ACTIVE",
        createdById,
      },
    });

    const schedule = generateInstallmentSchedule(totalPayable, plan.initialPaymentPercentage, plan.remainingInstallments, now);
    for (const inst of schedule) {
      await tx.installment.create({
        data: {
          transactionId: transaction.id,
          installmentNumber: inst.installmentNumber,
          type: inst.type,
          dueDate: inst.dueDate,
          scheduledAmount: inst.scheduledAmount,
          paidAmount: 0,
          status: inst.installmentNumber === 0 ? "DUE" : "PENDING",
        },
      });
    }

    return transaction;
  });
}

export async function createManualTransaction(params: {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  estate: string;
  plotCode?: string | null;
  unitType?: string | null;
  sqm?: number | null;
  plotQuantity: number;
  unitPrice: number;
  paymentPlanCode: string;
  agentId?: string | null;
  createdById?: string | null;
}) {
  const plan = await prisma.paymentPlan.findUnique({ where: { code: params.paymentPlanCode } });
  if (!plan || !plan.isActive) throw new Error("Payment plan not found");

  const { baseAmount, interestAmount, totalPayable } = calculateTransactionAmounts(
    params.unitPrice,
    params.plotQuantity,
    plan.interestRate,
    plan.interestMethod
  );

  const ref = await generateUniqueTransactionRef();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        ref,
        bookingId: null,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
        estate: params.estate,
        plotCode: params.plotCode,
        unitType: params.unitType,
        sqm: params.sqm,
        plotQuantity: params.plotQuantity,
        unitPrice: params.unitPrice,
        baseAmount,
        paymentPlanId: plan.id,
        interestRate: plan.interestRate,
        interestMethod: plan.interestMethod,
        interestAmount,
        totalPayable,
        totalPaid: 0,
        outstandingBalance: totalPayable,
        status: "ACTIVE",
        createdById: params.createdById,
      },
    });

    const schedule = generateInstallmentSchedule(totalPayable, plan.initialPaymentPercentage, plan.remainingInstallments, now);
    for (const inst of schedule) {
      await tx.installment.create({
        data: {
          transactionId: transaction.id,
          installmentNumber: inst.installmentNumber,
          type: inst.type,
          dueDate: inst.dueDate,
          scheduledAmount: inst.scheduledAmount,
          paidAmount: 0,
          status: inst.installmentNumber === 0 ? "DUE" : "PENDING",
        },
      });
    }

    return transaction;
  });
}
