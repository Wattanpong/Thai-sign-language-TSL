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
      "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB400] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-[#0F172A] text-white hover:bg-[#FFB400] hover:text-[#0F172A] shadow-xs font-semibold active:bg-[#E5A200]",
      amber:
        "bg-[#FFB400] text-[#0F172A] hover:bg-[#E5A200] active:bg-[#CC9000] shadow-xs font-semibold",
      secondary:
        "bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0] active:bg-[#CBD5E1]",
      outline:
        "border border-[#CBD5E1] text-[#0F172A] bg-white hover:bg-[#F8FAFC] active:bg-[#F1F5F9]",
      ghost:
        "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
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
