"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/lessons", label: "บทเรียน" },
  { href: "/dictionary", label: "พจนานุกรม" },
  { href: "/practice", label: "ฝึกภาษามือ" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Close mobile menu on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xs border-b border-[#E2E8F0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] rounded-lg"
          aria-label="Thai Sign Language Platform หน้าหลัก"
        >
          <div className="w-8 h-8 bg-[#0F172A] text-white flex items-center justify-center rounded-xl transition-colors">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-[#0F172A] leading-tight">
              TSL Platform
            </span>
            <span className="text-[11px] text-[#64748B] font-normal">
              เรียนภาษามือไทยกับ AI
            </span>
          </div>
        </Link>

        {/* Desktop Navigation (Right Aligned) */}
        <nav
          className="hidden md:flex items-center gap-1 sm:gap-1.5 text-xs font-medium text-[#475569]"
          aria-label="เมนูหลัก"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]",
                  isActive
                    ? "text-[#0F172A] font-semibold bg-[#F8FAFC] border border-[#E2E8F0]"
                    : "hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>


        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={toggleMobileMenu}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F1F5F9] md:hidden focus-visible:outline-2 focus-visible:outline-[#0EA5E9]"
        >
          {mobileMenuOpen ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="border-b border-[#E2E8F0] bg-white px-4 py-3 md:hidden shadow-lg"
        >
          <nav className="flex flex-col space-y-1" aria-label="เมนูหลักสำหรับอุปกรณ์เคลื่อนที่">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#F8FAFC] text-[#0F172A] font-semibold border border-[#E2E8F0]"
                      : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  )}

                  aria-current={isActive ? "page" : undefined}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="h-2 w-2 rounded-full bg-[#0EA5E9]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

    </header>
  );
}
