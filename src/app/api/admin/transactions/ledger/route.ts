import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Prisma } from "@/generated/prisma/client";
import { drawReportBanner } from "@/lib/documents/brand";

export const dynamic = "force-dynamic";

// Standard sales ledger, one section per client transaction:
// opening balance (total payable as debit), one row per CONFIRMED payment
// as credit with running balance, closing outstanding. Pending/voided
// payments never touch balances (same definition as the finance service).
// Capped at 500 transactions per export.
const LEDGER_CAP = 500;
const VALID_STATUSES = ["DRAFT", "ACTIVE", "PAID_IN_FULL", "CANCELLED"] as const;

const fmtNgn = (n: number) => `NGN ${n.toLocaleString("en-NG")}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const status = params.get("status") ?? "";
  const plan = params.get("plan") ?? "";
  const showTest = params.get("showTest") === "1";

  const where: Prisma.TransactionWhereInput = {};
  if (!showTest) where.isTest = false;
  if (status) {
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    where.status = status as (typeof VALID_STATUSES)[number];
  }
  if (plan) where.paymentPlanId = plan;
  if (q) {
    where.OR = [
      { ref: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { estate: { contains: q, mode: "insensitive" } },
      { plotCode: { contains: q, mode: "insensitive" } },
    ];
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ customerName: "asc" }, { createdAt: "asc" }],
    take: LEDGER_CAP,
    include: {
      paymentPlan: { select: { name: true } },
      payments: {
        select: { id: true, amount: true, paymentDate: true, paymentMethod: true, paymentReference: true, status: true },
        orderBy: { paymentDate: "asc" },
      },
      receipts: { select: { paymentId: true, ref: true } },
    },
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 14;

  drawReportBanner(doc, {
    title: "Belgrove Homes",
    subtitle: "Client Sales Ledger — Transactions & Balances",
    meta: `Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}  •  ${transactions.length} transaction(s)`,
    margin,
  });
  let y = 36 + 2;

  const receiptByPayment = new Map<string, string>();
  for (const t of transactions) for (const r of t.receipts) if (r.paymentId) receiptByPayment.set(r.paymentId, r.ref);

  for (const t of transactions) {
    if (y > 232) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(16, 35, 30);
    doc.text(`${t.customerName} — ${t.ref}`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(101, 115, 110);
    const sub = `${t.estate}${t.plotCode ? ` · ${t.plotCode}` : ""} · ${t.paymentPlan?.name ?? "Plan"} · ${t.status.replace("_", " ")}`;
    doc.text(sub, margin, y + 4);
    y += 8;

    const confirmed = t.payments.filter((p) => p.status === "CONFIRMED");
    const pendingCount = t.payments.filter((p) => p.status === "PENDING_VERIFICATION").length;
    let running = t.totalPayable;
    const body: (string | number)[][] = [
      [fmtDate(new Date(t.createdAt)), `Opening balance — total payable (${t.ref})`, t.ref, fmtNgn(t.totalPayable), "-", fmtNgn(running)],
    ];
    for (const p of confirmed) {
      running -= p.amount;
      const rct = receiptByPayment.get(p.id);
      body.push([
        fmtDate(new Date(p.paymentDate)),
        `Payment — ${p.paymentMethod ?? "Bank Transfer"}${rct ? ` (Receipt ${rct})` : ""}`,
        p.paymentReference,
        "-",
        fmtNgn(p.amount),
        fmtNgn(running),
      ]);
    }
    const paid = t.totalPayable - running;
    body.push(["", "Total", "", fmtNgn(t.totalPayable), fmtNgn(paid), fmtNgn(running)]);

    autoTable(doc, {
      startY: y,
      head: [["Date", "Particulars", "Ref", "Debit", "Credit", "Balance"]],
      body,
      theme: "grid",
      styles: { fontSize: 6.5, cellPadding: 1.8, lineColor: [227, 230, 225] },
      headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: pageW - margin * 2 - 22 - 26 - 26 - 26 - 24 },
        2: { cellWidth: 26 },
        3: { cellWidth: 26, halign: "right" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 24, halign: "right" },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
    if (pendingCount > 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(150, 120, 40);
      doc.text(`${pendingCount} pending payment(s) awaiting verification — excluded from balances.`, margin, y);
      y += 4;
    }
    y += 5;
  }

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(6);
    doc.setTextColor(120, 130, 125);
    doc.setFont("helvetica", "normal");
    const footerText = `Belgrove Homes  •  Client Sales Ledger  •  info@belgrovehomes.com  •  Page ${i} of ${pageCount}`;
    doc.text(footerText, (w - doc.getTextWidth(footerText)) / 2, h - 6);
    doc.setDrawColor(227, 230, 225);
    doc.setLineWidth(0.2);
    doc.line(10, h - 10, w - 10, h - 10);
  }

  const filename = `belgrove-ledger-${new Date().toISOString().split("T")[0]}.pdf`;
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
