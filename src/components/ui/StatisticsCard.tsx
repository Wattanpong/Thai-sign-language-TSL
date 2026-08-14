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
        "p-6 bg-white border border-[#E2E8F0] rounded-xl shadow-xs space-y-2 transition-all hover:shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between text-xs font-semibold text-[#64748B] uppercase tracking-wider">
        <span>{label}</span>
        {icon && (
          <span className="p-1.5 bg-[#F1F5F9] text-[#334155] rounded-md">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[#0F172A]">
          {value}
        </span>
      </div>
      {description && (
        <p className="text-xs text-[#64748B] pt-1 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
