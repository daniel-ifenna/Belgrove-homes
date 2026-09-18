import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { statusColors, statusLabels, temperatureColors, formatDate, formatDateTime } from "@/lib/booking-ui";
import BookingActions from "./BookingActions";
import UnifiedTimeline from "./UnifiedTimeline";
import QuickActionsBar from "@/components/admin/QuickActionsBar";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [booking, staffUsers, agents, activities, messages, internalNotes] = await Promise.all([
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
        </div>

        {/* Two-column body */}
        <div className="mt-6 grid lg:grid-cols-[1.65fr_0.95fr] gap-6 items-start">
          <div className="space-y-6">
            {/* Booking Summary — two-column */}
            <div id="booking-summary" className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)] flex items-center gap-2">
                <span className="h-6 w-6 rounded-[8px] bg-[var(--ops-primary)] text-white grid place-items-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>
                </span>
                Booking Summary
              </h2>
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
                  <div className="mt-1 font-medium text-[var(--ops-text)]">{booking.location}</div>
                  <div className="text-[12px] text-[var(--ops-muted)] mt-0.5">{booking.agentName ? `Agent on file: ${booking.agentName}` : "No agent name on file"}</div>
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
                    <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5B21B6] bg-[#F5F0FF] border border-[#DDD6FE] rounded-full px-2.5 py-1">
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
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)] flex items-center gap-2">
                <span className="h-6 w-6 rounded-[8px] bg-[#F5F0FF] border border-[#DDD6FE] text-[#5B21B6] grid place-items-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h8"/></svg>
                </span>
                Rescheduling History
              </h3>
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
          </div>

          <div className="space-y-6">
            {/* Agent assignment history */}
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]" id="assign-agent">
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Agent Assignment</h3>
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
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Quick Stats</h3>
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
          </div>
        </div>

        <div id="timeline" className="mt-6">
          <UnifiedTimeline activities={activities as any} messages={messages as any} internalNotes={internalNotes as any} />
        </div>
      </div>
    </div>
  );
}
