import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/auth/adminAuth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow login page and auth API routes without authentication check
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth/")
  ) {
    // If already authenticated and accessing /admin/login, redirect directly to /admin
    if (pathname === "/admin/login") {
      const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
      if (isValidAdminSession(sessionCookie)) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Protect API routes: /api/admin/* (returns 401 JSON for programmatic calls like curl/Postman)
  if (pathname.startsWith("/api/admin")) {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!isValidAdminSession(sessionCookie)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin session required" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 3. Protect UI routes: /admin and /admin/* (redirects to /admin/login)
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!isValidAdminSession(sessionCookie)) {
      const loginUrl = new URL("/admin/login", request.url);
      if (pathname !== "/admin") {
        loginUrl.searchParams.set("from", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
