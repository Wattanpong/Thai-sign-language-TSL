import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CategoryCardProps {
  id: string;
  name: string;
  description?: string;
  lessonCount?: number;
  order?: number;
  href?: string;
  className?: string;
}

export function CategoryCard({
  id,
  name,
  description,
  lessonCount = 0,
  order,
  href,
  className,
}: CategoryCardProps) {
  const targetHref = href || `/lessons?category=${id}`;

  return (
    <Link
      href={targetHref}
      className={cn(
        "group p-6 bg-white border border-[#E2E8F0] hover:border-[#FFB400] rounded-xl transition-all shadow-xs hover:shadow-sm flex flex-col justify-between space-y-6",
        className
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] group-hover:bg-[#FFB400] group-hover:text-[#0F172A] group-hover:border-[#FFB400] transition-colors">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 0 1 2 2v4a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
          </span>

          <div className="flex items-center gap-1.5">
            {order !== undefined && (
              <span className="text-[10px] font-mono text-[#92400E] bg-[#FFFBEB] px-2 py-0.5 rounded font-semibold border border-[#FDE68A]">
                หมวดหลัก #{order}
              </span>
            )}
            <span className="text-xs font-medium px-2.5 py-1 bg-[#F1F5F9] text-[#475569] rounded-md">
              {lessonCount} คำ
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#0F172A] group-hover:text-[#B45309] transition-colors">
            {name}
          </h3>
          {description && (
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-semibold text-[#B45309] pt-3 border-t border-[#F1F5F9]">
        <span>ดูรายการคำศัพท์</span>
        <svg
          className="w-4 h-4 group-hover:translate-x-1 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
          />
        </svg>
      </div>
    </Link>
  );
}
