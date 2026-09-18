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

export async function sendBookingReceived(to: string, booking: BookingLike): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Booking received ${booking.ref}`,
    html: bookingReceivedTemplate(booking),
  });
}

export async function sendAdminNewBookingAlert(
  adminEmails: string[],
  booking: BookingLike
): Promise<EmailResult> {
  if (adminEmails.length === 0) return { sent: false, error: "No admin recipients configured" };
  return sendEmail({
    to: adminEmails,
    subject: `New inspection booking ${booking.ref}`,
    html: adminNewBookingAlertTemplate(booking),
  });
}

export async function sendBookingApproved(to: string, booking: BookingLike): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Inspection confirmed ${booking.ref}`,
    html: bookingApprovedTemplate(booking),
  });
}

export async function sendBookingRescheduled(
  to: string,
  booking: { name: string; ref: string; rescheduledDate: Date; rescheduledTime: string; location: string }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Inspection rescheduled ${booking.ref}`,
    html: bookingRescheduledTemplate(booking),
  });
}

export async function sendBookingStatusEmail(
  to: string,
  booking: { name: string; ref: string },
  status: "on_hold" | "under_review"
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Booking update ${booking.ref}`,
    html: bookingStatusTemplate({ ...booking, status }),
  });
}

export async function sendSaleConfirmation(
  to: string,
  booking: { name: string; ref: string; location: string }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Sale confirmed ${booking.ref}`,
    html: saleConfirmationTemplate(booking),
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
  }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `New client assigned ${params.ref}: ${params.clientName} (${params.location})`,
    html: agentAssignmentTemplate(params),
  });
}

export async function sendInterestedOutcome(
  to: string,
  params: { name: string; ref: string; propertyName: string }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Next steps for ${params.propertyName} ${params.ref}`,
    html: interestedOutcomeTemplate(params),
  });
}

export function getInterestedMessageText(propertyName: string): string {
  return `Thank you for visiting ${propertyName} with Belgrove Homes. To formalize your interest, please complete the subscription form here: https://tally.so/r/RG9ryp. You're also welcome to visit our office in person. Please note: allocation is confirmed physically or digitally once your payment has been received. Our Admin team will be in touch shortly.`;
}

export async function sendAgentFollowUp(
  to: string,
  params: { agentName: string; clientName: string; ref: string; location: string; message: string; authorName: string }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Follow-up ${params.ref}: ${params.clientName}`,
    html: agentFollowUpTemplate(params),
  });
}

export async function sendAgentRescheduledNotice(
  to: string,
  params: { agentName: string; ref: string; clientName: string; rescheduledDate: Date; rescheduledTime: string; location: string }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Inspection rescheduled ${params.ref}`,
    html: agentRescheduledNoticeTemplate(params),
  });
}
