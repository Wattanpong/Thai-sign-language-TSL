"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";

export interface AdminHeaderProps {
  onMenuToggle: () => void;
}

export function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="เปิด/ปิด แถบเมนูด้านข้าง"
          className="rounded-xl border border-[#E2E8F0] p-2 text-[#334155] hover:bg-[#F1F5F9] md:hidden focus-visible:outline-2 focus-visible:outline-[#FFB400]"
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <span className="text-sm font-semibold text-[#0F172A] hidden sm:inline">
          ระบบจัดการข้อมูลภาษามือไทย (TSL Management)
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="tag">Admin Mode</Badge>
      </div>
    </header>
  );
}
