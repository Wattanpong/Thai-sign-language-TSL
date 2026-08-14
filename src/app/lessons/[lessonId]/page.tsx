import Link from "next/link";
import { AppLayout } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@/components/ui";
import { getLessonById, getCategoryById } from "@/data";

interface LessonDetailPageProps {
  params: Promise<{
    lessonId: string;
  }>;
}

export default async function LessonDetailPage({
  params,
}: LessonDetailPageProps) {
  const { lessonId } = await params;
  const lesson = await getLessonById(lessonId);

  if (!lesson) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold text-[#0F172A]">
            ไม่พบบทเรียนที่ระบุ
          </h1>
          <p className="text-[#64748B]">รหัสบทเรียน: {lessonId}</p>
          <Link href="/lessons">
            <Button variant="outline">← กลับสู่หน้ารายการบทเรียน</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const category = await getCategoryById(lesson.categoryId);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <Link href="/lessons" className="hover:text-[#0F172A]">
            บทเรียน
          </Link>
          <span>/</span>
          <span>{category?.name || "หมวดหมู่"}</span>
          <span>/</span>
          <span className="font-semibold text-[#0F172A]">
            {lesson.word}
          </span>
        </div>

        {/* Lesson Header Banner */}
        <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="primary">{category?.name || "หมวดหมู่"}</Badge>
              <Badge variant={lesson.gestureType === "dynamic" ? "tag" : "outline"}>
                {lesson.gestureType === "dynamic" ? "ท่าทางต่อเนื่อง (Dynamic)" : "ท่าทางคงที่ (Static)"}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-[#0F172A]">
              {lesson.word}
            </h1>
            <p className="text-sm text-[#64748B] leading-relaxed max-w-xl">
              {lesson.description}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link href="/practice">
              <Button size="lg" className="shadow-xs font-semibold">
                <span>เริ่มฝึกท่านี้ด้วย AI</span>
                <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Button>
            </Link>
          </div>
        </div>

        {/* Gesture Display Area Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">พื้นที่แสดงท่าภาษามือ</CardTitle>
                  <span className="text-xs text-[#64748B]">Gesture View</span>
                </div>
                <CardDescription>
                  คำอธิบายท่าทาง: {lesson.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full rounded-xl bg-[#F8FAFC] flex flex-col items-center justify-center text-center p-6 text-[#64748B] border border-dashed border-[#CBD5E1]">
                  <div className="h-14 w-14 rounded-xl bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] flex items-center justify-center mb-3">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    พื้นที่แสดงท่าภาษามือ: {lesson.word}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1 max-w-sm">
                    {lesson.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ข้อมูลบทเรียน</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-[#475569]">
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <span className="font-semibold text-[#0F172A] block mb-1">
                    ประเภทการตรวจจับ
                  </span>
                  {lesson.gestureType === "dynamic" ? "ท่าทางต่อเนื่อง (Dynamic Gesture)" : "ท่าทางคงที่ (Static Gesture)"}
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <span className="font-semibold text-[#0F172A] block mb-1">
                    คำแนะนำ
                  </span>
                  {lesson.description}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
