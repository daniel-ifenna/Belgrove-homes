import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getEmailProvider,
  htmlToText,
  sendViaResend,
  RESEND_TIMEOUT_MS,
} from "../email/resendProvider";
import { sendEmail } from "../email/sendEmail";

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("getEmailProvider", () => {
  it("defaults to smtp until explicitly flipped to resend", () => {
    vi.stubEnv("EMAIL_PROVIDER", "");
    expect(getEmailProvider()).toBe("smtp");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    expect(getEmailProvider()).toBe("resend");
    vi.stubEnv("EMAIL_PROVIDER", "carrier-pigeon");
    expect(getEmailProvider()).toBe("smtp");
    vi.unstubAllEnvs();
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToText("<p>Hi Ada,</p><p>Ref &amp; <strong>BKG-1</strong></p>")).toBe("Hi Ada,\nRef & BKG-1");
  });
});

describe("sendViaResend", () => {
  const ENV = { RESEND_API_KEY: "re_test_key", SMTP_FROM: "Belgrove Homes <info@belgrovehomes.com>" };

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", ENV.RESEND_API_KEY);
    vi.stubEnv("SMTP_FROM", ENV.SMTP_FROM);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends via the Resend API with the row id as Idempotency-Key", async () => {
    const seen: { url: unknown; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      (async (url: unknown, init: RequestInit) => {
        seen.push({ url, init });
        return jsonResponse(200, { id: "email-id-1" });
      }) as typeof fetch
    );
    const pdf = Buffer.from("%PDF-binary");
    const res = await sendViaResend({
      to: ["Client@X.com "],
      subject: "Your receipt",
      html: "<p>Hi</p>",
      attachments: [{ filename: "r.pdf", content: pdf, contentType: "application/pdf" }],
      idempotencyKey: "out-row-1",
    });
    expect(res).toEqual({ sent: true, error: null, provider: "resend", providerMessageId: "email-id-1" });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://api.resend.com/emails");
    const headers = new Headers(seen[0].init.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${ENV.RESEND_API_KEY}`);
    expect(headers.get("Idempotency-Key")).toBe("out-row-1");
    const body = JSON.parse(seen[0].init.body as string);
    expect(body.from).toBe(ENV.SMTP_FROM);
    expect(body.to).toEqual(["Client@X.com"]);
    expect(body.subject).toBe("Your receipt");
    expect(body.html).toBe("<p>Hi</p>");
    expect(typeof body.text).toBe("string");
    expect(body.attachments).toEqual([
      { filename: "r.pdf", content: pdf.toString("base64"), content_type: "application/pdf" },
    ]);
  });

  it("maps CID attachments to content_id for inline logos", async () => {
    vi.stubGlobal("fetch", (async () => jsonResponse(200, { id: "x" })) as typeof fetch);
    const seen: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      (async (_url: unknown, init: RequestInit) => {
        seen.push(init);
        return jsonResponse(200, { id: "x" });
      }) as typeof fetch
    );
    await sendViaResend({
      to: "a@x.com",
      subject: "s",
      html: "<p>x</p>",
      attachments: [{ filename: "logo.png", content: Buffer.from("img"), contentType: "image/png", cid: "logo@belgrove" }],
    });
    const body = JSON.parse(seen[0].body as string);
    expect(body.attachments[0].content_id).toBe("logo@belgrove");
  });

  it("treats 429 and 5xx as retryable (no permanent flag)", async () => {
    for (const status of [429, 500, 503]) {
      vi.stubGlobal("fetch", (async () => jsonResponse(status, { message: "busy" })) as typeof fetch);
      const res = await sendViaResend({ to: "a@x.com", subject: "s", html: "<p>x</p>" });
      expect(res.sent).toBe(false);
      expect(res.permanent).toBeUndefined();
      expect(res.error).toContain(String(status));
    }
  });

  it("treats other 4xx as permanent failures", async () => {
    vi.stubGlobal("fetch", (async () => jsonResponse(422, { message: "unverified domain" })) as typeof fetch);
    const res = await sendViaResend({ to: "a@x.com", subject: "s", html: "<p>x</p>" });
    expect(res).toMatchObject({ sent: false, permanent: true });
    expect(res.error).toContain("422");
  });

  it("treats a timeout as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      ((async (_url: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        })) as unknown) as typeof fetch
    );
    const res = await sendViaResend({ to: "a@x.com", subject: "s", html: "<p>x</p>", timeoutMs: 20 });
    expect(res.sent).toBe(false);
    expect(res.permanent).toBeUndefined();
    expect(res.error).toMatch(/timed out/i);
  });

  it("refuses without an API key (and never logs one)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const res = await sendViaResend({ to: "a@x.com", subject: "s", html: "<p>x</p>" });
    expect(res.sent).toBe(false);
    expect(res.error).toContain("RESEND_API_KEY");
  });

  it("has a 10s default timeout", () => {
    expect(RESEND_TIMEOUT_MS).toBe(10_000);
  });
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async () => ({ messageId: "<smtp-test-id>" }),
    }),
  },
}));

describe("SMTP proof of sending", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns provider smtp with the SMTP Message-ID", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_FROM", "Belgrove Homes <info@belgrovehomes.com>");
    vi.stubEnv("SMTP_HOST", "smtp.example");
    vi.stubEnv("ZOHO_APP_PASSWORD", "");
    const res = await sendEmail({ to: "c@x.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(res).toEqual({ sent: true, error: null, provider: "smtp", providerMessageId: "<smtp-test-id>" });
  });
});

describe("sendEmail provider switch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("routes through Resend with the row id when EMAIL_PROVIDER=resend", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("SMTP_FROM", "Belgrove Homes <info@belgrovehomes.com>");
    vi.stubEnv("NODE_ENV", "production");
    const seen: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      (async (_url: unknown, init: RequestInit) => {
        seen.push(init);
        return jsonResponse(200, { id: "x" });
      }) as typeof fetch
    );
    const res = await sendEmail({ to: "client@x.com", subject: "Hi", html: "<p>Hi</p>", idempotencyKey: "out-7" });
    expect(res.sent).toBe(true);
    expect(new Headers(seen[0].headers).get("Idempotency-Key")).toBe("out-7");
  });
});
