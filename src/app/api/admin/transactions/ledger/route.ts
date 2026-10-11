import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Prisma } from "@/generated/prisma/client";
import { drawReportBanner } from "@/lib/documents/brand";
import { wrapLongWords, TABLE_OVERFLOW_LINEBREAK } from "@/lib/documents/exportTables";
import { formatLagos, lagosDayKey, lagosToUtc } from "@/lib/time";

export const dynamic = "force-dynamic";

// Company-wide chronological sales ledger: ONE table across all
// transactions, oldest first — not grouped or filtered per customer.
// Columns: Date | TXN Number | Client Name | Property | Ref Number |
// Debit | Credit | Installment Balance | Company Balance.
//
// - Debit rows book what became payable (the sale, dated at creation).
// - Credit rows book CONFIRMED payments only (dated at paymentDate, never
//   recorded/pending dates). Pending/voided payments never touch balances.
// - Installment Balance = what remains on THAT transaction after the row.
// - Company Balance = running total of outstanding receivables after the row.
// - The opening row carries the balance brought forward before the period
//   (zero when exporting everything) and always sorts first — it is dated
//   at the period start, never at a transaction creation date, so a backdated
//   payment can no longer print above it.
// - Ties break by record creation timestamp, then debit-before-credit.
// - Closing company balance equals the sum of all transaction outstanding
//   amounts whenever the export is unfiltered (no date range).
// Capped at 500 transactions per export.
const LEDGER_CAP = 500;
const VALID_STATUSES = ["DRAFT", "ACTIVE", "PAID_IN_FULL", "CANCELLED"] as const;

// Landscape A4 geometry: fixed column widths derived from percentages of the
// printable area, so the table is exactly 100% wide — never clipping, never
// short. Exported for the geometric test (widths must sum to usable width).
export const LEDGER_PAGE_W_MM = 297;
export const LEDGER_MARGIN_MM = 10;
export const LEDGER_COLUMN_PCTS = [8, 11, 13, 18, 14, 9, 9, 9, 9];
export function ledgerColumnWidthsMm(): number[] {
  const usable = LEDGER_PAGE_W_MM - LEDGER_MARGIN_MM * 2;
  const widths = LEDGER_COLUMN_PCTS.map((p) => Math.floor(((usable * p) / 100) * 100) / 100);
  // Absorb rounding drift in the last column so the sum is exact.
  widths[widths.length - 1] += Math.round((usable - widths.reduce((a, b) => a + b, 0)) * 100) / 100;
  return widths;
}

// Non-breaking space between code and figure: money cells are single tokens
// ("NGN 19,400,000" ≈ 16.5mm in a ~25mm column) so autotable can never wrap
// or clip a figure mid-number. \u00A0 is WinAnsi-safe for jsPDF.
const fmtNgn = (n: number) => `NGN${String.fromCharCode(160)}${n.toLocaleString("en-NG")}`;
// Lagos calendar dates — never server-local (a UTC-midnight instant is still
// "yesterday" in US timezones, which misdates rows and the opening balance).
const fmtDate = (d: Date) => formatLagos(d, "date");

