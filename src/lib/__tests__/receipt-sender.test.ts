import { describe, it, expect, vi, beforeEach } from "vitest";

const renderMock = vi.fn<(id: string, opts?: { force?: boolean }) => Promise<Buffer>>();
const sendMock = vi.fn<(opts: unknown) => Promise<{ sent: boolean; error: string | null }>>();
const receiptUpdateMock = vi.fn<(args: unknown) => Promise<unknown>>();
const sendAttemptCreateMock = vi.fn<(args: unknown) => Promise<unknown>>();
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
  payment: null;
  transaction: { totalPayable: number; payments: { id: string; amount: number; paymentDate: Date }[] };
};

let receiptRow: FixtureReceipt | undefined;

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
    receiptSendAttempt: {
      create: (args: unknown) => sendAttemptCreateMock(args),
    },
    auditEvent: {
      create: (args: unknown) => auditCreateMock(args),
    },
  },
}));

import { sendReceiptForOutbox } from "../email/receiptOutboxSender";

function seedReceipt(pdfData: Buffer | null) {
  receiptRow = {
    id: "rcpt-1",
    ref: "RCT-2026-00001",
    recipientEmail: "client@x.com",
    customerName: "Test Client",
    receiptUrl: "https://example.com/r/tok",
    plotQuantity: 1,
    sqm: 250,
    pdfData,
    payment: null,
    transaction: { totalPayable: 9_700_000, payments: [{ id: "p1", amount: 9_700_000, paymentDate: new Date() }] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ sent: true, error: null });
  renderMock.mockResolvedValue(Buffer.from("fresh-render-bytes"));
});

describe("sendReceiptForOutbox stored bytes", () => {
  it("reuses stored confirmation bytes without re-rendering (plain resend)", async () => {
    seedReceipt(Buffer.from("stored-confirmation-bytes"));
    const result = await sendReceiptForOutbox("rcpt-1", "row-1");

    expect(result.sent).toBe(true);
    expect(renderMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledOnce();
    const emailOpts = sendMock.mock.calls[0][0] as { pdfBuffer: Buffer };
    expect(emailOpts.pdfBuffer.equals(Buffer.from("stored-confirmation-bytes"))).toBe(true);
  });

  it("falls back to a snapshot render only when no bytes are stored", async () => {
    seedReceipt(null);
    const result = await sendReceiptForOutbox("rcpt-1", "row-1");

    expect(result.sent).toBe(true);
    expect(renderMock).toHaveBeenCalledOnce();
    // Fresh render is stored for next time.
    expect(receiptUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pdfStatus: "GENERATED" }) })
    );
  });

  it("explicit regenerate rebuilds from the snapshot and stores", async () => {
    seedReceipt(Buffer.from("stored-confirmation-bytes"));
    const result = await sendReceiptForOutbox("rcpt-1", "row-1", { regen: true });

    expect(result.sent).toBe(true);
    expect(renderMock).toHaveBeenCalledOnce();
    const emailOpts = sendMock.mock.calls[0][0] as { pdfBuffer: Buffer };
    expect(emailOpts.pdfBuffer.equals(Buffer.from("fresh-render-bytes"))).toBe(true);
  });
});
