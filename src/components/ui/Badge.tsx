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
      "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] font-medium",
    tag:
      "bg-[#F1F5F9] border-[#CBD5E1] text-[#334155] font-semibold",
    primary:
      "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] font-semibold",
    success:
      "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] font-medium",
    warning:
      "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] font-medium",
    outline:
      "text-[#475569] border-[#E2E8F0] bg-white font-medium",
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
