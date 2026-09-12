import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";

export const proxy = auth((req) => {
  const isInternalUser = isInternalRole(req.auth?.user?.role);
  const isLoginPage = req.nextUrl.pathname === "/admin/login";
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/admin");

  if (isLoginPage) {
    if (isInternalUser) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
