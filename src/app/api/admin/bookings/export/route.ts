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
  const missingAgent = params.get("missingAgent");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  if (status && (allStatuses as readonly string[]).includes(status)) {
    where.status = status as BookingStatus;
  }
  if (leadTemperature && (allTemperatures as readonly string[]).includes(leadTemperature)) {
    where.leadTemperature = leadTemperature as LeadTemperature;
  }
  if (missingAgent === "1") where.agentId = null;
  else if (agent) {
    where.OR = [
      { agentName: { contains: agent, mode: "insensitive" } },
      { agent: { name: { contains: agent, mode: "insensitive" } } },
      { agent: { email: { contains: agent, mode: "insensitive" } } },
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
    include: { assignedToUser: true, reviewedByUser: true, agent: true },
  });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Header Belgrove Homes
  doc.setFillColor(31, 51, 40); // #1F3328 forest-900
  doc.rect(0, 0, 297, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(199, 154, 70); // #C79A46 gold
  doc.text("Belgrove Homes", 14, 12);
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text("Inspection Bookings Export", 14, 18);
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}  •  ${bookings.length} record(s)`, 14, 23);

  // Filters summary if any
  const filters: string[] = [];
  if (status) filters.push(`Status: ${status}`);
  if (leadTemperature) filters.push(`Lead: ${leadTemperature}`);
  if (missingAgent === "1") filters.push("Missing agent");
  if (agent) filters.push(`Agent: ${agent}`);
  if (from || to) filters.push(`Date: ${from ? from.toISOString().split("T")[0] : "…"} to ${to ? to.toISOString().split("T")[0] : "…"}`);
  if (filters.length) {
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.text(`Filters ${filters.join("  •  ")}`, 14, 33);
  }

  const head = [["Ref", "Name", "Email", "Date", "Time", "Location", "Company Agent", "Status", "Lead", "Outcome"]];

  const body = bookings.map((b) => [
    b.ref,
    b.name,
    b.email,
    b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "",
    b.preferredTime,
    b.location.length > 28 ? b.location.slice(0, 28) + "…" : b.location,
    b.agent?.name ?? b.agentName ?? "",
    b.status,
    b.leadTemperature,
    b.outcome ?? "",
  ]);

  autoTable(doc, {
    startY: filters.length ? 36 : 32,
    head,
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, lineColor: [224, 213, 187], lineWidth: 0.2 },
    headStyles: { fillColor: [31, 51, 40], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 26 },
      2: { cellWidth: 32 },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 32 },
      6: { cellWidth: 24 },
      7: { cellWidth: 16, halign: "center" },
      8: { cellWidth: 12, halign: "center" },
      9: { cellWidth: 16, halign: "center" },
    },
    alternateRowStyles: { fillColor: [247, 242, 231] },
    margin: { left: 7, right: 7, top: 10, bottom: 12 },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(6);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${data.pageNumber} of ${pageCount}  •  Belgrove Homes • Suite 25, Lebrex Plaza, 47 Ajose Adeogun Street, Utako, Abuja • info@belgrovehomes.com • +234 810 376 0063`, 14, 200);
    },
  });

  const filename = `belgrove-bookings-${new Date().toISOString().split("T")[0]}.pdf`;
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
