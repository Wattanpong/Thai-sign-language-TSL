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
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between py-4 sm:py-5 border-b border-[#E2E8F0] mb-5 sm:mb-6",
        className
      )}
    >

      <div className="space-y-1.5">
        {badge && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] mb-1">
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
