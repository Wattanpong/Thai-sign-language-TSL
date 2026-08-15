import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatisticsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
}

export function StatisticsCard({
  label,
  value,
  description,
  icon,
  className,
  ...props
}: StatisticsCardProps) {
  return (
    <div
      className={cn(
        "p-4 sm:p-5 bg-white border border-[#E2E8F0] rounded-2xl space-y-1.5",
        className
      )}
      {...props}
    >

      <div className="flex items-center justify-between text-xs font-medium text-[#64748B]">
        <span>{label}</span>
        {icon && (
          <span className="p-1.5 bg-[#F8FAFC] text-[#475569] rounded-lg">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-semibold text-[#0F172A] tracking-tight">
          {value}
        </span>
      </div>
      {description && (
        <p className="text-xs text-[#64748B] pt-0.5 leading-relaxed">
          {description}
        </p>
      )}
    </div>

  );
}
