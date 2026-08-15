import { PageHeader } from "@/components/ui";
import { LessonManager } from "@/components/admin";

export default function AdminLessonsPage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        badge="จัดการเนื้อหา"
        title="คำศัพท์และบทเรียน (Lesson & Vocabulary Management)"
        description="เพิ่ม แก้ไข ลบ คำศัพท์ภาษามือไทย กำหนดประเภทท่าทาง Static/Dynamic พร้อมระบบจัดการ Reference Gesture"
      />

      <LessonManager />
    </div>

  );
}

