import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// A statement email leaves the system ONLY through an explicit admin Email
// action. This test fails if any other code path gains the ability to send
// one: payment confirmation, settlement, correction, generation, retries,
// webhooks, imports and backfills must never import the mail sender for
// statement purposes.

const SENDER = "lib/email/sendEmail";

// Every non-test importer of the shared mail sender. Adding a file here
// fails the test until it is reviewed and allowlisted deliberately.
const ALLOWED_SENDERS = new Set([
  "src/app/api/admin/bookings/[id]/route.ts", // booking lifecycle mail, never statements
  "src/app/api/admin/transactions/[id]/statements/[statementId]/email/route.ts",
  "src/app/api/admin/transactions/[id]/corrections/email/route.ts",
]);

function allSourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allSourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("statement sending safety", () => {
  it("only allowlisted routes import the shared mail sender", () => {
    const offenders = allSourceFiles(path.join(process.cwd(), "src"))
      .filter((f) => !f.includes("__tests__"))
      .filter((f) => fs.readFileSync(f, "utf8").includes(SENDER))
      .map((f) => path.relative(process.cwd(), f));
    expect(offenders.sort()).toEqual([...ALLOWED_SENDERS].sort());
  });

  it("payment, correction and generation paths cannot send statement mail", () => {
    const banned = [
      "src/app/api/admin/transactions/[id]/payments/[paymentId]/confirm/route.ts",
      "src/app/api/admin/transactions/[id]/payments/route.ts",
      "src/app/api/admin/transactions/[id]/payments/[paymentId]/correct/route.ts",
      "src/app/api/admin/transactions/[id]/payments/[paymentId]/void/route.ts",
      "src/app/api/admin/transactions/[id]/statements/route.ts",
      "src/app/api/admin/transactions/[id]/statement/route.ts",
      "src/app/api/admin/transactions/[id]/statement/preview/route.ts",
      "src/lib/paymentService.ts",
      "src/lib/statements.ts",
      "src/lib/statement-pdf.ts",
      "src/lib/statement-model.ts",
    ];
    for (const f of banned) {
      const text = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      expect(text, f).not.toContain(SENDER);
      expect(text, f).not.toContain("emailStatement");
    }
  });

  it("both statement email endpoints require explicit confirmation", () => {
    for (const f of [
      "src/app/api/admin/transactions/[id]/statements/[statementId]/email/route.ts",
      "src/app/api/admin/transactions/[id]/corrections/email/route.ts",
    ]) {
      const text = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      expect(text, f).toContain("confirm");
      expect(text, f).toContain("auditEvent");
    }
  });
});
