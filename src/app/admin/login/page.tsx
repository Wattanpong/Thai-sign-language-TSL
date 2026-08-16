"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input } from "@/components/ui";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from") || "/admin";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("กรุณากรอกรหัสผ่าน");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "รหัสผ่านไม่ถูกต้อง");
        return;
      }

      // Success: redirect to target or admin dashboard
      router.push(fromUrl);
      router.refresh();
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F172A] text-white font-bold text-xl shadow-md ring-4 ring-slate-100">
            TSL
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Admin Portal Access
          </h1>
          <p className="text-sm text-[#64748B]">
            ระบบจัดการข้อมูลภาษามือไทย (Simple Password Gate)
          </p>
        </div>

        {/* Login Card */}
        <Card className="border border-[#E2E8F0] bg-white shadow-sm rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              เข้าสู่ระบบผู้ดูแลระบบ
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              กรุณากรอกรหัสผ่านผู้ดูแลระบบ (ADMIN_PASSWORD) เพื่อดำเนินการต่อ
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800 flex items-center gap-2 animate-in fade-in"
              >
                <span className="text-base">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-[#334155]"
                >
                  รหัสผ่านผู้ดูแลระบบ
                </label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="กรอกรหัสผ่าน Admin..."
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    autoFocus
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B] hover:text-[#0F172A] p-1"
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showPassword ? "ซ่อน" : "แสดง"}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                className="w-full py-2.5 font-semibold text-sm shadow-xs rounded-xl flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    กำลังตรวจสอบ...
                  </>
                ) : (
                  "เข้าสู่ระบบ"
                )}
              </Button>
            </form>

            <div className="pt-2 text-center">
              <Link
                href="/"
                className="text-xs font-medium text-[#64748B] hover:text-[#0EA5E9] transition-colors"
              >
                ← กลับสู่หน้าเว็บไซต์หลัก
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <p className="text-center text-[11px] text-[#94A3B8]">
          🔒 Protected with HTTP-Only Cookie Session Security
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#0EA5E9] border-t-transparent" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
