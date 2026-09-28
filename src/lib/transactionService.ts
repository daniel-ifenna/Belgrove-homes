import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { generateUniqueTransactionRef } from "@/lib/ref";
import { calculateTransactionAmounts, generateInstallmentSchedule } from "@/lib/paymentCalculation";
import { findOrCreateCustomer } from "@/lib/customer";
import { normalizeName } from "@/lib/phone";

export async function createTransactionFromBooking(
  bookingId: string,
  paymentPlanCode: string,
  unitPrice: number,
  plotQuantity: number,
  agentId?: string | null,
  createdById?: string | null,
  actorName?: string | null
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
  const customer = await findOrCreateCustomer({ name: booking.name, email: booking.email, phone: booking.phone });

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        ref,
        bookingId: booking.id,
        customerId: customer.id,
        customerName: normalizeName(booking.name) ?? booking.name,
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

    await tx.auditEvent.create({
      data: {
        actorId: createdById ?? null,
        actorName: actorName ?? "System",
        action: "transaction.create",
        entityType: "transaction",
        entityId: transaction.id,
        before: Prisma.JsonNull,
        after: { ref: transaction.ref, bookingId: booking.id, totalPayable },
      },
    });

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
  actorName?: string | null;
  manualReason: string;
}) {
  if (!params.manualReason?.trim()) {
    throw new Error("A reason is required for transactions without a booking");
  }
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
  const customer = await findOrCreateCustomer({
    name: params.customerName,
    email: params.customerEmail,
    phone: params.customerPhone,
  });

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        ref,
        bookingId: null,
        customerId: customer.id,
        manualReason: params.manualReason.trim(),
        customerName: normalizeName(params.customerName) ?? params.customerName,
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

    await tx.auditEvent.create({
      data: {
        actorId: params.createdById ?? null,
        actorName: params.actorName ?? "System",
        action: "transaction.create",
        entityType: "transaction",
        entityId: transaction.id,
        before: Prisma.JsonNull,
        after: { ref: transaction.ref, manualReason: params.manualReason.trim(), totalPayable },
      },
    });

    return transaction;
  });
}
