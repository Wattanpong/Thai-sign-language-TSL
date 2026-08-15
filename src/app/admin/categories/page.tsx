import { PageHeader } from "@/components/ui";
import { CategoryManager } from "@/components/admin";

export default function AdminCategoriesPage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        badge="จัดการเนื้อหา"
        title="หมวดหมู่คำศัพท์ (Category Management)"
        description="เพิ่ม แก้ไข ลบ และจัดเรียงหมวดหมู่คำศัพท์ภาษามือไทย พร้อมระบบตรวจสอบความสัมพันธ์กับบทเรียน"
      />

      <CategoryManager />
    </div>

  );
}

