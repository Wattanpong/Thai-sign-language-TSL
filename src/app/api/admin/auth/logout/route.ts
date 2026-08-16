import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/adminAuth";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "ออกจากระบบเรียบร้อยแล้ว" });

  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

export async function GET() {
  return POST();
}
