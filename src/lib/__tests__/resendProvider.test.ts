import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  htmlToText,
  sendViaResend,
  RESEND_TIMEOUT_MS,
  resendTimeoutMs,
} from "../email/resendProvider";
import { sendEmail } from "../email/sendEmail";

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("htmlToText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToText("<p>Hi Ada,</p><p>Ref &amp; <strong>BKG-1</strong></p>")).toBe("Hi Ada,\nRef & BKG-1");
  });
});

describe("resendTimeoutMs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 30s and clamps to 5s..60s", () => {
    expect(RESEND_TIMEOUT_MS).toBe(30_000);
    delete process.env.RESEND_TIMEOUT_MS;
    expect(resendTimeoutMs()).toBe(30_000);
    vi.stubEnv("RESEND_TIMEOUT_MS", "1000");
    expect(resendTimeoutMs()).toBe(5_000);
    vi.stubEnv("RESEND_TIMEOUT_MS", "999999");
    expect(resendTimeoutMs()).toBe(60_000);
    vi.stubEnv("RESEND_TIMEOUT_MS", "15000");
    expect(resendTimeoutMs()).toBe(15_000);
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

  it("sends via the Resend API with the idempotency key header", async () => {
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
      idempotencyKey: "receipt:rcpt-1",
    });
    expect(res).toEqual({ sent: true, error: null, provider: "resend", providerMessageId: "email-id-1" });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://api.resend.com/emails");
    const headers = new Headers(seen[0].init.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${ENV.RESEND_API_KEY}`);
    expect(headers.get("Idempotency-Key")).toBe("receipt:rcpt-1");
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

  it("omits the Idempotency-Key header when no key is given", async () => {
    const seen: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      (async (_url: unknown, init: RequestInit) => {
        seen.push(init);
        return jsonResponse(200, { id: "x" });
      }) as typeof fetch
    );
    await sendViaResend({ to: "a@x.com", subject: "s", html: "<p>x</p>" });
    expect(new Headers(seen[0].headers).get("Idempotency-Key")).toBeNull();
  });

  it("maps CID attachments to content_id for inline logos", async () => {
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

  it("treats a 409 as permanent (key reuse with a different body is a caller bug)", async () => {
    vi.stubGlobal(
      "fetch",
      (async () =>
        jsonResponse(409, {
          message: "This idempotency key has been used with this HTTP method and endpoint within the last 24 hours, but the request body was modified",
        })) as typeof fetch
    );
    const res = await sendViaResend({ to: "a@x.com", subject: "s", html: "<p>x</p>", idempotencyKey: "k" });
    expect(res).toMatchObject({ sent: false, permanent: true });
    expect(res.error).toContain("409");
  });

  it("treats a timeout as retryable and names the elapsed time", async () => {
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
});

describe("sendEmail (Resend-only wrapper)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function productionEnv() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("SMTP_FROM", "Belgrove Homes <info@belgrovehomes.com>");
  }

  it("routes every send through Resend with the given idempotency key", async () => {
    productionEnv();
    const seen: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      (async (_url: unknown, init: RequestInit) => {
        seen.push(init);
        return jsonResponse(200, { id: "x" });
      }) as typeof fetch
    );
    const res = await sendEmail({ to: "client@x.com", subject: "Hi", html: "<p>Hi</p>", idempotencyKey: "receipt:1" });
    expect(res.sent).toBe(true);
    expect(res.provider).toBe("resend");
    expect(new Headers(seen[0].headers).get("Idempotency-Key")).toBe("receipt:1");
  });

  it("returns the Resend message id as proof of sending", async () => {
    productionEnv();
    vi.stubGlobal("fetch", (async () => jsonResponse(200, { id: "msg-abc" })) as typeof fetch);
    const res = await sendEmail({ to: "client@x.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(res).toEqual({ sent: true, error: null, provider: "resend", providerMessageId: "msg-abc" });
  });

  it("surfaces API errors without throwing", async () => {
    productionEnv();
    vi.stubGlobal("fetch", (async () => jsonResponse(403, { message: "forbidden" })) as typeof fetch);
    const res = await sendEmail({ to: "client@x.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(res.sent).toBe(false);
    expect(res.error).toContain("403");
  });

  it("has no SMTP path: the legacy sender is not referenced by the mailer", async () => {
    const src = await import("../email/sendEmail");
    expect(typeof src.sendEmail).toBe("function");
    // The wrapper module must not reference the removed sender at all.
    const fs = await import("node:fs");
    const code = fs.readFileSync(new URL("../email/sendEmail.ts", import.meta.url), "utf8");
    expect(code).not.toMatch(/nodemailer|createTransport|ZOHO_APP_PASSWORD|EMAIL_PROVIDER|getEmailProvider/);
  });
});
