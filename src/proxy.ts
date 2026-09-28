import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

export const proxy = auth((req) => {
  const pathname = req.nextUrl.pathname;

  // Public receipt surface: token-gated, but rate-limited per IP.
  if (pathname === "/r" || pathname.startsWith("/r/") || pathname.startsWith("/api/r/")) {
    const rl = checkRateLimit(`receipt:${clientIp(req.headers)}`, 120, 60_000);
    if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
    return NextResponse.next();
  }

  const isInternalUser = isInternalRole(req.auth?.user?.role);
  const isLoginPage = pathname === "/admin/login";
  const isApiRoute = pathname.startsWith("/api/admin");

  if (isLoginPage) {
    if (isInternalUser) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  if (!isInternalUser) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/r/:path*", "/api/r/:path*"],
};
