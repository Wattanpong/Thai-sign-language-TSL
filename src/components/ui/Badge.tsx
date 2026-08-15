import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "warning" | "outline" | "tag";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default:
      "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] font-normal",
    tag:
      "bg-[#F8FAFC] border-[#E2E8F0] text-[#334155] font-medium",
    primary:
      "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD] font-medium",
    success:
      "bg-[#F0FDF4] text-[#166534] border-[#DCFCE7] font-medium",
    warning:
      "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] font-medium",
    outline:
      "text-[#64748B] border-[#E2E8F0] bg-white font-normal",
  };



  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
