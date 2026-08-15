"use client";

import * as React from "react";
import { Card } from "@/components/ui";

const GUIDE_STORAGE_KEY = "tsl_practice_guide_expanded";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(GUIDE_STORAGE_KEY);
  return stored !== "false";
}

function getServerSnapshot() {
  return true;
}

export function PracticeGuide() {
  const isExpanded = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const toggleExpand = () => {
    try {
      localStorage.setItem(GUIDE_STORAGE_KEY, isExpanded ? "false" : "true");
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      {/* Collapsible Header Toggle */}
      <button
        type="button"
        onClick={toggleExpand}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all text-left cursor-pointer group shadow-2xs"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7] font-bold text-xs">
            💡
          </span>
          <span className="font-semibold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#0284C7] transition-colors">
            วิธีใช้งาน 3 ขั้นตอน
          </span>
          <span className="text-[11px] text-[#64748B] hidden sm:inline">
            (เลือกคำศัพท์ → ทำท่าทาง → ดูผลคะแนน)
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#64748B] group-hover:text-[#0F172A] transition-colors">
          <span className="text-[11px] font-medium hidden sm:inline">
            {isExpanded ? "พับเก็บ" : "ดูคำแนะนำ"}
          </span>
          <span className={`transition-transform duration-200 text-sm ${isExpanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>
      </button>

      {/* Collapsible 3-Step Cards Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 animate-fadeIn">
          <Card className="p-4 sm:p-5 space-y-1.5 border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0F172A] text-white font-bold text-xs">
                1
              </span>
              <h2 className="font-semibold text-[#0F172A] text-xs sm:text-sm">
                เลือกคำ & เปิดกล้อง
              </h2>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed pl-8">
              เลือกคำศัพท์ที่ต้องการฝึกและกดเปิดกล้อง
            </p>
          </Card>

          <Card className="p-4 sm:p-5 space-y-1.5 border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0F172A] text-white font-bold text-xs">
                2
              </span>
              <h2 className="font-semibold text-[#0F172A] text-xs sm:text-sm">
                ทำท่าทาง
              </h2>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed pl-8">
              กดเริ่มฝึก แล้วทำท่าทางตามคำแนะนำ
            </p>
          </Card>

          <Card className="p-4 sm:p-5 space-y-1.5 border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0F172A] text-white font-bold text-xs">
                3
              </span>
              <h2 className="font-semibold text-[#0F172A] text-xs sm:text-sm">
                รับผลคะแนน
              </h2>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed pl-8">
              กดหยุดบนหน้าจอเพื่อดูคะแนนจาก AI
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
