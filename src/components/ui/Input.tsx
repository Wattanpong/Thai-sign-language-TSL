import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#334155]"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            "flex h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition-colors focus-visible:outline-hidden focus-visible:border-[#0EA5E9] focus-visible:ring-2 focus-visible:ring-[#0EA5E9]/30 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20",
            className
          )}

          {...props}
        />
        {error ? (
          <p id={errorId} className="text-xs text-red-500 font-medium">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-[#64748B]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
