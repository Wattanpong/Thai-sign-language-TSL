import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/auth/adminAuth";

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const authenticated = isValidAdminSession(sessionCookie);

  return NextResponse.json({
    authenticated,
  });
}
