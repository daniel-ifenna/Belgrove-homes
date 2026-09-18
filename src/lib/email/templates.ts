function layout(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; color: #2b2620;">
    <div style="background: #3a3226; padding: 24px 32px;">
      <span style="color: #f5ece1; font-size: 20px; letter-spacing: 0.05em;">BELGROVE HOMES</span>
    </div>
    <div style="padding: 32px; background: #fdfbf7;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding: 16px 32px; background: #efe8dc; font-size: 12px; color: #6b6055;">
      Belgrove Homes &middot; This is an automated message regarding your inspection booking.
    </div>
  </div>`;
}

function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function bookingReceivedTemplate(params: {
  name: string;
  ref: string;
  preferredDate: Date | string;
  preferredTime: string;
  location: string;
  phone?: string | null;
}): string {
  const { name, ref, preferredDate, preferredTime, location, phone } = params;
  return layout(
    "We've received your inspection request",
    `
    <p>Hi ${name},</p>
    <p>Thank you for booking a property inspection with Belgrove Homes. Here's what you submitted:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">Reference</td><td style="padding:6px 0; font-weight:bold;">${ref}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Requested date</td><td style="padding:6px 0;">${fmtDate(preferredDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Requested time</td><td style="padding:6px 0;">${preferredTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
      ${phone ? `<tr><td style="padding:6px 0; color:#6b6055;">Phone</td><td style="padding:6px 0;">${phone}</td></tr>` : ""}
    </table>
    <p>Keep your reference code <strong>${ref}</strong> handy an agent will follow up shortly to confirm.</p>
    `
  );
}

export function adminNewBookingAlertTemplate(params: {
  name: string;
  ref: string;
  preferredDate: Date | string;
  preferredTime: string;
  location: string;
  agentName?: string | null;
  phone?: string | null;
  email?: string | null;
}): string {
  const { name, ref, preferredDate, preferredTime, location, agentName, phone, email } = params;
  return layout(
    "New inspection booking submitted",
    `
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">Reference</td><td style="padding:6px 0; font-weight:bold;">${ref}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Visitor</td><td style="padding:6px 0;">${name}</td></tr>
      ${email ? `<tr><td style="padding:6px 0; color:#6b6055;">Email</td><td style="padding:6px 0;">${email}</td></tr>` : ""}
      ${phone ? `<tr><td style="padding:6px 0; color:#6b6055;">Phone</td><td style="padding:6px 0;">${phone}</td></tr>` : ""}
      <tr><td style="padding:6px 0; color:#6b6055;">Requested date</td><td style="padding:6px 0;">${fmtDate(preferredDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Requested time</td><td style="padding:6px 0;">${preferredTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Agent</td><td style="padding:6px 0;">${agentName || " not provided "}</td></tr>
    </table>
    <p>Review this booking in the admin dashboard.</p>
    `
  );
}

export function bookingApprovedTemplate(params: {
  name: string;
  ref: string;
  preferredDate: Date | string;
  preferredTime: string;
  location: string;
}): string {
  const { name, ref, preferredDate, preferredTime, location } = params;
  return layout(
    "Your inspection is confirmed",
    `
    <p>Hi ${name},</p>
    <p>Your inspection booking <strong>${ref}</strong> has been confirmed as requested:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">Date</td><td style="padding:6px 0; font-weight:bold;">${fmtDate(preferredDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Time</td><td style="padding:6px 0; font-weight:bold;">${preferredTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
    </table>
    <p>We look forward to seeing you then.</p>
    `
  );
}

export function bookingRescheduledTemplate(params: {
  name: string;
  ref: string;
  rescheduledDate: Date | string;
  rescheduledTime: string;
  location: string;
}): string {
  const { name, ref, rescheduledDate, rescheduledTime, location } = params;
  return layout(
    "Your inspection has been rescheduled",
    `
    <p>Hi ${name},</p>
    <p>Your inspection booking <strong>${ref}</strong> has a new date and time:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">New date</td><td style="padding:6px 0; font-weight:bold;">${fmtDate(rescheduledDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">New time</td><td style="padding:6px 0; font-weight:bold;">${rescheduledTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
    </table>
    <p>If this doesn't work for you, reply to this email and we'll help find another time.</p>
    `
  );
}

const statusCopy: Record<string, { title: string; body: string }> = {
  on_hold: {
    title: "Your inspection booking is on hold",
    body: "Your booking has been placed on hold while we confirm a few details. We'll follow up shortly.",
  },
  under_review: {
    title: "Your inspection booking is under review",
    body: "Your booking is being reviewed by our team. We'll be in touch soon to confirm next steps.",
  },
};

export function bookingStatusTemplate(params: {
  name: string;
  ref: string;
  status: "on_hold" | "under_review";
}): string {
  const { name, ref, status } = params;
  const copy = statusCopy[status];
  return layout(
    copy.title,
    `
    <p>Hi ${name},</p>
    <p>${copy.body}</p>
    <p>Reference: <strong>${ref}</strong></p>
    `
  );
}

export function saleConfirmationTemplate(params: {
  name: string;
  ref: string;
  location: string;
}): string {
  const { name, ref, location } = params;
  return layout(
    "Congratulations on your new property!",
    `
    <p>Hi ${name},</p>
    <p>We're delighted to confirm the sale associated with your inspection at <strong>${location}</strong> (ref <strong>${ref}</strong>) is complete.</p>
    <p>Thank you for choosing Belgrove Homes our team will be in touch with next steps.</p>
    `
  );
}

export function agentRescheduledNoticeTemplate(params: {
  agentName: string;
  ref: string;
  clientName: string;
  rescheduledDate: Date | string;
  rescheduledTime: string;
  location: string;
}): string {
  const { agentName, ref, clientName, rescheduledDate, rescheduledTime, location } = params;
  return layout(
    `Inspection rescheduled ${ref}`,
    `
    <p>Hi ${agentName},</p>
    <p>The inspection for <strong>${clientName}</strong> (<strong>${ref}</strong>) has been rescheduled:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">New date</td><td style="padding:6px 0; font-weight:bold;">${fmtDate(rescheduledDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">New time</td><td style="padding:6px 0; font-weight:bold;">${rescheduledTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Client</td><td style="padding:6px 0;">${clientName}</td></tr>
    </table>
    <p>Please confirm availability. This is also being sent to the visitor.</p>
    `
  );
}

export function agentFollowUpTemplate(params: {
  agentName: string;
  clientName: string;
  ref: string;
  location: string;
  message: string;
  authorName: string;
}): string {
  const { agentName, clientName, ref, location, message, authorName } = params;
  return layout(
    `Follow-up ${ref}: ${clientName}`,
    `
    <p>Hi ${agentName},</p>
    <p><strong>${authorName}</strong> from Belgrove Homes left a follow-up on booking <strong>${ref}</strong> (${location}, client: ${clientName}):</p>
    <div style="background:#fdfbf7; border:1px solid #efe8dc; border-left:3px solid #1E3A2E; padding:14px 16px; margin:16px 0; white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    <p>Ref: <strong>${ref}</strong></p>
    `
  );
}

export const SUBSCRIPTION_FORM_URL = "https://tally.so/r/RG9ryp";

export function interestedOutcomeTemplate(params: {
  name: string;
  ref: string;
  propertyName: string;
}): string {
  const { name, propertyName } = params;
  return layout(
    `Thank you for visiting ${propertyName} with Belgrove Homes`,
    `
    <p>Hi ${name},</p>
    <p>Thank you for visiting <strong>${propertyName}</strong> with Belgrove Homes. To formalize your interest, please complete the subscription form here: <a href="${SUBSCRIPTION_FORM_URL}" style="color:#1E3A2E; font-weight:bold;">${SUBSCRIPTION_FORM_URL}</a>.</p>
    <p>You're also welcome to visit our office in person.</p>
    <p>Please note: allocation is confirmed physically or digitally once your payment has been received. Our Admin team will be in touch shortly.</p>
    `
  );
}

export function agentAssignmentTemplate(params: {
  agentName: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  ref: string;
  preferredDate: Date | string;
  preferredTime: string;
  rescheduledDate?: Date | string | null;
  rescheduledTime?: string | null;
  location: string;
  agentCategory?: string | null;
  assignmentNote?: string | null;
}): string {
  const {
    agentName,
    clientName,
    clientEmail,
    clientPhone,
    ref,
    preferredDate,
    preferredTime,
    rescheduledDate,
    rescheduledTime,
    location,
    agentCategory,
    assignmentNote,
  } = params;
  const dateToShow = rescheduledDate ?? preferredDate;
  const timeToShow = rescheduledTime ?? preferredTime;
  const isRescheduled = !!rescheduledDate;
  return layout(
    `New client assigned ${ref}`,
    `
    <p>Hi ${agentName},</p>
    <p>You have been assigned a new inspection booking to follow up. Please contact the client promptly:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">Reference</td><td style="padding:6px 0; font-weight:bold;">${ref}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Client</td><td style="padding:6px 0;">${clientName}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Email</td><td style="padding:6px 0;"><a href="mailto:${clientEmail}">${clientEmail}</a></td></tr>
      ${clientPhone ? `<tr><td style="padding:6px 0; color:#6b6055;">Phone</td><td style="padding:6px 0;"><a href="tel:${clientPhone}">${clientPhone}</a></td></tr>` : ""}
      <tr><td style="padding:6px 0; color:#6b6055;">${isRescheduled ? "Rescheduled date" : "Requested date"}</td><td style="padding:6px 0; font-weight:bold;">${fmtDate(dateToShow)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Time</td><td style="padding:6px 0; font-weight:bold;">${timeToShow}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
      ${agentCategory ? `<tr><td style="padding:6px 0; color:#6b6055;">Your category</td><td style="padding:6px 0; text-transform: capitalize;">${agentCategory.replace("_", " ")}</td></tr>` : ""}
    </table>
    ${assignmentNote ? `<div style="background:#f7f5ee; border:1px solid #e3e6e1; border-left:3px solid #0D3328; padding:12px 14px; margin:16px 0;"><div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#65736E; margin-bottom:6px;">Note from admin</div><div style="font-size:13px; color:#10231E; white-space:pre-wrap;">${assignmentNote.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div>` : ""}
    <p style="background:#fef3c7; border:1px solid #fcd34d; padding:12px; border-radius:4px; font-size:13px;">Action required: Contact <strong>${clientName}</strong> within 24 hours to confirm the inspection and provide directions. Reply to this email if you need admin support.</p>
    <p>Client reference: <strong>${ref}</strong></p>
    `
  );
}
