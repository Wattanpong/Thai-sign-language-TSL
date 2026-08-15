import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "amber";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-[#0F172A] text-white hover:bg-[#1E293B] active:bg-[#334155]",
      amber:
        "bg-[#0EA5E9] text-white hover:bg-[#0284C7] active:bg-[#0369A1]",
      secondary:
        "bg-[#F8FAFC] text-[#334155] hover:bg-[#F1F5F9] active:bg-[#E2E8F0] border border-[#E2E8F0]",
      outline:
        "border border-[#E2E8F0] text-[#0F172A] bg-white hover:bg-[#F8FAFC] active:bg-[#F1F5F9]",
      ghost:
        "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]",
    };



    const sizeStyles = {
      sm: "h-9 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
