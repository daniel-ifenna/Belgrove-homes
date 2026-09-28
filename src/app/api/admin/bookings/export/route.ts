import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { allStatuses, allTemperatures } from "@/lib/booking-ui";
import type { Prisma, BookingStatus, LeadTemperature } from "@/generated/prisma/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;

  const where: Prisma.InspectionBookingWhereInput = {};
  const status = params.get("status");
  const leadTemperature = params.get("leadTemperature");
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
  if (missingAgent === "1") where.agentId = null;
  else if (agentId) where.agentId = agentId;
  else if (agent) {
    where.OR = [
      { agentName: { contains: agent, mode: "insensitive" } },
      { agent: { name: { contains: agent, mode: "insensitive" } } },
      { agent: { email: { contains: agent, mode: "insensitive" } } },
    ];
  }
  if (q) {
    where.OR = [
      { ref: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }

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

  // Executive summary calculations
  const total = bookings.length;
  const byStatus: Record<string, number> = {};
  const byTemp: Record<string, number> = {};
  for (const b of bookings) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    byTemp[b.leadTemperature] = (byTemp[b.leadTemperature] ?? 0) + 1;
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 14;

  // Helpers
  function header() {
    doc.setFillColor(13, 51, 40); // #0D3328 primary green
    doc.rect(0, 0, pageW, 28, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(200, 160, 74); // #C8A04A muted gold
    doc.text("Belgrove Homes", margin, 11);
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text("Inspection Booking & Activity Report", margin, 17);
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}  •  ${total} record(s)`, margin, 23);
    // thin gold accent line
    doc.setFillColor(200, 160, 74);
    doc.rect(0, 28, pageW, 0.6, "F");
  }

  function footer() {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      const fm = 10;
      doc.setFontSize(6);
      doc.setTextColor(120, 130, 125);
      doc.setFont("helvetica", "normal");
      const footerText = `Belgrove Homes  •  Suite 25, Lebrex Plaza, 47 Ajose Adeogun Street, Utako, Abuja  •  info@belgrovehomes.com  •  +234 810 376 0063  •  Page ${i} of ${pageCount}`;
      // Center footer text
      const textW = doc.getTextWidth(footerText);
      const x = (w - textW) / 2;
      const y = h - 6;
      doc.text(footerText, x, y);
      doc.setDrawColor(227, 230, 225);
      doc.setLineWidth(0.2);
      doc.line(fm, h - 10, w - fm, h - 10);
    }
  }

  // Filters summary
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

  // --- PAGE 1: Executive Summary ---
  header();
  let y = 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 35, 30);
  doc.text("Inspection Bookings — Executive Summary", margin, y);
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(101, 115, 110);
  doc.setFont("helvetica", "normal");
  doc.text(`Report covers ${total} booking(s) matching current filters. Figures are dynamically calculated from live records.`, margin, y);
  y += 6;

  if (filters.length) {
    doc.setFillColor(247, 245, 238); // #F7F5EE
    doc.setDrawColor(227, 230, 225);
    doc.roundedRect(margin, y - 3, pageW - margin * 2, 8, 2, 2, "FD");
    doc.setFontSize(6.5);
    doc.setTextColor(101, 115, 110);
    doc.text(`Filters: ${filters.join("  •  ")}`, margin + 3, y + 2);
    y += 10;
  }

  // Summary table — status and lead
  const summaryHead = [["Metric", "Count"]];
  const summaryBody: string[][] = [
    ["Total Bookings", String(total)],
    ...allStatuses.map((s) => [s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()), String(byStatus[s] ?? 0)]),
    ["—", ""],
    ...allTemperatures.map((t) => [t.toUpperCase(), String(byTemp[t] ?? 0)]),
  ];

  autoTable(doc, {
    startY: y,
    head: summaryHead,
    body: summaryBody,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2.5, lineColor: [227, 230, 225], lineWidth: 0.2, textColor: [16, 35, 30] },
    headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 30, halign: "center" } },
    alternateRowStyles: { fillColor: [247, 245, 238] },
    margin: { left: margin, right: margin, top: 10, bottom: 12 },
  });

  // --- Performance Analytics — Company Wide ---
  let perfY = (doc as any).lastAutoTable.finalY + 10;
  if (perfY > 220) { doc.addPage(); header(); perfY = 36; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(16, 35, 30);
  doc.text("Performance Analytics — Company Wide", margin, perfY);
  perfY += 3;
  doc.setFontSize(6.5);
  doc.setTextColor(101, 115, 110);
  doc.setFont("helvetica", "normal");
  doc.text("Aggregated from current filtered bookings — for operational review and company-wide planning.", margin, perfY);
  perfY += 4;
  doc.setDrawColor(200, 160, 74);
  doc.setLineWidth(0.3);
  doc.line(margin, perfY, margin + 14, perfY);
  perfY += 6;

  // Compute analytics
  const byProperty: Record<string, number> = {};
  const byAgentPerf: Record<string, number> = {};
  const uniqueEmails = new Set<string>();
  const uniquePhones = new Set<string>();
  for (const b of bookings) {
    const prop = (b.location || "Unspecified").trim() || "Unspecified";
    byProperty[prop] = (byProperty[prop] ?? 0) + 1;
    const agentLabel = (b as any).agent?.name ?? "Unassigned";
    byAgentPerf[agentLabel] = (byAgentPerf[agentLabel] ?? 0) + 1;
    if (b.email) uniqueEmails.add(b.email.toLowerCase().trim());
    if (b.phone) uniquePhones.add(b.phone.replace(/\D/g, ""));
  }
  const visitorCount = total;
  const uniqueVisitorCount = uniqueEmails.size;

  // Visitor & Booking totals
  autoTable(doc, {
    startY: perfY,
    head: [["KPI", "Count"]],
    body: [
      ["Properties Booked (total records)", String(total)],
      ["Unique Properties (locations)", String(Object.keys(byProperty).length)],
      ["Visitor Count (total bookings)", String(visitorCount)],
      ["Unique Visitors (by email)", String(uniqueVisitorCount)],
      ["Agents Involved", String(Object.keys(byAgentPerf).length)],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, lineColor: [227, 230, 225], textColor: [16, 35, 30] },
    headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 30, halign: "center" } },
    alternateRowStyles: { fillColor: [247, 245, 238] },
    margin: { left: margin, right: margin },
  });
  perfY = (doc as any).lastAutoTable.finalY + 6;

  // Properties booked breakdown
  if (perfY > 240) { doc.addPage(); header(); perfY = 36; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(13, 51, 40);
  doc.text("PROPERTIES BOOKED — BY ESTATE / LOCATION", margin, perfY);
  perfY += 4;
  const propertyRows = Object.entries(byProperty)
    .sort((a, b) => b[1] - a[1])
    .map(([loc, cnt]) => [loc.length > 42 ? loc.slice(0, 42) + "…" : loc, String(cnt), `${((cnt / (total || 1)) * 100).toFixed(1)}%`]);
  autoTable(doc, {
    startY: perfY,
    head: [["Property / Location", "Bookings", "Share"]],
    body: propertyRows.length ? propertyRows : [["No properties in filtered set", "0", "—"]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 6.5, cellPadding: 2, lineColor: [227, 230, 225] },
    headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 20, halign: "center" }, 2: { cellWidth: 20, halign: "center" } },
    margin: { left: margin, right: margin },
  });
  perfY = (doc as any).lastAutoTable.finalY + 6;

  // Agent performance — who handled
  if (perfY > 240) { doc.addPage(); header(); perfY = 36; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(13, 51, 40);
  doc.text("AGENT PERFORMANCE — BOOKINGS HANDLED", margin, perfY);
  perfY += 4;
  const agentRows = Object.entries(byAgentPerf)
    .sort((a, b) => b[1] - a[1])
    .map(([name, cnt]) => [name, String(cnt), `${((cnt / (total || 1)) * 100).toFixed(1)}%`]);
  autoTable(doc, {
    startY: perfY,
    head: [["Agent", "Bookings Handled", "Share"]],
    body: agentRows.length ? agentRows : [["No agents", "0", "—"]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 6.5, cellPadding: 2, lineColor: [227, 230, 225] },
    headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 30, halign: "center" }, 2: { cellWidth: 20, halign: "center" } },
    margin: { left: margin, right: margin },
  });
  perfY = (doc as any).lastAutoTable.finalY + 6;

  // --- Landscape Performance Sheet — Agent / Property / Inspection / Client / Lead ---
  // This sheet is designed to fit A4 landscape perfectly (297mm) for company-wide analytics
  doc.addPage("a4", "landscape");
  const landscapeW = 297;
  const landscapeMargin = 10;
  // Header for landscape page
  doc.setFillColor(13, 51, 40);
  doc.rect(0, 0, landscapeW, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(200, 160, 74);
  doc.text("Belgrove Homes — Performance Sheet", landscapeMargin, 10);
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text(`Landscape overview  •  ${total} booking(s)  •  Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`, landscapeMargin, 16);
  doc.setFillColor(200, 160, 74);
  doc.rect(0, 22, landscapeW, 0.6, "F");

  // Build rows: Agent | Property | Inspection Date | Client | Lead / Closed
  const landscapeRows = bookings.map((b: any) => {
    const agent = b.agent?.name ?? "Unassigned";
    const property = b.location ?? "—";
    const inspDate = b.rescheduledDate ? new Date(b.rescheduledDate).toLocaleDateString("en-GB") : b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "—";
    const inspTime = b.rescheduledTime ?? b.preferredTime ?? "";
    const dateCell = inspTime ? `${inspDate} · ${inspTime}` : inspDate;
    const client = `${b.name}\n${b.email}`;
    const lead = b.leadTemperature ? b.leadTemperature.toUpperCase() : "—";
    const closed = b.status === "closed" ? "CLOSED" : b.status === "active" ? "COMPLETED" : b.status.toUpperCase();
    const leadCell = `${lead}  •  ${closed}`;
    return [agent, property, dateCell, client, leadCell];
  });

  autoTable(doc, {
    startY: 28,
    head: [["Agent", "Property", "Inspection Date", "Client", "Lead / Closed"]],
    body: landscapeRows.length ? landscapeRows : [["—", "No bookings in filtered set", "—", "—", "—"]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 6.5, cellPadding: 2.5, lineColor: [227, 230, 225], textColor: [16, 35, 30], valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 38, halign: "left" },
      1: { cellWidth: 78, halign: "left" },
      2: { cellWidth: 42, halign: "center" },
      3: { cellWidth: 70, halign: "left" },
      4: { cellWidth: 39, halign: "center" },
    },
    alternateRowStyles: { fillColor: [247, 245, 238] },
    margin: { left: landscapeMargin, right: landscapeMargin, top: 6, bottom: 14 },
  });

  // Continue on portrait for remaining audit note and per-booking pages
  // Visitor analytics note (now after landscape sheet, on a fresh portrait page if needed)
  doc.addPage("a4", "portrait");
  perfY = 36;
  header();
  // Visitor analytics note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(101, 115, 110);
  const uniqueNote = `Visitor count = total bookings (${visitorCount}); Unique visitors by email = ${uniqueVisitorCount} (${uniquePhones.size} unique phones). Use this for company-wide funnel and capacity planning.`;
  doc.text(uniqueNote, margin, perfY, { maxWidth: pageW - margin * 2 });
  perfY += 8;

  // Add note about audit
  const afterSummaryY = perfY;
  doc.setFontSize(6.5);
  doc.setTextColor(101, 115, 110);
  doc.setFont("helvetica", "italic");
  doc.text("This report is an audit document. Historical rescheduling, agent changes, lead temperature changes, and internal notes are preserved per booking on following pages.", margin, afterSummaryY);

  // --- Per-booking detailed pages ---
  for (let idx = 0; idx < bookings.length; idx++) {
    const b: any = bookings[idx];
    doc.addPage();
    header();
    let yy = 36;

    // Booking header with badges
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(16, 35, 30);
    doc.text(b.ref, margin, yy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(101, 115, 110);
    doc.text(`${b.name}  •  ${b.email}`, margin, yy + 5);
    // Badges (simulate with filled rects)
    const badges = [
      { label: b.status.toUpperCase(), bg: b.status === "closed" ? [26, 26, 26] : b.status === "rescheduled" ? [91, 33, 182] : b.status === "active" ? [13, 51, 40] : [200, 160, 74] },
      { label: b.leadTemperature.toUpperCase(), bg: b.leadTemperature === "hot" ? [159, 18, 57] : b.leadTemperature === "warm" ? [146, 64, 14] : [75, 85, 99] },
    ];
    let bx = pageW - margin - 2;
    for (let i = badges.length - 1; i >= 0; i--) {
      const badge = badges[i];
      const w = doc.getTextWidth(badge.label) + 6;
      bx -= w + 2;
      doc.setFillColor(badge.bg[0], badge.bg[1], badge.bg[2]);
      doc.roundedRect(bx, yy - 4, w, 6, 1, 1, "F");
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(badge.label, bx + 3, yy - 0.5);
    }

    yy += 10;
    doc.setDrawColor(227, 230, 225);
    doc.setLineWidth(0.2);
    doc.line(margin, yy, pageW - margin, yy);
    yy += 6;

    // Booking sections — use autoTable for structured data
    const section = (title: string, rows: string[][], startY: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(13, 51, 40);
      doc.text(title.toUpperCase(), margin, startY);
      doc.setDrawColor(200, 160, 74);
      doc.setLineWidth(0.3);
      doc.line(margin, startY + 1, margin + 12, startY + 1);
      autoTable(doc, {
        startY: startY + 4,
        body: rows,
        theme: "plain",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, textColor: [16, 35, 30] },
        columnStyles: { 0: { cellWidth: 38, fontStyle: "bold", textColor: [101, 115, 110] }, 1: { cellWidth: pageW - margin * 2 - 38 } },
        margin: { left: margin, right: margin },
      });
      return (doc as any).lastAutoTable.finalY + 4;
    };

    yy = section("Customer", [
      ["Name", b.name],
      ["Email", b.email],
      ["Phone", b.phone ?? "—"],
      ["Booking Ref", b.ref],
    ], yy);

    yy = section("Property", [
      ["Estate / Location", b.location],
      ["Inspection Date", b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "—"],
      ["Inspection Time", b.preferredTime ?? "—"],
      ["Assigned Agent", b.agent ? `${b.agent.name} (${b.agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"})` : "Unassigned"],
      ["Visitor Agent Note", b.visitorAgentRaw ?? b.agentName ?? "—"],
    ], yy);

    yy = section("Booking", [
      ["Original Date", b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "—"],
      ["Original Time", b.preferredTime ?? "—"],
      ["Current Date", b.rescheduledDate ? new Date(b.rescheduledDate).toLocaleDateString("en-GB") : b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "—"],
      ["Current Time", b.rescheduledTime ?? b.preferredTime ?? "—"],
    ], yy);

    yy = section("Status", [
      ["Booking Status", b.status],
      ["Lead Temperature", b.leadTemperature],
      ["Lead Outcome", b.outcome ?? "—"],
      ["Assigned Agent", b.agent ? `${b.agent.name} <${b.agent.email}>` : "No agent assigned."],
    ], yy);

    // Rescheduling History
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(13, 51, 40);
    if (yy > 240) { doc.addPage(); header(); yy = 36; }
    doc.text("RESCHEDULING HISTORY", margin, yy);
    doc.setDrawColor(200, 160, 74);
    doc.line(margin, yy + 1, margin + 12, yy + 1);
    yy += 4;
    if (b.rescheduledDate) {
      const hist = b.activities?.filter((a: any) => a.action === "reschedule") ?? [];
      if (hist.length > 0) {
        const rows = hist.map((h: any) => [new Date(h.createdAt).toLocaleString("en-GB"), h.actorName, h.note ?? "Rescheduled"]);
        autoTable(doc, {
          startY: yy,
          head: [["Changed", "By", "Reason"]],
          body: rows,
          theme: "grid",
          styles: { fontSize: 6.5, cellPadding: 2, lineColor: [227, 230, 225] },
          headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
          margin: { left: margin, right: margin },
        });
        yy = (doc as any).lastAutoTable.finalY + 2;
        doc.setFontSize(6.5);
        doc.setTextColor(101, 115, 110);
        doc.text(`Original: ${new Date(b.preferredDate).toLocaleString("en-GB")} • ${b.preferredTime}  →  Rescheduled: ${new Date(b.rescheduledDate).toLocaleString("en-GB")} • ${b.rescheduledTime}`, margin, yy);
        yy += 4;
      } else {
        doc.setFontSize(7);
        doc.setTextColor(16, 35, 30);
        doc.text(`Original: ${new Date(b.preferredDate).toLocaleDateString("en-GB")} · ${b.preferredTime}`, margin, yy);
        yy += 4;
        doc.text(`Rescheduled: ${new Date(b.rescheduledDate).toLocaleDateString("en-GB")} · ${b.rescheduledTime}`, margin, yy);
        yy += 4;
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(101, 115, 110);
      doc.text("Booking has not been rescheduled.", margin, yy);
      yy += 6;
    }

    // Internal Notes
    if (yy > 250) { doc.addPage(); header(); yy = 36; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(13, 51, 40);
    doc.text("INTERNAL NOTES", margin, yy);
    doc.setDrawColor(200, 160, 74);
    doc.line(margin, yy + 1, margin + 12, yy + 1);
    yy += 4;
    const notes = b.internalNotes ?? [];
    if (notes.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(101, 115, 110);
      doc.text("No internal notes recorded.", margin, yy);
      yy += 6;
    } else {
      const noteRows = notes.map((n: any) => [new Date(n.createdAt).toLocaleString("en-GB"), n.authorName, n.body]);
      autoTable(doc, {
        startY: yy,
        head: [["Date", "Author", "Note"]],
        body: noteRows,
        theme: "grid",
        styles: { fontSize: 6.5, cellPadding: 2, lineColor: [227, 230, 225] },
        headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 28 }, 2: { cellWidth: pageW - margin * 2 - 56 } },
        margin: { left: margin, right: margin },
      });
      yy = (doc as any).lastAutoTable.finalY + 4;
    }

    // Activity History
    if (yy > 220) { doc.addPage(); header(); yy = 36; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(13, 51, 40);
    doc.text("ACTIVITY HISTORY", margin, yy);
    doc.setDrawColor(200, 160, 74);
    doc.line(margin, yy + 1, margin + 12, yy + 1);
    yy += 4;
    const acts = b.activities ?? [];
    const msgs = b.messages ?? [];
    const timeline = [
      ...acts.map((a: any) => ({ at: new Date(a.createdAt), type: "activity", data: a })),
      ...msgs.map((m: any) => ({ at: new Date(m.createdAt), type: "message", data: m })),
      ...notes.map((n: any) => ({ at: new Date(n.createdAt), type: "note", data: n })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    if (timeline.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(101, 115, 110);
      doc.text("No activity recorded.", margin, yy);
      yy += 6;
    } else {
      const histRows = timeline.map((e) => {
        const d = e.at.toLocaleString("en-GB");
        if (e.type === "activity") {
          const a: any = e.data;
          return [d, a.actorName, `${a.action} (${a.fromStatus} → ${a.toStatus})${a.note ? ` — ${a.note}` : ""}`];
        } else if (e.type === "message") {
          const m: any = e.data;
          return [d, m.authorName, `Message: ${m.message}`];
        } else {
          const n: any = e.data;
          return [d, n.authorName, `Note: ${n.body}`];
        }
      });
      autoTable(doc, {
        startY: yy,
        head: [["Date", "Actor", "Event"]],
        body: histRows,
        theme: "grid",
        styles: { fontSize: 6, cellPadding: 1.8, lineColor: [227, 230, 225] },
        headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 28 }, 2: { cellWidth: pageW - margin * 2 - 58 } },
        margin: { left: margin, right: margin },
      });
      yy = (doc as any).lastAutoTable.finalY + 4;
    }

    // Audit information
    if (yy > 260) { doc.addPage(); header(); yy = 36; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(13, 51, 40);
    doc.text("AUDIT", margin, yy);
    yy += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(101, 115, 110);
    const auditLines = [
      `Created: ${new Date(b.createdAt).toLocaleString("en-GB")}`,
      `Last updated: ${new Date(b.updatedAt).toLocaleString("en-GB")}${b.lockedAt ? `  •  Locked: ${new Date(b.lockedAt).toLocaleString("en-GB")}` : ""}`,
      `Status: ${b.status}  •  Lead: ${b.leadTemperature}  •  Outcome: ${b.outcome ?? "—"}`,
    ];
    auditLines.forEach((line) => {
      doc.text(line, margin, yy);
      yy += 3.5;
    });
  }

  footer();

  const filename = `belgrove-bookings-${new Date().toISOString().split("T")[0]}.pdf`;
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
