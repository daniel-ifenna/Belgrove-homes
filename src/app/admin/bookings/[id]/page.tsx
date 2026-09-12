import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { statusColors, statusLabels, temperatureColors, formatDate, formatDateTime } from "@/lib/booking-ui";
import BookingActions from "./BookingActions";
import UnifiedTimeline from "./UnifiedTimeline";

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
  const pipeline = ["new", "under_review", "approved", "active", "closed"] as const;
  const currentIdx = pipeline.indexOf(booking.status as (typeof pipeline)[number]);

  // Branch markers: which branch states actually occurred per activity log
  const branchStates = new Set<string>(activities.map((a: any) => a.toStatus).filter((s: string) => ["on_hold", "under_review", "rescheduled"].includes(s)));
  const hadBranch = (s: string) => branchStates.has(s);

  // Duplicate detection for this booking
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

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)] mb-4">
        <Link href="/admin/bookings" className="hover:text-[var(--ink)] hover:underline">
          ← Bookings
        </Link>
        <span className="text-[var(--line)]">/</span>
        <span className="text-[var(--ink)] font-medium">{booking.ref}</span>
        <span className="text-[var(--line)]">·</span>
        <span className="text-[var(--ink-muted)]">{booking.name}</span>
      </div>

      {isLocked && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-medium text-amber-900">🔒 Closed & locked</span>
            <span className="text-amber-800"> read-only. Use Reopen booking to make changes.</span>
            {booking.lockedAt && <span className="text-xs text-amber-700 ml-2">Locked {formatDateTime(booking.lockedAt)}</span>}
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-200 text-amber-900">Reopen available</span>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm font-medium text-amber-900">⚠ Possible duplicate</div>
          <p className="text-xs text-amber-800 mt-1">
            Same {booking.email && duplicates[0].email?.toLowerCase() === booking.email.toLowerCase() ? "email" : "phone"} and inspection within 3 days.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {duplicates.map((d) => (
              <Link key={d.id} href={`/admin/bookings/${d.id}`} className="text-xs bg-white border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-50">
                {d.ref} {d.name} · {formatDate(d.preferredDate)} · {d.status}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl tracking-tight text-[var(--ink)]">{booking.ref}</h1>
              <span className="font-mono text-xs text-[var(--ink-muted)] border border-[var(--line)] rounded-full px-2.5 py-1 bg-[var(--cream)]">{booking.id.slice(0, 8)}</span>
            </div>
            <p className="text-sm text-[var(--ink-muted)] mt-2">
              <span className="font-medium text-[var(--ink)]">{booking.name}</span>
              <span className="text-[var(--line)]"> · </span>
              <a href={`mailto:${booking.email}`} className="hover:text-[var(--ink)] underline decoration-[var(--line)]">
                {booking.email}
              </a>
              {booking.phone && (
                <>
                  <span className="text-[var(--line)]"> · </span>
                  <a href={`tel:${booking.phone}`} className="hover:text-[var(--ink)]">
                    {booking.phone}
                  </a>
                </>
              )}
            </p>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Submitted {formatDateTime(booking.createdAt)} · Updated {formatDateTime(booking.updatedAt)}
              {booking.reviewedByUser && <> · Reviewed by {booking.reviewedByUser.name}</>}
              {booking.agentConfirmedBy && <> · Agent confirmed by {booking.agentConfirmedBy.name}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>{statusLabels[booking.status]}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${temperatureColors[booking.leadTemperature]}`}>Lead: {booking.leadTemperature}</span>
            {booking.agent && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${booking.agent.category === "staff" ? "bg-[var(--forest-800)] text-white" : "bg-[var(--gold-600)] text-white"}`}>
                {booking.agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"} · {booking.agent.name}
              </span>
            )}
            {booking.outcome && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${booking.outcome === "sold" ? "bg-[var(--forest-600)] text-white" : booking.outcome === "interested" ? "bg-[var(--gold-600)] text-white" : "bg-[var(--ink)] text-white"}`}>
                {booking.outcome === "sold" ? "Sold" : booking.outcome === "interested" ? "Interested" : "Not sold"}
              </span>
            )}
          </div>
        </div>

        {/* Branch-aware stepper */}
        <div className="mt-6">
          <div className="flex items-center gap-1.5">
            {pipeline.map((step, idx) => {
              const active = idx <= currentIdx && currentIdx !== -1;
              const isCurrent = idx === currentIdx;
              const branchHere =
                (step === "new" && hadBranch("under_review")) ||
                (step === "approved" && hadBranch("on_hold")) ||
                (step === "active" && hadBranch("rescheduled"));
              return (
                <div key={step} className="flex items-center gap-1.5 flex-1 relative">
                  <div
                    className={`h-2 flex-1 rounded-full ${active ? (isCurrent ? "bg-[var(--forest-800)]" : "bg-[var(--forest-600)]") : "bg-[var(--line)]"}`}
                    title={branchHere ? "Branch state occurred here" : undefined}
                  />
                  {branchHere && (
                    <span
                      className="absolute -top-1 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-[var(--gold-600)] border-2 border-white shadow"
                      title={
                        hadBranch("under_review")
                          ? "Was Under Review"
                          : hadBranch("on_hold")
                            ? "Was On Hold"
                            : "Was Rescheduled"
                      }
                    />
                  )}
                  {idx < pipeline.length - 1 && <div className="h-px w-2 bg-[var(--line)] hidden md:block" />}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] tracking-wide uppercase text-[var(--ink-muted)]">
            <span>New</span>
            <span>Review</span>
            <span>Approved</span>
            <span>Active</span>
            <span>Closed</span>
          </div>
          {(hadBranch("under_review") || hadBranch("on_hold") || hadBranch("rescheduled")) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {hadBranch("under_review") && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber-600)]" />
                  Was Under Review
                </span>
              )}
              {hadBranch("on_hold") && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-600" />
                  Was On Hold
                </span>
              )}
              {hadBranch("rescheduled") && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--plum-600)]" />
                  Was Rescheduled
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="mt-6 grid lg:grid-cols-[1.7fr_0.9fr] gap-6 items-start">
        <div className="space-y-6">
          {/* Booking Details */}
          <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2 mb-5">
              <span className="h-6 w-6 rounded-md bg-[var(--forest-800)] text-white grid place-items-center text-xs">▦</span>
              Booking Details
              <span className="ml-auto text-xs font-normal text-[var(--ink-muted)]">{booking.location}</span>
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="col-span-2 md:col-span-1">
                <dt className="text-xs tracking-wide uppercase text-[var(--ink-muted)]">Client</dt>
                <dd className="mt-1 font-medium text-[var(--ink)]">{booking.name}</dd>
                <dd className="text-xs text-[var(--ink-muted)]">{booking.email} {booking.phone ? `· ${booking.phone}` : ""}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase text-[var(--ink-muted)]">Inspection</dt>
                <dd className="mt-1 text-[var(--ink)]">{formatDate(booking.preferredDate)} at {booking.preferredTime}</dd>
                <dd className="text-xs text-[var(--ink-muted)]">{booking.location}</dd>
                {booking.rescheduledDate && (
                  <dd className="mt-1 text-xs text-[var(--plum-600)] bg-purple-50 border border-purple-200 rounded-full px-2.5 py-1 inline-flex">
                    Rescheduled → {formatDate(booking.rescheduledDate)} at {booking.rescheduledTime}
                  </dd>
                )}
              </div>
              {/* Canonical Agent */}
              <div className="col-span-2 border-t border-[var(--line)] pt-4">
                <dt className="text-xs tracking-wide uppercase text-[var(--ink-muted)]">Company Agent (assigned)</dt>
                <dd className="mt-2">
                  {booking.agent ? (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--cream)] border border-[var(--line)]">
                      <div className="h-9 w-9 rounded-full bg-[var(--forest-800)] text-white grid place-items-center text-xs font-medium">
                        {booking.agent.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--ink)]">{booking.agent.name}</div>
                        <div className="text-xs text-[var(--ink-muted)]">{booking.agent.email} · {booking.agent.phone}</div>
                        <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs ${booking.agent.category === "staff" ? "bg-[var(--forest-800)] text-white" : "bg-[var(--gold-600)] text-white"}`}>
                          {booking.agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"} · Company DB
                        </span>
                        {booking.agentConfirmedAt ? (
                          <span className="inline-flex ml-2 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Confirmed {formatDate(booking.agentConfirmedAt)}
                          </span>
                        ) : (
                          <span className="inline-flex ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
                            Needs confirmation
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">Assigned</span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
                      <span className="text-amber-800 font-medium">Not assigned</span>
                      <span className="text-amber-700"> use Company Agent panel to assign.</span>
                    </div>
                  )}
                </dd>
              </div>
              {/* Visitor raw */}
              <div className="col-span-2">
                <dt className="text-xs tracking-wide uppercase text-[var(--ink-muted)] flex items-center gap-2">
                  Agent as submitted by visitor
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--cream)] border border-[var(--line)] text-[var(--ink-muted)]">read-only</span>
                </dt>
                <dd className="mt-2">
                  {visitorRaw ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[var(--ink)]">{visitorRaw}</span>
                      <span className="text-xs text-[var(--ink-muted)] border border-[var(--line)] rounded-full px-2 py-0.5 bg-white">visitor submitted</span>
                    </div>
                  ) : (
                    <span className="text-[var(--ink-muted)] italic text-sm">None provided visitor left blank</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase text-[var(--ink-muted)]">Lead</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${temperatureColors[booking.leadTemperature]}`}>{booking.leadTemperature}</span>
                  <span className="text-xs text-[var(--ink-muted)]">{statusLabels[booking.status]}</span>
                </dd>
              </div>
              {/* Pinned latest internal note */}
              {internalNotes[0] && (
                <div className="col-span-2">
                  <dt className="text-xs tracking-wide uppercase text-[var(--ink-muted)]">Latest internal note</dt>
                  <dd className="mt-1 p-3 bg-[var(--cream)] border border-[var(--line)] rounded-xl text-sm text-[var(--ink)]">
                    <div className="text-xs text-[var(--ink-muted)] mb-1">{internalNotes[0].authorName} · {formatDateTime(internalNotes[0].createdAt)}</div>
                    <div className="whitespace-pre-wrap">{internalNotes[0].body}</div>
                  </dd>
                </div>
              )}
            </dl>
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
          <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
            <h3 className="text-xs tracking-wide uppercase text-[var(--ink-muted)]">Quick Stats</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--ink-muted)]">Timeline entries</span>
                <span className="font-medium text-[var(--ink)]">{activities.length + messages.length + internalNotes.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--ink-muted)] ml-4"> Messages (subset)</span>
                <span className="text-[var(--ink-muted)]">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-muted)]">Activities</span>
                <span className="font-medium text-[var(--ink)]">{activities.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-muted)]">Internal notes</span>
                <span className="font-medium text-[var(--ink)]">{internalNotes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-muted)]">Company agents</span>
                <span className="font-medium text-[var(--ink)]">{agents.length} active</span>
              </div>
              <div className="pt-3 border-t border-[var(--line)]">
                <div className="text-xs text-[var(--ink-muted)]">Ref</div>
                <div className="font-mono text-sm font-medium text-[var(--ink)]">{booking.ref}</div>
                <div className="text-xs text-[var(--ink-muted)] mt-1">{booking.phone ?? "No phone"}</div>
              </div>
            </div>
            <p className="text-[10px] text-[var(--ink-muted)] mt-3">Timeline entries = status changes + notes + messages combined. Messages are a subset.</p>
            <div className="mt-6 flex gap-2">
              <Link href="/admin/bookings" className="flex-1 text-center text-sm border border-[var(--line)] bg-white rounded-full py-2 hover:bg-[var(--cream)]">
                Back to bookings
              </Link>
              <Link href="/admin/agents" className="flex-1 text-center text-sm bg-[var(--forest-800)] text-white rounded-full py-2 hover:bg-[var(--forest-600)]">
                Manage agents
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <UnifiedTimeline activities={activities as any} messages={messages as any} internalNotes={internalNotes as any} />
      </div>
    </div>
  );
}
