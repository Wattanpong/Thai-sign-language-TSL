import Link from "next/link";
import { AppLayout } from "@/components/layout";
import { Button, Badge } from "@/components/ui";
import { HomeCategoriesSection } from "@/components/home/HomeCategoriesSection";
import { getCategories, getLessons } from "@/data";

export default async function Home() {
  const categories = await getCategories();
  const lessons = await getLessons();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-10 sm:space-y-12">
        {/* HERO SECTION */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 lg:p-10 border border-[#E2E8F0] space-y-6 shadow-2xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              <Badge variant="default">
                ระบบเรียนรู้ภาษามือไทยออนไลน์
              </Badge>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F172A] leading-tight">
                  เรียนภาษามือไทยกับ AI
                </h1>
                <p className="text-sm sm:text-base text-[#475569] leading-relaxed max-w-xl">
                  ฝึกทำท่าทางภาษามือไทยผ่านกล้อง พร้อมรับผลการตรวจความถูกต้องทันที
                </p>
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-4">
                <Link href="/lessons">
                  <Button size="lg" className="font-medium px-6 shadow-xs">
                    <span>เริ่มเรียนเลย</span>
                    <span aria-hidden="true" className="ml-1">→</span>
                  </Button>
                </Link>

                <Link
                  href="/practice"
                  className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] inline-flex items-center gap-1.5 transition-colors py-1.5"
                >
                  <span>หรือฝึกทำท่าทาง</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* Visual Hero Preview Card */}
            <div className="lg:col-span-5">
              <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-[#334155]">
                      AI Gesture Engine
                    </span>
                  </div>
                  <span className="text-[11px] text-[#64748B]">
                    Real-time
                  </span>
                </div>

                <div className="aspect-4/3 rounded-xl bg-white flex flex-col items-center justify-center text-center p-4 border border-[#E2E8F0] text-[#64748B]">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] flex items-center justify-center mb-2">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-[#0F172A]">
                    ตรวจจับโครงสร้างมือผ่านกล้อง
                  </p>
                  <p className="text-[11px] text-[#64748B] mt-0.5 max-w-xs">
                    รองรับทั้งท่าทางคงที่และท่าทางต่อเนื่อง
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* REAL-TIME STATS & CATEGORIES SECTION */}
        <HomeCategoriesSection
          initialCategories={categories}
          initialLessons={lessons}
        />

        {/* LEARNING FLOW (3 STEPS) */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] space-y-6 shadow-2xs">
          <div className="space-y-0.5">
            <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">
              3 ขั้นตอนง่ายๆ
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              เข้าใจ จดจำ และฝึกปฏิบัติจริง
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="p-4 sm:p-5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] space-y-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs">
                1
              </span>
              <h3 className="font-semibold text-[#0F172A] text-sm pt-0.5">
                เลือกบทเรียน
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                เลือกคำศัพท์ภาษามือที่ต้องการศึกษาตามหมวดหมู่
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 sm:p-5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] space-y-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs">
                2
              </span>
              <h3 className="font-semibold text-[#0F172A] text-sm pt-0.5">
                ดูท่าทางต้นแบบ
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                สังเกตรูปแบบมือและทิศทางการเคลื่อนไหวที่ถูกต้อง
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 sm:p-5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] space-y-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs">
                3
              </span>
              <h3 className="font-semibold text-[#0F172A] text-sm pt-0.5">
                ฝึกกับ AI
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                เปิดกล้อง ทำท่าทาง และรับผลประเมินแบบทันที
              </p>
            </div>
          </div>
        </section>

        {/* CALL TO ACTION (CTA) BANNER */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] text-center space-y-4 shadow-2xs">
          <div className="max-w-xl mx-auto space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
              ค้นหาคำศัพท์ในพจนานุกรม
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              สืบค้นคำศัพท์และดูตัวอย่างท่าทางภาษามือไทยได้อย่างสะดวกรวดเร็ว
            </p>
          </div>

          <div className="flex justify-center">
            <Link href="/dictionary">
              <Button size="lg" variant="outline" className="font-medium px-7">
                เปิดพจนานุกรม
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
