import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { statusColors, statusLabels, temperatureColors, formatDate, formatDateTime } from "@/lib/booking-ui";
import BookingActions from "./BookingActions";
import UnifiedTimeline from "./UnifiedTimeline";
import QuickActionsBar from "@/components/admin/QuickActionsBar";
import PanelHeader from "@/components/admin/PanelHeader";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [booking, staffUsers, agents, activities, messages, internalNotes, receipt, linkedTransaction] = await Promise.all([
    prisma.inspectionBooking.findUnique({
      where: { id },
      include: { assignedToUser: true, reviewedByUser: true, agent: true, agentConfirmedBy: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "staff", "reviewer", "approver"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.agent.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, phone: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.bookingActivity.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bookingMessage.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.internalNote.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.receipt.findFirst({
      where: { bookingId: id },
      orderBy: { issuedAt: "desc" },
      include: { sendAttempts: { orderBy: { attemptedAt: "desc" }, take: 3 } },
    }),
    prisma.transaction.findUnique({
      where: { bookingId: id },
      select: { id: true, ref: true, status: true },
    }),
  ]);

  if (!booking) notFound();

  const isLocked = booking.status === "closed" || !!booking.lockedAt;

  const dupCandidates = await prisma.inspectionBooking.findMany({
    where: {
      id: { not: id },
      status: { not: "closed" as any },
      OR: [
        ...(booking.email ? [{ email: { equals: booking.email, mode: "insensitive" as const } }] : []),
        ...(booking.phone ? [{ phone: booking.phone }] : []),
      ],
    },
    select: { id: true, ref: true, name: true, email: true, phone: true, preferredDate: true, rescheduledDate: true, status: true },
  });
  const duplicates = dupCandidates.filter((o) => {
    const aDate = (booking.rescheduledDate ?? booking.preferredDate).getTime();
    const bDate = (o.rescheduledDate ?? o.preferredDate).getTime();
    return Math.abs(aDate - bDate) / (1000 * 60 * 60 * 24) <= 3;
  });

  const visitorRaw = booking.visitorAgentRaw ?? booking.agentName ?? null;

  const rescheduleHistory = activities.filter((a: any) => a.action === "reschedule").sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const agentHistory = activities.filter((a: any) => a.action === "assign_agent").sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mb-4">
          <Link href="/admin/bookings" className="hover:text-[var(--ops-text)] flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Bookings
          </Link>
          <span className="text-[var(--ops-border)]">/</span>
          <span className="text-[var(--ops-text)] font-medium tracking-normal normal-case mono text-[11px]">{booking.ref}</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 pl-2 border-l border-[var(--ops-border)] mono text-[10px] text-[var(--ops-muted)]">
            Updated {formatDateTime(booking.updatedAt)}
          </span>
        </div>

        {isLocked && (
          <div className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-6 w-6 rounded-full bg-amber-500 text-white grid place-items-center text-xs">🔒</span>
              <span className="font-medium text-amber-900">Closed & locked</span>
              <span className="text-amber-700 hidden sm:inline">— read-only. Use Reopen to make changes.</span>
              {booking.lockedAt && <span className="mono text-[11px] text-amber-700 ml-2">{formatDateTime(booking.lockedAt)}</span>}
            </div>
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <span className="h-5 w-5 rounded-full bg-amber-500 text-white grid place-items-center text-[10px]">⚠</span>
              Possible duplicate — same contact within 3 days
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {duplicates.map((d) => (
                <Link key={d.id} href={`/admin/bookings/${d.id}`} className="text-xs bg-white border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-50">
                  {d.ref} · {d.name} · {formatDate(d.preferredDate)} · {d.status}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Header — BOOKING */}
        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 lg:p-7 shadow-[var(--ops-shadow-sm)]">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="mono text-[11px] tracking-[0.14em] uppercase text-[var(--ops-muted)]">Booking</div>
              <div className="flex flex-wrap items-baseline gap-3 mt-1">
                <h1 className="font-serif text-[26px] lg:text-[30px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">{booking.ref}</h1>
                <span className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] border border-[var(--ops-border)] rounded-full px-2.5 py-1 bg-[var(--ops-bg)]">{booking.id.slice(0, 8)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-medium text-[var(--ops-text)]">{booking.name}</span>
                <span className="h-1 w-1 rounded-full bg-[var(--ops-border)] hidden sm:block" />
                <a href={`mailto:${booking.email}`} className="text-[13px] text-[var(--ops-muted)] hover:text-[var(--ops-text)] underline decoration-[var(--ops-border)] underline-offset-2">{booking.email}</a>
                {booking.phone && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-[var(--ops-border)] hidden sm:block" />
                    <a href={`tel:${booking.phone}`} className="text-[13px] text-[var(--ops-muted)] hover:text-[var(--ops-text)]">{booking.phone}</a>
                  </>
                )}
              </div>
              <div className="mono text-[11px] text-[var(--ops-muted)] mt-2">
                Submitted {formatDateTime(booking.createdAt)} · Updated {formatDateTime(booking.updatedAt)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${statusColors[booking.status]}`}>{statusLabels[booking.status]}</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${temperatureColors[booking.leadTemperature]}`}>Lead: {booking.leadTemperature.toUpperCase()}</span>
              {booking.outcome && (
                <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-medium border ${booking.outcome === "sold" ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" : booking.outcome === "interested" ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" : "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]"}`}>{booking.outcome}</span>
              )}
            </div>
          </div>

          <QuickActionsBar
            booking={{
              id: booking.id,
              name: booking.name,
              email: booking.email,
              phone: booking.phone,
              location: booking.location,
              preferredDate: booking.preferredDate.toISOString(),
              preferredTime: booking.preferredTime,
              updatedAt: booking.updatedAt.toISOString(),
              status: booking.status,
              lockedAt: booking.lockedAt ? booking.lockedAt.toISOString() : null,
            }}
          />
          {receipt ? (
            <div className="mt-4 rounded-xl border bg-white px-4 py-4 shadow-sm" style={{ borderColor: receipt.status === "sent" ? "#A7F3D0" : receipt.status === "failed" ? "#FECACA" : "#E3E6E1", background: receipt.status === "sent" ? "#ECFDF5" : receipt.status === "failed" ? "#FEF2F2" : "#FFFFFF" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-6 w-6 rounded-full grid place-items-center text-[10px] ${receipt.status === "sent" ? "bg-[#065F46] text-white" : receipt.status === "failed" ? "bg-[#9F1239] text-white" : "bg-amber-500 text-white"}`}>{receipt.status === "sent" ? "✓" : receipt.status === "failed" ? "!" : "•"}</span>
                  <div>
                    <div className="text-sm font-medium" style={{ color: receipt.status === "sent" ? "#065F46" : receipt.status === "failed" ? "#9F1239" : "#10231E" }}>
                      Receipt {receipt.ref} — {receipt.status.toUpperCase()}
                    </div>
                    <div className="mono text-[11px] text-[var(--ops-muted)]">
                      Issued {formatDateTime(receipt.issuedAt)} {receipt.sentAt ? `· Sent ${formatDateTime(receipt.sentAt)} to ${receipt.recipientEmail}` : `· Recipient ${receipt.recipientEmail}`} {receipt.sendAttempts.length > 1 ? `· ${receipt.sendAttempts.length} attempts` : ""}
                      {receipt.error ? ` · Error: ${receipt.error.slice(0, 80)}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/receipts/${receipt.id}`} className="mono text-[11px] bg-white border border-[var(--ops-border)] text-[var(--ops-text)] px-3 py-1.5 rounded-full hover:bg-[var(--ops-bg)]">Open receipt ↗</Link>
                  <a href={receipt.receiptUrl} target="_blank" className="mono text-[11px] bg-white border border-[#A7F3D0] text-[#065F46] px-3 py-1.5 rounded-full hover:bg-[#D1FAE5]">View URL ↗</a>
                  <a href={`/api/admin/receipts/${receipt.ref}/pdf`} target="_blank" className="mono text-[11px] bg-[#065F46] text-white px-3 py-1.5 rounded-full hover:bg-[#0D3328]">Download PDF</a>
                </div>
              </div>
              {receipt.status === "failed" && (
                <div className="mt-3 mono text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Last send failed: {receipt.error ?? "unknown"} — use the Receipts page to retry. No new receipt number will be created.
                </div>
              )}
            </div>
          ) : (booking as any).receiptSentAt && (booking as any).receiptUrl ? (
            <div className="mt-4 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-[#065F46] text-white grid place-items-center text-[10px]">✓</span>
                <span className="text-sm font-medium text-[#065F46]">Sold — Receipt sent (legacy)</span>
                <span className="mono text-[11px] text-[#065F46]/80">{new Date((booking as any).receiptSentAt as any).toLocaleString("en-GB")}</span>
              </div>
              <div className="flex items-center gap-2">
                {(booking as any).receiptUrl ? (
                  <a href={(booking as any).receiptUrl} target="_blank" className="mono text-[11px] bg-white border border-[#A7F3D0] text-[#065F46] px-3 py-1.5 rounded-full hover:bg-[#D1FAE5]">View receipt ↗</a>
                ) : (
                  <span className="mono text-[11px] text-[#065F46]/80">No receipt link on file</span>
                )}
              </div>
            </div>
          ) : null}
          {linkedTransaction ? (
            <div className="mt-4 rounded-xl border border-[var(--ops-border)] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-[var(--ops-primary)] text-white grid place-items-center text-[10px]">◈</span>
                <span className="text-sm font-medium text-[var(--ops-text)]">Transaction {linkedTransaction.ref}</span>
                <span className="mono text-[11px] text-[var(--ops-muted)]">{linkedTransaction.status.replace("_", " ")}</span>
              </div>
              <Link href={`/admin/transactions/${linkedTransaction.id}`} className="mono text-[11px] bg-[var(--ops-primary)] text-white px-3 py-1.5 rounded-full hover:bg-[var(--ops-deep)]">
                Open transaction ↗
              </Link>
            </div>
          ) : (booking.outcome === "interested" || booking.outcome === "sold") ? (
            <div className="mt-4 rounded-xl border border-[#C89B3C] bg-[#FFFBEB] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-[#C89B3C] text-white grid place-items-center text-[10px]">★</span>
                <div>
                  <span className="text-sm font-medium text-[#92400E]">Intake form completed?</span>
                  <span className="block mono text-[11px] text-[#92400E]/80">Confirm to auto-create the transaction — pre-filled from this booking, plan selection only.</span>
                </div>
              </div>
              <Link href={`/admin/transactions/new?bookingId=${booking.id}`} className="mono text-[11px] bg-[#0D3328] text-white px-4 py-2 rounded-full hover:bg-[#08261E] font-medium">
                Confirm Form Completed →
              </Link>
            </div>
          ) : null}
        </div>

        {/* Two-column body — the split holds for the full page height:
            left is the working area, right rail is at-a-glance status. */}
        <div className="mt-6 grid lg:grid-cols-[2.1fr_0.9fr] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            {/* Booking Summary — two-column */}
            <div id="booking-summary" className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <PanelHeader
                title="Booking Summary"
                description="Client, property and schedule as submitted."
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>
                }
              />
              <div className="mt-5 grid sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Customer</div>
                  <div className="mt-1 font-medium text-[var(--ops-text)]">{booking.name}</div>
                  <div className="text-[12px] text-[var(--ops-muted)] mt-0.5">{booking.email}</div>
                  <div className="text-[12px] text-[var(--ops-muted)]">{booking.phone ?? "No phone"}</div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Booking Reference</div>
                  <div className="mt-1 font-mono text-[13px] font-medium text-[var(--ops-primary)]">{booking.ref}</div>
                  <div className="mono text-[11px] text-[var(--ops-muted)] mt-0.5">Created {formatDate(booking.createdAt)}</div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Property</div>
                  <div className="mt-1 font-medium text-[var(--ops-text)]">{(booking as any).estate ?? booking.location}</div>
                  <div className="text-[12px] text-[var(--ops-muted)] mt-0.5">
                    {(booking as any).plotCode ? `${(booking as any).plotCode}${(booking as any).unitType ? ` · ${(booking as any).unitType}` : ""} · ${(booking as any).selectionType === "unit" ? "Unit selected" : ""}` : booking.agentName ? `Agent on file: ${booking.agentName}` : "No agent name on file"}
                    {(booking as any).selectionType === "sqm_needed" && (booking as any).sqmNeeded ? <span className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">Sizing — {(booking as any).sqmNeeded}sqm requested</span> : (booking as any).sqm ? <span className="ml-1 mono text-[11px] text-[#6B6656]">· {(booking as any).sqm}sqm</span> : null}
                  </div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Location / Company</div>
                  <div className="mt-1 text-[13px] text-[var(--ops-text)]">{booking.location}</div>
                  <div className="text-[12px] text-[var(--ops-muted)] mt-0.5">—</div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Inspection Date & Time</div>
                  <div className="mt-1 font-medium text-[var(--ops-text)]">{formatDate(booking.preferredDate)} at {booking.preferredTime}</div>
                  {booking.rescheduledDate && (
                      <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#1E3A5F] bg-transparent border border-[#C7D2E0] rounded-full px-2.5 py-1">
                      Rescheduled → {formatDate(booking.rescheduledDate)} at {booking.rescheduledTime}
                    </div>
                  )}
                </div>
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Assigned Agent</div>
                  <div className="mt-1">
                    {booking.agent ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--ops-text)]">
                        <span className="h-6 w-6 rounded-full bg-[var(--ops-primary)] text-white grid place-items-center text-[10px]">{booking.agent.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}</span>
                        {booking.agent.name}
                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] border ${booking.agent.category === "staff" ? "bg-[#E0F2F1] text-[#0D3328] border-[#B2DFDB]" : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"}`}>{booking.agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"}</span>
                      </span>
                    ) : (
                      <span className="text-[13px] text-[var(--ops-muted)]">No agent assigned</span>
                    )}
                  </div>
                  <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">{booking.agentConfirmedAt ? `Confirmed ${formatDate(booking.agentConfirmedAt)}` : "Not confirmed"}</div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Booking Status</div>
                  <div className="mt-1"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[booking.status]}`}>{statusLabels[booking.status]}</span></div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Lead Temperature</div>
                  <div className="mt-1"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${temperatureColors[booking.leadTemperature]}`}>{booking.leadTemperature.toUpperCase()}</span></div>
                </div>
                <div className="sm:col-span-2">
                  <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)]">Lead Outcome</div>
                  <div className="mt-1">{booking.outcome ? <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium border bg-white">{booking.outcome}</span> : <span className="text-[13px] text-[var(--ops-muted)]">No lead outcome recorded.</span>}</div>
                </div>
              </div>
            </div>

            {/* Rescheduling History — preserve original */}
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <PanelHeader
                title="Rescheduling History"
                description="Original appointment and every reschedule, oldest first."
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h8"/></svg>
                }
              />
              {booking.rescheduledDate || rescheduleHistory.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-[10px] bg-[var(--ops-bg)] border border-[var(--ops-border)] p-3">
                      <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Original appointment</div>
                      <div className="text-[13px] font-medium text-[var(--ops-text)] mt-1">{formatDate(booking.preferredDate)}</div>
                      <div className="text-[12px] text-[var(--ops-muted)]">{booking.preferredTime}</div>
                    </div>
                    <div className="rounded-[10px] bg-[#F5F0FF] border border-[#DDD6FE] p-3">
                      <div className="mono text-[10px] tracking-wide uppercase text-[#5B21B6]">Rescheduled to</div>
                      <div className="text-[13px] font-medium text-[var(--ops-text)] mt-1">{booking.rescheduledDate ? formatDate(booking.rescheduledDate) : "—"}</div>
                      <div className="text-[12px] text-[var(--ops-muted)]">{booking.rescheduledTime ?? "—"}</div>
                    </div>
                  </div>
                  {rescheduleHistory.length > 0 ? (
                    <div className="space-y-2">
                      {rescheduleHistory.map((a: any) => (
                        <div key={a.id} className="flex gap-3 p-3 rounded-[10px] bg-white border border-[var(--ops-border)]">
                          <span className="h-6 w-6 rounded-full bg-[#F5F0FF] border border-[#DDD6FE] text-[#5B21B6] grid place-items-center text-[10px] shrink-0">↻</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium text-[var(--ops-text)]">Rescheduled by {a.actorName}</div>
                            <div className="mono text-[11px] text-[var(--ops-muted)]">{formatDateTime(a.createdAt)}</div>
                            {a.note && <div className="text-[13px] text-[var(--ops-text)] mt-1 bg-[var(--ops-bg)] rounded-lg px-3 py-2 border border-[var(--ops-border)]">{a.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--ops-muted)] bg-[var(--ops-bg)] rounded-lg px-3 py-2 border border-[var(--ops-border)]">Rescheduled once — see current vs original above. Multiple reschedules are preserved chronologically.</p>
                  )}
                </div>
              ) : (
                <div className="mt-4 py-8 text-center rounded-[12px] bg-[var(--ops-bg)] border border-dashed border-[var(--ops-border)]">
                  <p className="public text-[13px] text-[var(--ops-muted)]">Booking has not been rescheduled.</p>
                  <p className="mono text-[11px] text-[var(--ops-muted)]/70 mt-1">Original date remains the current appointment.</p>
                </div>
              )}
            </div>

            <BookingActions
              booking={{
                id: booking.id,
                status: booking.status as any,
                leadTemperature: booking.leadTemperature as any,
                agentName: booking.agentName,
                agentId: booking.agentId,
                assignedToId: booking.assignedToId,
                updatedAt: booking.updatedAt,
                lockedAt: booking.lockedAt,
                agentConfirmedAt: booking.agentConfirmedAt,
              }}
              staffUsers={staffUsers as any}
              agents={agents as any}
              initialMessages={messages as any}
              internalNotes={internalNotes as any}
              isLocked={isLocked}
              userRole={session?.user?.role as any}
            />

            <div id="timeline" className="scroll-mt-24">
              <UnifiedTimeline activities={activities as any} messages={messages as any} internalNotes={internalNotes as any} />
            </div>
          </div>

          <div className="space-y-6 lg:sticky lg:top-[88px] self-start">
            {/* Agent assignment history */}
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]" id="assign-agent">
              <PanelHeader
                title="Agent Assignment"
                description="Binding source of truth and confirmation state."
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
                }
              />
              <div className="mt-3">
                {booking.agent ? (
                  <div className="flex items-start gap-3 p-3 rounded-[12px] bg-[var(--ops-bg)] border border-[var(--ops-border)]">
                    <div className="h-10 w-10 rounded-full bg-[var(--ops-primary)] text-white grid place-items-center text-xs font-medium shrink-0">
                      {booking.agent.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[var(--ops-text)]">Assigned: {booking.agent.name}</div>
                      <div className="text-[12px] text-[var(--ops-muted)]">{booking.agent.email} · {booking.agent.phone}</div>
                      <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">{booking.agentConfirmedAt ? `Confirmed ${formatDate(booking.agentConfirmedAt)}` : "Pending confirmation"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center rounded-[12px] bg-[var(--ops-bg)] border border-dashed border-[var(--ops-border)]">
                    <p className="text-[13px] text-[var(--ops-muted)]">No agent assigned.</p>
                  </div>
                )}
                {agentHistory.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Assignment history</div>
                    {agentHistory.slice(0, 5).map((a: any) => (
                      <div key={a.id} className="flex gap-2 text-xs p-2 rounded-lg bg-white border border-[var(--ops-border)]">
                        <span className="h-5 w-5 rounded-full bg-[var(--ops-bg)] border border-[var(--ops-border)] grid place-items-center text-[10px]">→</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-[var(--ops-text)]">Reassigned by {a.actorName}</div>
                          <div className="mono text-[11px] text-[var(--ops-muted)]">{formatDateTime(a.createdAt)}</div>
                          {a.note && <div className="text-[12px] text-[var(--ops-muted)] mt-1">{a.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {visitorRaw && (
                  <div className="mt-3 p-3 rounded-[10px] bg-white border border-[var(--ops-border)]">
                    <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Visitor submitted</div>
                    <div className="text-[13px] text-[var(--ops-text)] mt-1">{visitorRaw} <span className="mono text-[11px] text-[var(--ops-muted)]">· read-only</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <PanelHeader
                title="Quick Stats"
                description="Counts across this booking's trail."
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3Z" /><path d="M8 13l3 3 5-6" /></svg>
                }
              />
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Timeline entries</span><span className="font-medium text-[var(--ops-text)]">{activities.length + messages.length + internalNotes.length}</span></div>
                <div className="flex justify-between mono text-[11px]"><span className="text-[var(--ops-muted)]">Activities</span><span className="text-[var(--ops-muted)]">{activities.length}</span></div>
                <div className="flex justify-between mono text-[11px]"><span className="text-[var(--ops-muted)]">Messages</span><span className="text-[var(--ops-muted)]">{messages.length}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Internal notes</span><span className="font-medium text-[var(--ops-text)]">{internalNotes.length}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Agents</span><span className="font-medium text-[var(--ops-text)]">{agents.length} active</span></div>
                <div className="pt-3 border-t border-[var(--ops-border)]">
                  <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Reference</div>
                  <div className="font-mono text-[13px] font-medium text-[var(--ops-primary)]">{booking.ref}</div>
                </div>
              </div>
            </div>

            {/* Lead temperature — at-a-glance mirror; full controls live in the working column below */}
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <PanelHeader
                title="Lead Temperature"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v10" /><path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" transform="translate(0 4)" /><circle cx="12" cy="17" r="4" /></svg>
                }
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${temperatureColors[booking.leadTemperature]}`}>{booking.leadTemperature.toUpperCase()}</span>
                {booking.outcome && (
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium border bg-white">{booking.outcome}</span>
                )}
              </div>
              <a href="#lead-temp" className="mono text-[11px] text-[var(--ops-primary)] underline underline-offset-4 mt-3 inline-block">
                Manage below →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
