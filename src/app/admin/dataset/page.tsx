import { PageHeader } from "@/components/ui";
import { DatasetManager } from "@/components/admin";

export default function AdminDatasetPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="จัดการฐานข้อมูล"
        title="สำรองและถ่ายโอนข้อมูล (Dataset Management)"
        description="จัดการ Export, Import, Backup และ Restore Dataset ของระบบ พร้อมการตรวจสอบความถูกต้องของท่าทางอ้างอิง"
      />

      <DatasetManager />
    </div>
  );
}
