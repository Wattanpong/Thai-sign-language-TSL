import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui";
import { LessonList } from "@/components/lessons";
import { getCategories, getLessons } from "@/data";

export default async function LessonsPage() {
  const categories = await getCategories();
  const lessons = await getLessons();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
        {/* Page Header */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 lg:p-8 border border-[#E2E8F0] space-y-2.5 shadow-2xs">
          <Badge variant="default">
            คลังบทเรียน
          </Badge>
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0F172A]">
              บทเรียนภาษามือไทย
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              เลือกหมวดหมู่และคำศัพท์เพื่อเริ่มเรียนรู้
            </p>
          </div>
        </div>

        {/* Dynamic Lesson List Component with Real-time Storage Sync & Filtering */}
        <LessonList
          initialCategories={categories}
          initialLessons={lessons}
        />
      </div>
    </AppLayout>
  );
}
