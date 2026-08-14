import Link from "next/link";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@/components/ui";
import { getLessons, getCategories } from "@/data";

export default async function AdminLessonsPage() {
  const lessons = await getLessons();
  const categories = await getCategories();

  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="จัดการข้อมูล"
        title="คำศัพท์และบทเรียน (Lessons)"
        description="รายการคำศัพท์และประเภทท่าทางภาษามือในระบบ พร้อมระบบบันทึก Reference Gesture"
        action={
          <Button size="sm">
            + เพิ่มคำศัพท์ใหม่
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายการคำศัพท์ทั้งหมด ({lessons.length})</CardTitle>
          <CardDescription>
            คำศัพท์พร้อมประเภทท่าทาง (Static / Dynamic) สำหรับการฝึกซ้อมและบันทึกท่าทางอ้างอิง
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-[#E2E8F0]">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-4 first:pt-0 last:pb-0 gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0F172A]">
                      {lesson.word}
                    </span>
                    <Badge
                      variant={
                        lesson.gestureType === "dynamic" ? "primary" : "outline"
                      }
                    >
                      {lesson.gestureType === "dynamic" ? "Dynamic" : "Static"}
                    </Badge>
                    <span className="text-xs text-[#64748B]">
                      หมวด: {getCategoryName(lesson.categoryId)}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">{lesson.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/admin/lessons/${lesson.id}/reference`}>
                    <Button variant="outline" size="sm" className="font-medium text-xs">
                      🎥 บันทึก Reference Gesture
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
