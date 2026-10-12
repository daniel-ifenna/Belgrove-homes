import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // @sparticuz/chromium's browser binaries (.br) are loaded by the package
  // at runtime through paths no tracer can follow, so production bundles
  // ship without them and every statement render fails. Force-include them
  // in the three functions that render PDFs.
  outputFileTracingIncludes: {
    "/api/admin/transactions/[id]/statement/preview": ["./node_modules/@sparticuz/chromium/bin/*.br"],
    "/api/admin/transactions/[id]/statements": ["./node_modules/@sparticuz/chromium/bin/*.br"],
    "/api/admin/transactions/[id]/corrections/email": ["./node_modules/@sparticuz/chromium/bin/*.br"],
  },
  // Admin pages and APIs must never be cached by the browser (Back button
  // after sign-out must hit the server guard, not a stored copy). Applies
  // to page, API and redirect responses under /admin/* and /api/admin/*.
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ];
    return [
      { source: "/admin/:path*", headers: noStore },
      { source: "/api/admin/:path*", headers: noStore },
      // Public statement pages must never be indexed.
      { source: "/s/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
