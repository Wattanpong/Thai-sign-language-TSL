import Link from "next/link";
import { getLessonById } from "@/data";
import { PageHeader, Button } from "@/components/ui";
import { ReferenceManager } from "@/components/admin";

interface ReferencePageProps {
  params: Promise<{
    lessonId: string;
  }>;
}

export default async function AdminLessonReferencePage({
  params,
}: ReferencePageProps) {
  const { lessonId } = await params;
  const lesson = await getLessonById(lessonId);

  if (!lesson) {
    return (
      <div className="space-y-6">
        <PageHeader
          badge="ไม่พบข้อมูล"
          title="ไม่พบบทเรียนที่ระบุ"
          description={`รหัสบทเรียน: ${lessonId}`}
          action={
            <Link href="/admin/lessons">
              <Button variant="outline" size="sm">
                ← กลับสู่รายการบทเรียน
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <PageHeader
        badge="Reference Gesture Management"
        title={`จัดการท่าทางอ้างอิง: "${lesson.word}"`}
        description="ระบบบันทึกและตรวจสอบคุณภาพของ Reference Gesture ต้นแบบสำหรับบทเรียนภาษามือไทย"
        action={
          <Link href="/admin/lessons">
            <Button variant="outline" size="sm">
              ← กลับสู่รายการบทเรียน
            </Button>
          </Link>
        }
      />

      {/* Main Interactive Reference Manager */}
      <ReferenceManager lesson={lesson} />
    </div>
  );
}
