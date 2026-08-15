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
        "group p-4 sm:p-5 bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-2xl transition-colors flex flex-col justify-between space-y-4",
        className
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium px-2.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] rounded-lg">
            {lessonCount} คำ
          </span>
          {order !== undefined && (
            <span className="text-[11px] text-[#94A3B8]">
              หมวด #{order}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-base font-semibold text-[#0F172A] group-hover:text-[#0F172A] transition-colors">
            {name}
          </h3>
          {description && (
            <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-[#64748B] group-hover:text-[#0F172A] pt-2.5 border-t border-[#F1F5F9] transition-colors">
        <span>ดูคำศัพท์</span>
        <span aria-hidden="true">→</span>
      </div>
    </Link>


  );
}
