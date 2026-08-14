import * as React from "react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[#E2E8F0] bg-white py-8 text-xs text-[#64748B]">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <p className="font-semibold text-[#0F172A] text-sm">
            TSL Learning Platform — ระบบเรียนรู้และฝึกฝนภาษามือไทย
          </p>
          <p className="text-[#64748B]">
            พัฒนาเพื่อสนับสนุนการสื่อสารและการเข้าถึงด้วยเทคโนโลยี AI Gesture Recognition
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-[12px] font-medium text-[#475569] bg-[#F8FAFC] px-3.5 py-1.5 rounded-lg border border-[#E2E8F0]">
            © {currentYear} Thai Sign Language Project
          </div>
        </div>
      </div>
    </footer>
  );
}
