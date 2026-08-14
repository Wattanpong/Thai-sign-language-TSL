import * as React from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <Navbar />
      <main className="flex-1 pb-16">{children}</main>
      <Footer />
    </div>
  );
}
