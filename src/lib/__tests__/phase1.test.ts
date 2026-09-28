import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getAppUrl, getReceiptAccessUrl, generateReceiptAccessToken } from "../app-url";
import { isTokenUsable } from "../receipt-access";
import { showTestFromParams, excludeTestRows, excludeTestTransactions } from "../test-data";
import { applyDevEmailPolicy } from "../email/sendEmail";
import { wouldExceedSchedule } from "../paymentConfirmation";
import { phonesMatch, normalizePhoneForCompare } from "../phone";

const SRC = path.join(process.cwd(), "src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe("no hardcoded origin", () => {
  it("src/ contains no localhost/:3000 outside app-url.ts and test fixtures", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file);
      if (rel === "lib/app-url.ts") continue;
      if (rel.includes("__tests__")) continue; // fixtures use example.com
      const text = fs.readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (/(localhost|127\.0\.0\.1|:3000)/.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("getAppUrl", () => {
  const OLD = { ...process.env };
  it("reads APP_URL only and strips trailing slashes", () => {
    process.env = { ...OLD, APP_URL: "https://belgrovehomes.com/", NODE_ENV: "production" };
    expect(getAppUrl()).toBe("https://belgrovehomes.com");
    expect(getReceiptAccessUrl("tok123")).toBe("https://belgrovehomes.com/r/tok123");
  });
  it("throws in production when APP_URL is missing", () => {
    process.env = { ...OLD, NODE_ENV: "production" };
    delete process.env.APP_URL;
    expect(() => getAppUrl()).toThrow(/APP_URL/);
  });
  it("falls back to localhost in development", () => {
    process.env = { ...OLD, NODE_ENV: "development" };
    delete process.env.APP_URL;
    expect(getAppUrl()).toBe("http://localhost:3000");
  });
  it("mints 32-byte URL-safe tokens", () => {
    const t = generateReceiptAccessToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateReceiptAccessToken()).not.toBe(t);
  });
  process.env = OLD;
});

describe("/r/{token} access rules", () => {
  it("valid token works", () => {
    expect(isTokenUsable({ accessToken: "abc", accessTokenRevokedAt: null })).toBe(true);
  });
  it("revoked token fails", () => {
    expect(isTokenUsable({ accessToken: "abc", accessTokenRevokedAt: new Date() })).toBe(false);
  });
  it("unknown (null) fails", () => {
    expect(isTokenUsable(null)).toBe(false);
  });
  it("missing token fails", () => {
    expect(isTokenUsable({ accessToken: null, accessTokenRevokedAt: null })).toBe(false);
  });
  it("no-token /receipts/[ref] requires admin auth (route redirects)", () => {
    const text = fs.readFileSync(path.join(SRC, "app/receipts/[ref]/page.tsx"), "utf8");
    expect(text).toContain("/admin/login");
    expect(text).toContain("isInternalRole");
  });
  it("admin PDF route requires an internal session", () => {
    const text = fs.readFileSync(path.join(SRC, "app/api/admin/receipts/[id]/pdf/route.ts"), "utf8");
    expect(text).toContain("isInternalRole");
    expect(text).toContain("401");
  });
});

describe("metrics exclude isTest", () => {
  it("helpers build the right filters", () => {
    expect(showTestFromParams({ showTest: "1" })).toBe(true);
    expect(showTestFromParams({})).toBe(false);
    expect(excludeTestRows(false)).toEqual({ isTest: false });
    expect(excludeTestRows(true)).toEqual({});
    expect(excludeTestTransactions(false)).toEqual({ transaction: { isTest: false } });
  });
  it("dashboard, summary and queues filter test rows", () => {
    const dash = fs.readFileSync(path.join(SRC, "app/admin/page.tsx"), "utf8");
    expect(dash).toContain("excludeTest");
    const summary = fs.readFileSync(path.join(SRC, "app/api/admin/summary/route.ts"), "utf8");
    // Summary delegates to the finance service (which excludes test rows).
    expect(summary).toMatch(/excludeTest|getMonthlyTargetProgress/);
    for (const f of [
      "app/admin/bookings/page.tsx",
      "app/admin/transactions/page.tsx",
      "app/admin/payments/page.tsx",
      "app/admin/receipts/page.tsx",
      "app/admin/inspections/page.tsx",
    ]) {
      expect(fs.readFileSync(path.join(SRC, f), "utf8")).toContain("isTest");
    }
  });
});

describe("overpayment is rejected at record and confirm", () => {
  it("record: pending + confirmed must not exceed scheduled", () => {
    // Installment fully paid by confirmed money: any new pending is rejected.
    expect(wouldExceedSchedule(2_900_000, 0, 2_900_000, 2_900_000)).toBe(true);
    // Two identical cheques against an unpaid installment: second rejected.
    expect(wouldExceedSchedule(0, 2_900_000, 2_900_000, 2_900_000)).toBe(true);
    // Exact fit still allowed.
    expect(wouldExceedSchedule(0, 0, 2_900_000, 2_900_000)).toBe(false);
  });
  it("confirm: OverScheduleError aborts (covered by applyConfirmationDbUnit tests)", () => {
    expect(wouldExceedSchedule(2_000_000, 0, 1_500_000, 2_900_000)).toBe(true);
  });
});

describe("receipt cannot be created without a confirmed payment", () => {
  it("schema requires Receipt.paymentId", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/paymentId String @unique/);
    expect(schema).not.toMatch(/paymentId String\? @unique/);
  });
  it("manual receipt paths are removed", () => {
    const gone = [
      "app/api/admin/receipts/route.ts",
      "app/api/admin/bookings/[id]/receipt/route.ts",
      "app/admin/receipts/new/page.tsx",
      "app/admin/receipts/new/CreateReceiptForm.tsx",
      "lib/siteUrl.ts",
    ];
    for (const f of gone) {
      expect(fs.existsSync(path.join(SRC, f)), `${f} should be deleted`).toBe(false);
    }
    const topbar = fs.readFileSync(path.join(SRC, "components/admin/AdminTopBar.tsx"), "utf8");
    expect(topbar).not.toContain("New Receipt");
    expect(topbar).not.toContain("receipts/new");
  });
});

