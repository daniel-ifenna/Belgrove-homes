import { describe, it, expect } from "vitest";
import { checkRateLimit, clientIp } from "../rate-limit";

describe("rate limit", () => {
  it("allows up to the limit then blocks with a retry hint", () => {
    const key = `test-${Date.now()}-allow`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window", () => {
    const key = `test-${Date.now()}-reset`;
    expect(checkRateLimit(key, 1, 50, 1_000).ok).toBe(true);
    expect(checkRateLimit(key, 1, 50, 1_010).ok).toBe(false);
    expect(checkRateLimit(key, 1, 50, 2_000).ok).toBe(true);
  });

  it("prefers x-forwarded-for client ip", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(h)).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
