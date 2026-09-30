import { describe, it, expect, vi } from "vitest";

// POST /api/admin/outbox/retry is bearer-less: admin session auth only.
vi.mock("@/auth", () => ({
  auth: async () => null,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findUnique: async () => null,
    },
  },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/outbox/retry/route";

describe("POST /api/admin/outbox/retry", () => {
  it("rejects unauthenticated callers without touching the outbox", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/admin/outbox/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "out-1" }),
      })
    );
    expect(res.status).toBe(401);
  });
});