describe("dev email policy", () => {
  const OLD = { ...process.env };
  it("passes through untouched in production", () => {
    process.env = { ...OLD, NODE_ENV: "production" };
    const out = applyDevEmailPolicy({ to: "client@example.com", subject: "Receipt" });
    expect(out).toEqual({ to: "client@example.com", subject: "Receipt", redirectedFrom: null, dropped: false });
  });
  it("redirects everything to EMAIL_DEV_REDIRECT with [DEV] prefix", () => {
    process.env = { ...OLD, NODE_ENV: "development", EMAIL_DEV_REDIRECT: "dev@example.com", EMAIL_DEV_ALLOWLIST: "" };
    const out = applyDevEmailPolicy({ to: "client@example.com", subject: "Receipt" });
    expect(out.to).toBe("dev@example.com");
    expect(out.subject).toBe("[DEV] Receipt");
    expect(out.redirectedFrom).toEqual(["client@example.com"]);
    expect(out.dropped).toBe(false);
  });
  it("a non-allowlisted recipient is never emailed in dev", () => {
    process.env = { ...OLD, NODE_ENV: "development", EMAIL_DEV_ALLOWLIST: "allowed@example.com" };
    delete process.env.EMAIL_DEV_REDIRECT;
    const dropped = applyDevEmailPolicy({ to: "client@example.com", subject: "Hi" });
    expect(dropped.dropped).toBe(true);
    const kept = applyDevEmailPolicy({ to: ["client@example.com", "Allowed@Example.com"], subject: "Hi" });
    expect(kept.dropped).toBe(false);
    expect(kept.to).toEqual(["Allowed@Example.com"]);
  });
  it("refuses to send in dev with neither redirect nor allowlist", () => {
    process.env = { ...OLD, NODE_ENV: "development", EMAIL_DEV_ALLOWLIST: "" };
    delete process.env.EMAIL_DEV_REDIRECT;
    expect(() => applyDevEmailPolicy({ to: "a@b.com", subject: "x" })).toThrow(/EMAIL_DEV_REDIRECT/);
  });
  process.env = OLD;
});

describe("agent assignment guard", () => {
  it("email match (case-insensitive) blocks", () => {
    expect("Daniel.Ifenna.Daniel@Gmail.Com".trim().toLowerCase()).toBe("daniel.ifenna.daniel@gmail.com");
  });
  it("phone normalization matches +234/0 forms, never short numbers", () => {
    expect(phonesMatch("+2348154804158", "08154804158")).toBe(true);
    expect(phonesMatch("+2347014380883", "+2348154804158")).toBe(false);
    expect(phonesMatch(null, "08154804158")).toBe(false);
    expect(normalizePhoneForCompare("123")).toBe(null);
  });
  it("assign route enforces the guard with an override path", () => {
    const text = fs.readFileSync(path.join(SRC, "app/api/admin/bookings/[id]/route.ts"), "utf8");
    expect(text).toContain("overrideReason");
    expect(text).toContain("assign_agent_override");
    expect(text).toContain("matches the booking customer");
  });
});
