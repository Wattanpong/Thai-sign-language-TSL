import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-center md:justify-between py-6 sm:py-8 border-b border-[#E2E8F0] mb-8",
        className
      )}
    >
      <div className="space-y-1.5">
        {badge && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF8E6] text-[#805B00] border border-[#FFD366] mb-1">
            {badge}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
          {title}
        </h1>
        {description && (
          <p className="text-sm sm:text-base text-[#475569] max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
    </div>
  );
}
