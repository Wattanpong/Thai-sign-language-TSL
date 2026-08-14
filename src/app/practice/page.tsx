import Link from "next/link";
import { AppLayout } from "@/components/layout";
import {
  Button,
  Card,
  Badge,
} from "@/components/ui";
import { PracticeSessionManager } from "@/components/practice";
import { getLessons } from "@/data";

export default async function PracticePage() {
  const lessons = await getLessons();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-10">
        {/* Practice Header Banner */}
        <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="tag">
              ระบบฝึกฝนภาษามือ AI Real-time
            </Badge>
            <div className="flex items-center gap-3">
              <Link href="/lessons">
                <Button variant="outline" size="sm">
                  ← ไปที่คลังบทเรียน
                </Button>
              </Link>
              <Link href="/admin/lessons/hello/reference">
                <Button variant="outline" size="sm" className="text-slate-600">
                  ⚙ บันทึกต้นแบบ (Admin)
                </Button>
              </Link>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
              ห้องฝึกภาษามือด้วย AI (Live Gesture Practice & Scoring)
            </h1>
            <p className="text-sm text-[#64748B]">
              ฝึกทำท่าทางภาษามือไทยผ่านกล้องเว็บแคม ระบบจะดึง Features จาก MediaPipe และเปรียบเทียบกับ Reference Gesture ด้วย Dynamic Time Warping (DTW) เพื่อให้คะแนนและคำแนะนำแบบ Real-time
            </p>
          </div>
        </div>

        {/* 3 Preparation Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs shadow-xs">
                1
              </span>
              <h2 className="font-semibold text-[#0F172A] text-base">
                1. เลือกคำศัพท์ & เปิดกล้อง
              </h2>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              เลือกคำศัพท์ที่ต้องการฝึกและกดปุ่ม &quot;เปิดกล้อง&quot; เพื่อเริ่มต้นการตรวจจับโครงสร้างมือและร่างกาย
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs shadow-xs">
                2
              </span>
              <h2 className="font-semibold text-[#0F172A] text-base">
                2. กดเริ่มฝึก & ทำท่าทาง
              </h2>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              กด &quot;เริ่มฝึกภาษามือ&quot; แล้วทำท่าทางตามคำอธิบายหรือต้นแบบอย่างเป็นธรรมชาติ
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs shadow-xs">
                3
              </span>
              <h2 className="font-semibold text-[#0F172A] text-base">
                3. หยุดฝึก & ดูผลคะแนน AI
              </h2>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              กด &quot;หยุดและตรวจคะแนน&quot; เพื่อดูคะแนนความถูกต้องแยกตามส่วน และคำแนะนำเฉพาะจุดจาก AI
            </p>
          </Card>
        </div>

        {/* Live Practice Manager Area */}
        <section className="space-y-4">
          <PracticeSessionManager lessons={lessons} initialLessonId="hello" />
        </section>
      </div>
    </AppLayout>
  );
}
