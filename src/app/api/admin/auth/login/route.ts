import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  getExpectedSessionToken,
  verifyAdminPassword,
} from "@/lib/auth/adminAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "กรุณากรอกรหัสผ่าน" },
        { status: 400 }
      );
    }

    if (!process.env.ADMIN_PASSWORD) {
      console.error("[Admin Auth] ADMIN_PASSWORD environment variable is not configured in .env.local");
      return NextResponse.json(
        { success: false, error: "ระบบยังไม่ได้ตั้งค่า ADMIN_PASSWORD ในระบบ" },
        { status: 500 }
      );
    }

    const isValid = verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "รหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // Set secure HttpOnly session cookie
    const token = getExpectedSessionToken();
    const response = NextResponse.json({ success: true, message: "เข้าสู่ระบบสำเร็จ" });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error("[Admin Auth] Login error:", err);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน" },
      { status: 500 }
    );
  }
}
