import { describe, it, expect, vi } from "vitest";

// The outbox row id must ride every provider call as its idempotency key.
vi.mock("../email/sendEmail", () => ({
  sendEmail: vi.fn(async () => ({ sent: true, error: null })),
}));

import { sendEmail } from "../email/sendEmail";
import { sendBookingReceived } from "../email/emailService";
import { sendReceiptEmail } from "../receipts/emailReceipt";

const mockedSendEmail = vi.mocked(sendEmail);

describe("idempotency key threading", () => {
  it("an emailService function forwards the key to sendEmail", async () => {
    await sendBookingReceived(
      "c@x.com",
      { name: "Ada", ref: "BKG-1", preferredDate: new Date(), preferredTime: "10:00 AM", location: "Kado" },
      { idempotencyKey: "row-3" }
    );
    expect(mockedSendEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "row-3" }));
  });

  it("the receipt path forwards the key and keeps attachments", async () => {
    await sendReceiptEmail({
      to: "c@x.com",
      clientName: "Ada",
      ref: "RCT-1",
      receiptUrl: "https://x/r",
      pdfBuffer: Buffer.from("pdf"),
      idempotencyKey: "row-4",
    });
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "row-4",
        attachments: expect.arrayContaining([expect.objectContaining({ filename: "Belgrove-Receipt-RCT-1.pdf" })]),
      })
    );
  });

  it("works without a key (direct callers unaffected)", async () => {
    await sendBookingReceived("c@x.com", {
      name: "Ada",
      ref: "BKG-1",
      preferredDate: new Date(),
      preferredTime: "10:00 AM",
      location: "Kado",
    });
    expect(mockedSendEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: undefined }));
  });
});
