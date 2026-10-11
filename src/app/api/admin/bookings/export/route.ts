import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { allOutcomes, allStatuses, allTemperatures } from "@/lib/booking-ui";
import type { Prisma, BookingStatus, LeadTemperature, SaleOutcome } from "@/generated/prisma/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawReportBanner } from "@/lib/documents/brand";
import {
  pdfCellText,
  stripEmojiForPdf,
  cleanExportText,
  TABLE_OVERFLOW_LINEBREAK,
} from "@/lib/documents/exportTables";

// Portrait-only bookings export. Every page is A4 portrait — no landscape,
// no forced blank pages. Sections flow via autotable's natural pagination;
// headings check remaining space so they never orphan from their first row.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;

  const where: Prisma.InspectionBookingWhereInput = {};
  const status = params.get("status");
  const leadTemperature = params.get("leadTemperature");
  const outcome = params.get("outcome");
  const agent = params.get("agent");
  const agentId = params.get("agentId");
  const missingAgent = params.get("missingAgent");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const q = params.get("q");

  if (status && (allStatuses as readonly string[]).includes(status)) {
    where.status = status as BookingStatus;
  }
  if (leadTemperature && (allTemperatures as readonly string[]).includes(leadTemperature)) {
    where.leadTemperature = leadTemperature as LeadTemperature;
  }
  if (outcome && (allOutcomes as readonly string[]).includes(outcome)) {
    where.outcome = outcome as SaleOutcome;
  }
  if (missingAgent === "1") where.agentId = null;
  else if (agentId) where.agentId = agentId;
  const and: Prisma.InspectionBookingWhereInput[] = [];
  if (!agentId && missingAgent !== "1" && agent) {
    and.push({
      OR: [
        { agentName: { contains: agent, mode: "insensitive" } },
        { agent: { name: { contains: agent, mode: "insensitive" } } },
        { agent: { email: { contains: agent, mode: "insensitive" } } },
      ],
    });
  }
  if (q) {
    and.push({
      OR: [
        { ref: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return NextResponse.json({ error: "Invalid dateFrom/dateTo" }, { status: 400 });
  }
  if (from || to) {
    where.preferredDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const bookings = await prisma.inspectionBooking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      agent: true,
      assignedToUser: true,
      reviewedByUser: true,
      activities: { orderBy: { createdAt: "asc" } },
      internalNotes: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  const total = bookings.length;
  const byStatus: Record<string, number> = {};
  const byTemp: Record<string, number> = {};
  for (const b of bookings) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    byTemp[b.leadTemperature] = (byTemp[b.leadTemperature] ?? 0) + 1;
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const usable = pageW - margin * 2; // 182
  const generatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const bannerMeta = `Generated ${generatedAt}  •  ${total} record(s)`;

  function drawHeaderFooter() {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawReportBanner(doc, {
        title: "Belgrove Homes",
        subtitle: "Inspection Booking & Activity Report",
        meta: bannerMeta,
        margin,
      });
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(6);
      doc.setTextColor(120, 130, 125);
      doc.setFont("helvetica", "normal");
      const footerText = `Belgrove Homes  •  Suite 25, Lebrex Plaza, 47 Ajose Adeogun St, Utako, Abuja  •  info@belgrovehomes.com  •  +234 810 376 0063  •  Page ${i} of ${pageCount}`;
      const split = doc.splitTextToSize(footerText, w - 20);
      doc.text(split, w / 2, h - 6, { align: "center" });
      doc.setDrawColor(227, 230, 225);
      doc.setLineWidth(0.2);
      doc.line(10, h - 10, w - 10, h - 10);
    }
  }

  const filters: string[] = [];
  if (status) filters.push(`Status: ${status}`);
  if (leadTemperature) filters.push(`Lead: ${leadTemperature}`);
  if (missingAgent === "1") filters.push("Missing agent");
  if (agent) filters.push(`Agent: ${agent}`);
  if (agentId) {
    const ag = await prisma.agent.findUnique({ where: { id: agentId }, select: { name: true } });
    if (ag) filters.push(`Agent: ${ag.name}`);
  }
  if (q) filters.push(`Search: ${q}`);
  if (from || to) filters.push(`Date: ${from ? from.toISOString().split("T")[0] : "…"} to ${to ? to.toISOString().split("T")[0] : "…"}`);

  // First page banner is drawn at the end (drawHeaderFooter covers all
  // pages); body starts below the 28mm banner + gold rule.
  let y = 36;
  const bottomLimit = pageH - 18;

  function ensureSpace(needed: number) {
    if (y + needed > bottomLimit) {
      doc.addPage("a4", "portrait");
      y = 36;
    }
  }

  function sectionTitle(title: string, subtitle?: string) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(16, 35, 30);
    doc.text(stripEmojiForPdf(title), margin, y);
    y += 4;
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(101, 115, 110);
      const lines = doc.splitTextToSize(stripEmojiForPdf(subtitle), usable);
      doc.text(lines, margin, y);
      y += lines.length * 3 + 2;
    } else {
      y += 2;
    }
    doc.setDrawColor(200, 160, 74);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 14, y);
    y += 4;
  }

  function subHeading(title: string) {
    // Keep heading with its first row: reserve heading + ~12mm of table.
    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(13, 51, 40);
    doc.text(stripEmojiForPdf(title).toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(200, 160, 74);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 12, y);
    y += 4;
  }

  type TableOpts = {
    head: string[][];
    body: string[][];
    colWidths: number[];
    fontSize?: number;
  };

  function flowTable(opts: TableOpts) {
    autoTable(doc, {
      startY: y,
      head: opts.head,
      body: opts.body,
      theme: "grid",
      tableWidth: usable,
      showHead: "everyPage",
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: opts.fontSize ?? 7,
        cellPadding: 2,
        lineColor: [227, 230, 225],
        lineWidth: 0.2,
        textColor: [16, 35, 30],
        overflow: TABLE_OVERFLOW_LINEBREAK,
        valign: "middle",
      },
      headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
      alternateRowStyles: { fillColor: [247, 245, 238] },
      columnStyles: Object.fromEntries(opts.colWidths.map((w, i) => [i, { cellWidth: w }])),
      margin: { left: margin, right: margin, top: 36, bottom: 18 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Single-record export (e.g. one booking pulled by ref): skip the
  // company-wide analytics and print just that booking's detail, so the
  // file stays at 1–2 pages instead of 4+ pages of one-row tables.
  const isSingle = bookings.length === 1;

  // --- Executive summary (flows, no forced breaks) ---
  if (!isSingle) {
  sectionTitle(
    "Inspection Bookings: Executive Summary",
    `Report covers ${total} booking(s) matching current filters. Figures are dynamically calculated from live records.`
  );

  if (filters.length) {
    ensureSpace(12);
    doc.setFillColor(247, 245, 238);
    doc.setDrawColor(227, 230, 225);
    const filterText = `Filters: ${stripEmojiForPdf(filters.join("  •  "))}`;
    const lines = doc.splitTextToSize(filterText, usable - 6);
    const boxH = lines.length * 3.5 + 5;
    ensureSpace(boxH + 2);
    doc.roundedRect(margin, y - 3, usable, boxH, 2, 2, "FD");
    doc.setFontSize(6.5);
    doc.setTextColor(101, 115, 110);
    doc.text(lines, margin + 3, y + 2);
    y += boxH + 2;
  }

  const summaryBody: string[][] = [
    ["Total Bookings", String(total)],
    ...allStatuses.map((s) => [
      stripEmojiForPdf(s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())),
      String(byStatus[s] ?? 0),
    ]),
    ["-", ""],
    ...allTemperatures.map((t) => [t.toUpperCase(), String(byTemp[t] ?? 0)]),
  ];
  flowTable({ head: [["Metric", "Count"]], body: summaryBody, colWidths: [120, usable - 120] });

  // --- Performance analytics ---
  sectionTitle(
    "Performance Analytics: Company Wide",
    "Aggregated from current filtered bookings. For operational review and company-wide planning."
  );

  const byProperty: Record<string, number> = {};
  const byAgentPerf: Record<string, number> = {};
  const uniqueEmails = new Set<string>();
  const uniquePhones = new Set<string>();
  for (const b of bookings) {
    const prop = (b.location || "Unspecified").trim() || "Unspecified";
    byProperty[prop] = (byProperty[prop] ?? 0) + 1;
    const agentLabel = (b as unknown as { agent?: { name?: string } }).agent?.name ?? "Unassigned";
    byAgentPerf[agentLabel] = (byAgentPerf[agentLabel] ?? 0) + 1;
    if (b.email) uniqueEmails.add(b.email.toLowerCase().trim());
    if (b.phone) uniquePhones.add(b.phone.replace(/\D/g, ""));
  }

  flowTable({
    head: [["KPI", "Count"]],
    body: [
      ["Properties Booked (total records)", String(total)],
      ["Unique Properties (locations)", String(Object.keys(byProperty).length)],
      ["Visitor Count (total bookings)", String(total)],
      ["Unique Visitors (by email)", String(uniqueEmails.size)],
      ["Agents Involved", String(Object.keys(byAgentPerf).length)],
    ],
    colWidths: [120, usable - 120],
  });

  subHeading("Properties booked: by estate / location");
  const propertyRows = Object.entries(byProperty)
    .sort((a, b) => b[1] - a[1])
    .map(([loc, cnt]) => [pdfCellText(loc, 20), String(cnt), `${((cnt / (total || 1)) * 100).toFixed(1)}%`]);
  flowTable({
    head: [["Property / Location", "Bookings", "Share"]],
    body: propertyRows.length ? propertyRows : [["No properties in filtered set", "0", "-"]],
    colWidths: [usable - 60, 30, 30],
    fontSize: 6.5,
  });

  subHeading("Agent performance: bookings handled");
  const agentRows = Object.entries(byAgentPerf)
    .sort((a, b) => b[1] - a[1])
    .map(([name, cnt]) => [pdfCellText(name, 20), String(cnt), `${((cnt / (total || 1)) * 100).toFixed(1)}%`]);
  flowTable({
    head: [["Agent", "Bookings Handled", "Share"]],
    body: agentRows.length ? agentRows : [["No agents", "0", "-"]],
    colWidths: [usable - 60, 35, 25],
    fontSize: 6.5,
  });

  // --- Performance sheet (portrait — same orientation as every page) ---
  subHeading("Performance sheet: agent / property / inspection / client / lead");
  const perfRows = bookings.map((b: unknown) => {
    const r = b as {
      agent?: { name?: string } | null;
      location?: string | null;
      rescheduledDate?: Date | null;
      preferredDate?: Date | null;
      rescheduledTime?: string | null;
      preferredTime?: string | null;
      name: string;
      email: string;
      leadTemperature?: string | null;
      status: string;
    };
    const agentName = pdfCellText(r.agent?.name ?? "Unassigned", 18);
    const property = pdfCellText(r.location ?? "-", 18);
    const inspDate = r.rescheduledDate
      ? new Date(r.rescheduledDate).toLocaleDateString("en-GB")
      : r.preferredDate
        ? new Date(r.preferredDate).toLocaleDateString("en-GB")
        : "-";
    const inspTime = r.rescheduledTime ?? r.preferredTime ?? "";
    const dateCell = pdfCellText(inspTime ? `${inspDate} ${inspTime}` : inspDate, 18);
    const client = pdfCellText(`${r.name} ${r.email}`, 16);
    const lead = r.leadTemperature ? stripEmojiForPdf(r.leadTemperature).toUpperCase() : "-";
    const closed = r.status === "closed" ? "CLOSED" : r.status === "active" ? "COMPLETED" : stripEmojiForPdf(r.status).toUpperCase();
    return [agentName, property, dateCell, client, `${lead} / ${closed}`];
  });
  // 182mm portrait: 32 + 52 + 32 + 40 + 26 = 182.
  flowTable({
    head: [["Agent", "Property", "Inspection Date", "Client", "Lead / Status"]],
    body: perfRows.length ? perfRows : [["-", "No bookings in filtered set", "-", "-", "-"]],
    colWidths: [32, 52, 32, 40, 26],
    fontSize: 6.5,
  });

  ensureSpace(10);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(101, 115, 110);
  const uniqueNote =
    `Visitor count = total bookings (${total}); Unique visitors by email = ${uniqueEmails.size} ` +
    `(${uniquePhones.size} unique phones). Use this for company-wide funnel and capacity planning. ` +
    `This report is an audit document. Rescheduling history and internal notes are preserved per booking below.`;
  const noteLines = doc.splitTextToSize(stripEmojiForPdf(uniqueNote), usable);
  ensureSpace(noteLines.length * 3.5 + 2);
  doc.text(noteLines, margin, y);
  y += noteLines.length * 3.5 + 6;
  } // end company-wide sections (skipped for single-record exports)

  // --- Per-booking detail (flows, no per-record forced page) ---
  const isHumanNote = (n: { authorName?: string | null; body?: string | null }) => {
    if ((n.authorName ?? "") === "System") return false;
    const body = (n.body ?? "").trim();
    if (/^\[(Sold|Not Sold|Interested)/i.test(body)) return false;
    return true;
  };

  for (let idx = 0; idx < bookings.length; idx++) {
    const b = bookings[idx] as unknown as {
      ref: string;
      name: string;
      email: string;
      phone?: string | null;
      location: string;
      preferredDate?: Date | null;
      preferredTime?: string | null;
      rescheduledDate?: Date | null;
      rescheduledTime?: string | null;
      agent?: { name?: string; email?: string; category?: string } | null;
      visitorAgentRaw?: string | null;
      agentName?: string | null;
      status: string;
      leadTemperature: string;
      outcome?: string | null;
      activities?: { action?: string; actorName?: string; createdAt?: Date; note?: string | null }[];
      internalNotes?: { authorName?: string; body?: string; createdAt?: Date }[];
      messages?: { authorName?: string; message?: string; createdAt?: Date }[];
      createdAt: Date;
      updatedAt: Date;
      lockedAt?: Date | null;
    };

    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(16, 35, 30);
    doc.text(pdfCellText(b.ref, 30).replaceAll("\n", " "), margin, y, { maxWidth: usable });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(101, 115, 110);
    doc.text(pdfCellText(`${b.name}  ${b.email}`, 24).replaceAll("\n", " "), margin, y, { maxWidth: usable - 60 });
    const badges = [
      stripEmojiForPdf(b.status).toUpperCase(),
      stripEmojiForPdf(b.leadTemperature).toUpperCase(),
    ];
    let bx = pageW - margin - 2;
    for (let i = badges.length - 1; i >= 0; i--) {
      const label = badges[i];
      const w = doc.getTextWidth(label) + 6;
      bx -= w + 2;
      doc.setFillColor(13, 51, 40);
      doc.roundedRect(bx, y - 4, w, 6, 1, 1, "F");
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(label, bx + 3, y - 0.5);
    }
    y += 6;
    doc.setDrawColor(227, 230, 225);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    const kv = (rows: [string, string][]) => {
      flowTable({
        head: [],
        body: rows.map(([k, v]) => [stripEmojiForPdf(k), pdfCellText(v, 20)]),
        colWidths: [38, usable - 38],
        fontSize: 7,
      });
    };

    subHeading("Customer");
    kv([
      ["Name", b.name],
      ["Email", b.email],
      ["Phone", b.phone ?? "-"],
      ["Booking Ref", b.ref],
    ]);

    subHeading("Property");
    kv([
      ["Estate / Location", b.location],
      ["Inspection Date", b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "-"],
      ["Inspection Time", b.preferredTime ?? "-"],
      [
        "Assigned Agent",
        b.agent ? `${b.agent.name ?? ""} (${b.agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"})` : "Unassigned",
      ],
      ["Visitor Agent Note", b.visitorAgentRaw ?? b.agentName ?? "-"],
    ]);

    subHeading("Booking");
    kv([
      ["Original Date", b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "-"],
      ["Original Time", b.preferredTime ?? "-"],
      [
        "Current Date",
        b.rescheduledDate
          ? new Date(b.rescheduledDate).toLocaleDateString("en-GB")
          : b.preferredDate
            ? new Date(b.preferredDate).toLocaleDateString("en-GB")
            : "-",
      ],
      ["Current Time", b.rescheduledTime ?? b.preferredTime ?? "-"],
    ]);

    subHeading("Status");
    kv([
      ["Booking Status", b.status],
      ["Lead Temperature", b.leadTemperature],
      ["Lead Outcome", b.outcome ?? "-"],
      ["Assigned Agent", b.agent ? `${b.agent.name ?? ""} <${b.agent.email ?? ""}>` : "No agent assigned."],
    ]);

    // Rescheduling history (human/system reschedule notes flow, no orphan).
    subHeading("Rescheduling history");
    if (b.rescheduledDate) {
      const hist = (b.activities ?? []).filter((a) => a.action === "reschedule");
      if (hist.length > 0) {
        flowTable({
          head: [["Changed", "By", "Reason"]],
          body: hist.map((h) => [
            h.createdAt ? new Date(h.createdAt).toLocaleString("en-GB") : "-",
            pdfCellText(h.actorName ?? "-", 18),
            pdfCellText(h.note ?? "Rescheduled", 18),
          ]),
          colWidths: [34, 34, usable - 68],
          fontSize: 6.5,
        });
      } else {
        ensureSpace(10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(16, 35, 30);
        doc.text(
          stripEmojiForPdf(
            `Original: ${b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "-"} ${b.preferredTime ?? ""}  →  Rescheduled: ${new Date(b.rescheduledDate).toLocaleDateString("en-GB")} ${b.rescheduledTime ?? ""}`
          ),
          margin,
          y,
          { maxWidth: usable }
        );
        y += 6;
      }
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(101, 115, 110);
      doc.text("Booking has not been rescheduled.", margin, y);
      y += 6;
    }

    // Internal notes — human-written admin notes only. System-authored rows
    // ([Sold]/[Not Sold]/[Interested…], author "System") live only in
    // Activity History so they are never repeated here.
    subHeading("Internal notes");
    const humanNotes = (b.internalNotes ?? []).filter(isHumanNote);
    if (humanNotes.length === 0) {
      ensureSpace(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(101, 115, 110);
      doc.text("No internal notes recorded.", margin, y);
      y += 6;
    } else {
      flowTable({
        head: [["Date", "Author", "Note"]],
        body: humanNotes.map((n) => [
          n.createdAt ? new Date(n.createdAt).toLocaleString("en-GB") : "-",
          pdfCellText(n.authorName ?? "-", 18),
          pdfCellText(n.body ?? "", 16),
        ]),
        colWidths: [30, 30, usable - 60],
        fontSize: 6.5,
      });
    }

    // Activity history — each event once. Messages (human + automated
    // system) plus human notes, deduped by normalized content so the
    // record_outcome double-write (same text as Message + as Note) prints
    // a single row. System-authored internal-note copies are excluded —
    // the Message row is the canonical one.
    subHeading("Activity history");
    const msgs = b.messages ?? [];
    type TimelineEntry = { at: Date; label: string; actor: string; text: string };
    const candidates: TimelineEntry[] = [
      ...msgs.map((m) => ({
        at: m.createdAt ? new Date(m.createdAt) : new Date(0),
        label: "Message",
        actor: m.authorName ?? "-",
        text: m.message ?? "",
      })),
      ...humanNotes.map((n) => ({
        at: n.createdAt ? new Date(n.createdAt) : new Date(0),
        label: "Note",
        actor: n.authorName ?? "-",
        text: n.body ?? "",
      })),
    ].sort((a, z) => a.at.getTime() - z.at.getTime());

    const seen = new Set<string>();
    const deduped: TimelineEntry[] = [];
    for (const e of candidates) {
      const norm = stripEmojiForPdf(cleanExportText(e.text))
        .toLowerCase()
        .replace(/^\[(sold|not sold|interested[^\]]*)\]\s*/i, "")
        .replace(/^(message|note)\s*:\s*/i, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      const key = `${e.at.getTime()}|${norm}`;
      const contentKey = norm;
      if (seen.has(key) || (contentKey && [...seen].some((s) => s.endsWith(`|${contentKey}`)))) continue;
      seen.add(key);
      deduped.push(e);
    }

    if (deduped.length === 0) {
      ensureSpace(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(101, 115, 110);
      doc.text("No notes or messages recorded.", margin, y);
      y += 6;
    } else {
      flowTable({
        head: [["Date", "Actor", "Event"]],
        body: deduped.map((e) => [
          e.at.getTime() ? e.at.toLocaleString("en-GB") : "-",
          pdfCellText(e.actor, 18),
          pdfCellText(`${e.label}: ${e.text}`, 16),
        ]),
        colWidths: [32, 30, usable - 62],
        fontSize: 6,
      });
    }

    subHeading("Audit");
    ensureSpace(14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(101, 115, 110);
    const auditLines = [
      `Created: ${new Date(b.createdAt).toLocaleString("en-GB")}`,
      `Last updated: ${new Date(b.updatedAt).toLocaleString("en-GB")}${b.lockedAt ? `  •  Locked: ${new Date(b.lockedAt).toLocaleString("en-GB")}` : ""}`,
      `Status: ${stripEmojiForPdf(b.status)}  •  Lead: ${stripEmojiForPdf(b.leadTemperature)}  •  Outcome: ${stripEmojiForPdf(b.outcome ?? "-")}`,
    ];
    for (const line of auditLines) {
      ensureSpace(5);
      doc.text(stripEmojiForPdf(line), margin, y, { maxWidth: usable });
      y += 4;
    }
    y += 4;
  }

  drawHeaderFooter();

  const filename = `belgrove-bookings-${new Date().toISOString().split("T")[0]}.pdf`;
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
