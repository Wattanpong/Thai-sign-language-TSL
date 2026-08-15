"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
  icon?: string;
  exact?: boolean;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/categories", label: "หมวดคำศัพท์" },
  { href: "/admin/lessons", label: "คำศัพท์" },
  { href: "/admin/dataset", label: "สำรองและถ่ายโอนข้อมูล" },
];


export interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#E2E8F0] bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Admin Navigation Sidebar"
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-6">
          <Link
            href="/admin"
            className="flex items-center gap-2.5"
            onClick={onClose}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs shadow-xs">
              TSL
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#0F172A]">
                Admin Portal
              </span>
              <span className="text-[10px] text-[#64748B]">TSL Platform</span>
            </div>
          </Link>

          {/* Close on mobile */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] md:hidden"
              aria-label="ปิดเมนูแอดมิน"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex flex-1 flex-col justify-between overflow-y-auto px-4 py-6">
          <nav className="space-y-1.5" aria-label="Admin Menu">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
              การจัดการระบบ
            </p>
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#0EA5E9]",
                    isActive
                      ? "bg-[#F0F9FF] text-[#0369A1] font-semibold border border-[#BAE6FD]"
                      : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      isActive ? "bg-[#0EA5E9]" : "bg-[#CBD5E1]"
                    )}
                  />
                  <span>{item.label}</span>
                </Link>

              );
            })}
          </nav>

          {/* Return to Learner Site */}
          <div className="pt-4 border-t border-[#E2E8F0]">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>กลับสู่หน้าเว็บไซต์หลัก</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
