import { sendEmail, type EmailResult } from "./sendEmail";
import {
  bookingReceivedTemplate,
  adminNewBookingAlertTemplate,
  bookingApprovedTemplate,
  bookingRescheduledTemplate,
  bookingStatusTemplate,
  saleConfirmationTemplate,
  agentAssignmentTemplate,
  interestedOutcomeTemplate,
  agentRescheduledNoticeTemplate,
  agentFollowUpTemplate,
  transactionConfirmationTemplate,
  type TxnConfirmationScheduleLine,
} from "./templates";

type BookingLike = {
  name: string;
  ref: string;
  preferredDate: Date;
  preferredTime: string;
  location: string;
  agentName?: string | null;
  phone?: string | null;
  email?: string | null;
};

// Optional per-call options, threaded from the outbox row id so the provider
// can dedupe retried sends. Always optional — direct callers keep working.
export type SendOpts = {
  idempotencyKey?: string;
};

export async function sendBookingReceived(to: string, booking: BookingLike, opts?: SendOpts): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Booking received ${booking.ref}`,
    html: bookingReceivedTemplate(booking),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendAdminNewBookingAlert(
  adminEmails: string[],
  booking: BookingLike,
  opts?: SendOpts
): Promise<EmailResult> {
  if (adminEmails.length === 0) return { sent: false, error: "No admin recipients configured" };
  return sendEmail({
    to: adminEmails,
    subject: `New inspection booking ${booking.ref}`,
    html: adminNewBookingAlertTemplate(booking),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendBookingApproved(to: string, booking: BookingLike, opts?: SendOpts): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Inspection confirmed ${booking.ref}`,
    html: bookingApprovedTemplate(booking),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendBookingRescheduled(
  to: string,
  booking: { name: string; ref: string; rescheduledDate: Date; rescheduledTime: string; location: string },
  opts?: SendOpts
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Inspection rescheduled ${booking.ref}`,
    html: bookingRescheduledTemplate(booking),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendBookingStatusEmail(
  to: string,
  booking: { name: string; ref: string },
  status: "on_hold" | "under_review",
  opts?: SendOpts
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Booking update ${booking.ref}`,
    html: bookingStatusTemplate({ ...booking, status }),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendSaleConfirmation(
  to: string,
  booking: { name: string; ref: string; location: string },
  opts?: SendOpts
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Sale confirmed ${booking.ref}`,
    html: saleConfirmationTemplate(booking),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendAgentAssignment(
  to: string,
  params: {
    agentName: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string | null;
    ref: string;
    preferredDate: Date;
    preferredTime: string;
    rescheduledDate?: Date | null;
    rescheduledTime?: string | null;
    location: string;
    agentCategory?: string | null;
    assignmentNote?: string | null;
  },
  opts?: SendOpts
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `New client assigned ${params.ref}: ${params.clientName} (${params.location})`,
    html: agentAssignmentTemplate(params),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendInterestedOutcome(
  to: string,
  params: { name: string; ref: string; propertyName: string },
  opts?: SendOpts
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Next steps for ${params.propertyName} ${params.ref}`,
    html: interestedOutcomeTemplate(params),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export function getInterestedMessageText(propertyName: string): string {
  return `Thank you for visiting ${propertyName} with Belgrove Homes. To formalize your interest, please complete the subscription form here: https://tally.so/r/RG9ryp. You're also welcome to visit our office in person. Please note: allocation is confirmed physically or digitally once your payment has been received. Our Admin team will be in touch shortly.`;
}

export async function sendAgentFollowUp(
  to: string,
  params: { agentName: string; clientName: string; ref: string; location: string; message: string; authorName: string },
  opts?: SendOpts
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Follow-up ${params.ref}: ${params.clientName}`,
    html: agentFollowUpTemplate(params),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendTransactionConfirmation(
  to: string,
  params: {
    name: string;
    txnRef: string;
    bookingRef?: string | null;
    propertyLine: string;
    planName: string;
    planCode: string;
    depositAmount: number | null;
    depositDueDate: string;
    schedule: TxnConfirmationScheduleLine[];
    interestAmount: number;
    interestRate: number;
    totalPayable: number;
  },
  opts?: SendOpts
): Promise<EmailResult> {
  const isOutright = params.planCode === "OUTRIGHT";
  return sendEmail({
    to,
    subject: `Purchase confirmed ${params.txnRef}: ${params.planName} plan`,
    html: transactionConfirmationTemplate({ ...params, isOutright }),
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function sendAgentRescheduledNotice(
  to: string,
  params: { agentName: string; ref: string; clientName: string; rescheduledDate: Date; rescheduledTime: string; location: string },
  opts?: SendOpts
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Inspection rescheduled ${params.ref}`,
    html: agentRescheduledNoticeTemplate(params),
    idempotencyKey: opts?.idempotencyKey,
  });
}
