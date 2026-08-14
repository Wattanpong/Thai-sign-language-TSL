import * as React from "react";
import { AdminLayout } from "@/components/admin";

export const metadata = {
  title: "Admin Portal - TSL AI Platform",
  description: "ระบบจัดการข้อมูลภาษามือไทย",
};

export default function RootAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
