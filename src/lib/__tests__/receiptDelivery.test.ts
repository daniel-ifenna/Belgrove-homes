import { describe, it, expect, vi } from "vitest";
import { generateAndStoreReceiptPdf, deliverReceiptEmail } from "../receiptDelivery";

function mockDb() {
  const update = vi.fn(async () => ({}));
  return { db: { receipt: { update } }, update };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("generateAndStoreReceiptPdf", () => {
  it("succeeds with a slow renderer (the >5s case that used to kill the transaction)", async () => {
    const { db, update } = mockDb();
    const render = vi.fn(async () => {
      await sleep(300); // stands in for a multi-second PDF render
      return Buffer.from("pdf-bytes");
    });

    const result = await generateAndStoreReceiptPdf({
      db,
      receiptId: "rcpt-1",
      ref: "BEL-2026-00001",
      render,
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBe(null);
    expect(result.bytes).toBeInstanceOf(Buffer);
    expect(render).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      where: { id: "rcpt-1" },
      data: { pdfStatus: "GENERATED", lastError: null, pdfData: expect.any(Buffer) },
    });
  });

  it("PDF render failure leaves the payment confirmed and marks pdfStatus FAILED without throwing", async () => {
    const { db, update } = mockDb();

    const result = await generateAndStoreReceiptPdf({
      db,
      receiptId: "rcpt-1",
      ref: "BEL-2026-00001",
      render: async () => {
        throw new Error("font subset missing");
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("font subset missing");
    expect(update).toHaveBeenCalledWith({
      where: { id: "rcpt-1" },
      data: { pdfStatus: "FAILED", lastError: "font subset missing" },
    });
  });

  it("optional legacy store failure is recorded, not thrown", async () => {
    const { db, update } = mockDb();

    const result = await generateAndStoreReceiptPdf({
      db,
      receiptId: "rcpt-1",
      ref: "BEL-2026-00001",
      pdfPath: "storage/receipts/BEL-2026-00001.pdf",
      render: async () => Buffer.from("pdf-bytes"),
      writeFile: async () => {
        throw new Error("ENOSPC: no space left on device /tmp/x.pdf");
      },
    });

    expect(result.ok).toBe(false);
    expect(update).toHaveBeenCalledWith({
      where: { id: "rcpt-1" },
      data: { pdfStatus: "FAILED", lastError: expect.stringContaining("ENOSPC") },
    });
  });

  it("never throws even when the bookkeeping write itself fails", async () => {
    const db = { receipt: { update: vi.fn(async () => { throw new Error("db down"); }) } };

    const result = await generateAndStoreReceiptPdf({
      db,
      receiptId: "rcpt-1",
      ref: "BEL-2026-00001",
      render: async () => Buffer.from("pdf-bytes"),
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBe(null);
    expect(result.bytes).toBeInstanceOf(Buffer);
  });
});

describe("deliverReceiptEmail", () => {
  it("marks SENT with sentAt on success", async () => {
    const { db, update } = mockDb();
    const send = vi.fn(async () => ({ sent: true as const, error: null as string | null }));

    const result = await deliverReceiptEmail({ db, receiptId: "rcpt-1", ref: "BEL-2026-00001", send });

    expect(result.sent).toBe(true);
    expect(result.error).toBe(null);
    expect(update).toHaveBeenCalledWith({
      where: { id: "rcpt-1" },
      data: {
        emailStatus: "SENT",
        sentAt: expect.any(Date),
        lastError: null,
        status: "sent",
        error: null,
      },
    });
  });

  it("marks FAILED with lastError when sending fails or throws", async () => {
    const { db, update } = mockDb();

    const failed = await deliverReceiptEmail({
      db,
      receiptId: "rcpt-1",
      ref: "BEL-2026-00001",
      send: async () => ({ sent: false as const, error: "SMTP 550 mailbox unavailable" }),
    });
    expect(failed.sent).toBe(false);
    expect(failed.error).toBe("SMTP 550 mailbox unavailable");

    const threw = await deliverReceiptEmail({
      db,
      receiptId: "rcpt-1",
      ref: "BEL-2026-00001",
      send: async () => {
        throw new Error("socket hang up");
      },
    });
    expect(threw.sent).toBe(false);
    expect(threw.error).toBe("socket hang up");

    expect(update).toHaveBeenCalledWith({
      where: { id: "rcpt-1" },
      data: {
        emailStatus: "FAILED",
        sentAt: undefined,
        lastError: "socket hang up",
        status: "failed",
        error: "socket hang up",
      },
    });
  });
});
