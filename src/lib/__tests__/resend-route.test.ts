import { describe, it, expect, vi, beforeEach } from "vitest";

// POST /api/admin/receipts/[id]/resend: direct Resend send with strict key
// rules — fresh key per click, same key on timeout retry, never a failure
// write that could overwrite a prior success.

const renderMock = vi.fn<(id: string, opts?: { force?: boolean }) => Promise<Buffer>>();
const sendMock = vi.fn<(opts: Record<string, unknown>) => Promise<{ sent: boolean; error: string | null; providerMessageId?: string | null }>>();
const receiptUpdateMock = vi.fn<(args: unknown) => Promise<unknown>>();
const auditCreateMock = vi.fn<(args: unknown) => Promise<unknown>>();

type FixtureReceipt = {
  id: string;
  ref: string;
  recipientEmail: string;
  customerName: string;
  receiptUrl: string;
  plotQuantity: number | null;
  sqm: number | null;
  pdfData: Buffer | null;
  payment: { id: string } | null;
  transaction: { totalPayable: number; payments: { amount: number }[] } | null;
};

let receiptRow: FixtureReceipt | null;

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", name: "Admin", email: "admin@x.com", role: "admin" } }),
}));

vi.mock("@/lib/receipt-render", () => ({
  renderReceiptPdfBuffer: (id: string, opts?: { force?: boolean }) => renderMock(id, opts),
}));

vi.mock("@/lib/receipts/emailReceipt", () => ({
  sendReceiptEmail: (opts: Record<string, unknown>) => sendMock(opts),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    receipt: {
      findUnique: async () => receiptRow,
      update: (args: unknown) => receiptUpdateMock(args),
    },
    auditEvent: {
      create: (args: unknown) => auditCreateMock(args),
    },
  },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/receipts/[id]/resend/route";

function seedReceipt(pdfData: Buffer | null) {
  receiptRow = {
    id: "rcpt-1",
    ref: "RCT-2026-00001",
    recipientEmail: "client@x.com",
    customerName: "Test Client",
    receiptUrl: "https://www.belgrovehomes.com/r/tok",
    plotQuantity: 1,
    sqm: 250,
    pdfData,
    payment: { id: "pay-1" },
    transaction: { totalPayable: 9_700_000, payments: [{ amount: 9_700_000 }] },
  };
}

function resendRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/receipts/rcpt-1/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const ctx = { params: Promise.resolve({ id: "rcpt-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  seedReceipt(Buffer.from("stored-confirmation-bytes"));
  sendMock.mockResolvedValue({ sent: true, error: null, providerMessageId: "msg-1" });
  renderMock.mockResolvedValue(Buffer.from("fresh-render-bytes"));
  receiptUpdateMock.mockResolvedValue({});
  auditCreateMock.mockResolvedValue({});
});

describe("POST resend", () => {
  it("reuses stored PDF bytes and records only resendEmailId + sentAt", async () => {
    const res = await POST(resendRequest({}), ctx);
    expect(res.status).toBe(200);
    expect(renderMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledOnce();
    const emailOpts = sendMock.mock.calls[0][0] as { pdfBuffer: Buffer; idempotencyKey: string };
    expect(emailOpts.pdfBuffer.equals(Buffer.from("stored-confirmation-bytes"))).toBe(true);
    // Fresh key per user-initiated resend.
    expect(emailOpts.idempotencyKey).toMatch(/^resend:rcpt-1:[0-9a-f-]{36}$/);
    expect(receiptUpdateMock).toHaveBeenCalledWith({
      where: { id: "rcpt-1" },
      data: { resendEmailId: "msg-1", sentAt: expect.any(Date) },
    });
    const body = await res.json();
    expect(body).toMatchObject({ resent: true, resendEmailId: "msg-1" });
  });

  it("reuses a client-provided key on timeout retry (same key, same body)", async () => {
    const res = await POST(resendRequest({ idempotencyKey: "resend:rcpt-1:retry-key-1" }), ctx);
    expect(res.status).toBe(200);
    const emailOpts = sendMock.mock.calls[0][0] as { idempotencyKey: string };
    expect(emailOpts.idempotencyKey).toBe("resend:rcpt-1:retry-key-1");
  });

  it("returns 503 with the same key on timeout — never a new key, never a failure write", async () => {
    sendMock.mockResolvedValue({ sent: false, error: "Resend request timed out after 30012ms" });
    const res = await POST(resendRequest({}), ctx);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.retryable).toBe(true);
    expect(typeof body.idempotencyKey).toBe("string");
    // The receipt row is untouched: no FAILED mark, prior proof preserved.
    expect(receiptUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 409 when Resend reports key reuse with a different body", async () => {
    sendMock.mockResolvedValue({ sent: false, error: "Resend error 409: body modified" });
    const res = await POST(resendRequest({}), ctx);
    expect(res.status).toBe(409);
    expect(receiptUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 502 on other failures without touching the receipt row", async () => {
    sendMock.mockResolvedValue({ sent: false, error: "Resend error 500: busy" });
    const res = await POST(resendRequest({}), ctx);
    expect(res.status).toBe(502);
    expect(receiptUpdateMock).not.toHaveBeenCalled();
  });

  it("renders and stores the PDF only when bytes are missing or regen is set", async () => {
    seedReceipt(null);
    const res = await POST(resendRequest({ regen: true }), ctx);
    expect(res.status).toBe(200);
    expect(renderMock).toHaveBeenCalledWith("rcpt-1", { force: true });
    const body = await res.json();
    expect(body.regenerated).toBe(true);
  });

  it("404s on unknown receipts", async () => {
    receiptRow = null;
    const res = await POST(resendRequest({}), ctx);
    expect(res.status).toBe(404);
  });
});