type LedgerEvent =
  | {
      kind: "debit";
      id: string;
      date: Date;
      dayKey: string;
      createdAt: Date;
      txnId: string;
      amount: number;
    }
  | {
      kind: "credit";
      id: string;
      date: Date;
      dayKey: string;
      createdAt: Date;
      txnId: string;
      amount: number;
      paymentRef: string;
      receiptRef: string | null;
    };

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const status = params.get("status") ?? "";
  const plan = params.get("plan") ?? "";
  const fromStr = params.get("from")?.trim() ?? "";
  const toStr = params.get("to")?.trim() ?? "";
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

  // Date range applies to ROW dates (sale / payment dates), Lagos calendar
  // days. Rows before the range compress into the opening balance.
  let periodStart: Date | null = null;
  let periodEndExcl: Date | null = null;
  try {
    if (fromStr) periodStart = lagosToUtc(fromStr);
    if (toStr) periodEndExcl = new Date(lagosToUtc(toStr).getTime() + 86400000);
  } catch {
    return NextResponse.json({ error: "Invalid from/to date (use YYYY-MM-DD)" }, { status: 400 });
  }
  if (periodStart && periodEndExcl && periodEndExcl <= periodStart) {
    return NextResponse.json({ error: "Invalid date range: to must be after from" }, { status: 400 });
  }
  const inPeriod = (d: Date) =>
    (!periodStart || d >= periodStart) && (!periodEndExcl || d < periodEndExcl);

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: LEDGER_CAP,
    include: {
      paymentPlan: { select: { name: true } },
      payments: {
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          createdAt: true,
          paymentMethod: true,
          paymentReference: true,
          status: true,
        },
        orderBy: { paymentDate: "asc" },
      },
      receipts: { select: { paymentId: true, ref: true } },
    },
  });

  const byId = new Map(transactions.map((t) => [t.id, t]));
  const receiptByPayment = new Map<string, string>();
  for (const t of transactions) for (const r of t.receipts) if (r.paymentId) receiptByPayment.set(r.paymentId, r.ref);

  const events: LedgerEvent[] = [];
  for (const t of transactions) {
    const createdAt = new Date(t.createdAt);
    events.push({
      kind: "debit",
      id: `${t.id}:debit`,
      date: createdAt,
      dayKey: lagosDayKey(createdAt),
      createdAt,
      txnId: t.id,
      amount: t.totalPayable,
    });
    for (const p of t.payments) {
      if (p.status !== "CONFIRMED") continue;
      const date = new Date(p.paymentDate);
      events.push({
        kind: "credit",
        id: p.id,
        date,
        dayKey: lagosDayKey(date),
        createdAt: p.createdAt ? new Date(p.createdAt) : date,
        txnId: t.id,
        amount: p.amount,
        paymentRef: p.paymentReference,
        receiptRef: receiptByPayment.get(p.id) ?? null,
      });
    }
  }
  // Chronological by calendar day (Lagos, matching the displayed dates),
  // oldest first. Within one day the charge always prints before any
  // payment — a paymentDate at 00:00 must never sort above the same-day
  // sale created at 11:15. Remaining ties break by full timestamp, then
  // record creation, then id (fully deterministic).
  const kindOrder = (e: LedgerEvent) => (e.kind === "debit" ? 0 : 1);
  events.sort(
    (a, b) =>
      (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0) ||
      kindOrder(a) - kindOrder(b) ||
      a.date.getTime() - b.date.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  // Brought-forward opening: everything dated before the period. Unfiltered
  // exports have no "before", so the opening row is zero by construction.
  let opening = 0;
  const paidBefore = new Map<string, number>();
  for (const e of events) {
    if (periodStart && e.date < periodStart) {
      if (e.kind === "debit") opening += e.amount;
      else {
        opening -= e.amount;
        paidBefore.set(e.txnId, (paidBefore.get(e.txnId) ?? 0) + e.amount);
      }
    }
  }
  const rows = events.filter((e) => inPeriod(e.date));

  let companyBalance = opening;
  let totalDebit = 0;
  let totalCredit = 0;
  const paidSoFar = new Map<string, number>(paidBefore);
  const body: (string | { content: string; colSpan: number })[][] = [];
  // Opening row first: one label spanning Date through Ref Number, with the
  // brought-forward amount in the Company Balance column (NGN 0 when
  // exporting everything). Never dated at a transaction date, so it cannot
  // sort after a backdated payment.
  body.push([
    { content: "Opening balance, balance brought forward", colSpan: 5 },
    "-",
    "-",
    "-",
    fmtNgn(opening),
  ]);
  for (const e of rows) {
    const t = byId.get(e.txnId);
    if (!t) continue;
    const property = `${t.estate}${t.plotCode ? ` · ${t.plotCode}` : ""}${t.unitType ? ` · ${t.unitType}` : ""}`;
    if (e.kind === "debit") {
      companyBalance += e.amount;
      totalDebit += e.amount;
      const instBal = t.totalPayable - (paidSoFar.get(t.id) ?? 0);
      body.push([
        fmtDate(e.date),
        wrapLongWords(t.ref, 20),
        wrapLongWords(t.customerName),
        wrapLongWords(property),
        wrapLongWords(t.ref, 20),
        fmtNgn(e.amount),
        "-",
        fmtNgn(instBal),
        fmtNgn(companyBalance),
      ]);
    } else {
      companyBalance -= e.amount;
      totalCredit += e.amount;
      const paid = (paidSoFar.get(t.id) ?? 0) + e.amount;
      paidSoFar.set(t.id, paid);
      const refCell = e.receiptRef ? `${e.paymentRef} · ${e.receiptRef}` : e.paymentRef;
      body.push([
        fmtDate(e.date),
        wrapLongWords(t.ref, 20),
        wrapLongWords(t.customerName),
        wrapLongWords(property),
        wrapLongWords(refCell, 20),
        "-",
        fmtNgn(e.amount),
        fmtNgn(t.totalPayable - paid),
        fmtNgn(companyBalance),
      ]);
    }
  }
  const closing = companyBalance;

  // Landscape A4 (297mm): fixed widths sum to exactly the usable width, so
  // no column can clip off the edge; long names wrap via wrapLongWords +
  // linebreak overflow instead of running past their border.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 10;
  // Landscape A4 is 297mm wide: fixed column widths below sum to exactly the
  // usable width (277mm).

  const filters: string[] = [];
  if (status) filters.push(`Status: ${status}`);
  if (plan) filters.push(`Plan: ${plan}`);
  if (q) filters.push(`Search: ${q}`);
  if (fromStr || toStr) filters.push(`Period: ${fromStr || "…"} to ${toStr || "…"}`);
  drawReportBanner(doc, {
    title: "Belgrove Homes",
    subtitle: "Company Sales Ledger — Chronological",
    meta: `Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}  •  ${transactions.length} transaction(s)  •  ${rows.length} row(s)${filters.length ? `  •  ${filters.join("  •  ")}` : ""}  •  Confirmed payments only`,
    margin,
  });

  // Percentage widths (Date 8, TXN 11, Client 13, Property 18, Ref 14,
  // Debit/Credit/InstBal/CoBal 9 each) resolved to mm: the table is exactly
  // 100% of the printable area. Money cells hold single nbsp-joined tokens
  // that fit their ~25mm columns, so figures never wrap or clip; text cells
  // wrap. Header repeats every page; rows never split across pages.
  const colW = ledgerColumnWidthsMm();
  autoTable(doc, {
    startY: 36,
    head: [["Date", "TXN Number", "Client Name", "Property", "Ref Number", "Debit", "Credit", "Installment Balance", "Company Balance"]],
    body,
    foot: [["Totals", "", "", "", "", fmtNgn(totalDebit), fmtNgn(totalCredit), "", fmtNgn(closing)]],
    showFoot: "lastPage",
    theme: "grid",
    styles: { font: "helvetica", fontSize: 6.5, cellPadding: 2, lineColor: [227, 230, 225], textColor: [16, 35, 30], overflow: TABLE_OVERFLOW_LINEBREAK },
    headStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [13, 51, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: colW[0] },
      1: { cellWidth: colW[1] },
      2: { cellWidth: colW[2] },
      3: { cellWidth: colW[3] },
      4: { cellWidth: colW[4] },
      5: { cellWidth: colW[5], halign: "right" },
      6: { cellWidth: colW[6], halign: "right" },
      7: { cellWidth: colW[7], halign: "right" },
      8: { cellWidth: colW[8], halign: "right" },
    },
    rowPageBreak: "avoid",
    margin: { left: margin, right: margin, top: 6, bottom: 14 },
  });

  let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  const pendingCount = transactions.flatMap((t) => t.payments).filter((p) => p.status === "PENDING_VERIFICATION").length;
  if (pendingCount > 0) {
    doc.setFontSize(6.5);
    doc.setTextColor(150, 120, 40);
    doc.text(`${pendingCount} pending payment(s) awaiting verification — excluded from balances.`, margin, y);
    y += 4;
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
    const footerText = `Belgrove Homes  •  Company Sales Ledger  •  info@belgrovehomes.com  •  Page ${i} of ${pageCount}`;
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
