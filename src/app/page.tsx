import Link from "next/link";
import { AppLayout } from "@/components/layout";
import {
  Button,
  Badge,
  StatisticsCard,
  CategoryCard,
} from "@/components/ui";
import { getCategories, getLessons } from "@/data";

export default async function Home() {
  const categories = await getCategories();
  const lessons = await getLessons();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-12">
        {/* HERO SECTION */}
        <section className="bg-white rounded-2xl p-8 sm:p-10 border border-[#E2E8F0] shadow-xs space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <Badge variant="tag">
                ระบบเรียนรู้ภาษามือไทยออนไลน์
              </Badge>

              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A] leading-tight">
                  แพลตฟอร์มการเรียนรู้และฝึกฝนภาษามือไทย
                </h1>
                <p className="text-base text-[#475569] leading-relaxed max-w-2xl">
                  เรียนรู้คำศัพท์ภาษามือไทย ฝึกทำท่าทาง และตรวจสอบการทำท่าด้วย AI เพื่อการสื่อสารที่มีประสิทธิภาพและเข้าถึงได้ทุกคน
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link href="/lessons">
                  <Button size="lg" className="shadow-xs font-medium">
                    <span>เริ่มเรียน</span>
                    <svg
                      className="w-4 h-4 ml-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </Button>
                </Link>

                <Link href="/practice">
                  <Button variant="outline" size="lg">
                    <span>ฝึกภาษามือ</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Visual Hero Preview Card */}
            <div className="lg:col-span-5">
              <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-[#334155]">
                      ระบบประเมินท่าทาง AI
                    </span>
                  </div>
                  <span className="text-[10px] font-mono bg-[#FFFBEB] text-[#92400E] px-2 py-0.5 rounded font-semibold border border-[#FDE68A]">
                    Real-time
                  </span>
                </div>

                <div className="aspect-4/3 rounded-lg bg-white flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#CBD5E1] text-[#64748B]">
                  <div className="h-12 w-12 rounded-xl bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] flex items-center justify-center mb-3">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-[#0F172A]">
                    AI Gesture Tracking Viewport
                  </p>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    รองรับทั้งท่าทางคงที่ (Static) และท่าทางต่อเนื่อง (Dynamic)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATISTICS SECTION */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatisticsCard
            label="คำศัพท์ทั้งหมด"
            value={`${lessons.length}+`}
            description="คำศัพท์ภาษามือไทยพร้อมคำอธิบายและตัวอย่างท่าทาง"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />
          <StatisticsCard
            label="หมวดหมู่บทเรียน"
            value={`${categories.length}+`}
            description="จัดกลุ่มตามหมวดหมู่พยัญชนะ ตัวเลข และการสนทนาในชีวิตจริง"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
          />
          <StatisticsCard
            label="การฝึกซ้อมด้วย AI"
            value="Realtime"
            description="ระบบประเมินความถูกต้องของท่าทางภาษามือผ่านกล้อง"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
          />
        </section>

        {/* LEARNING CATEGORIES SECTION */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-xl font-bold text-[#0F172A]">
                หมวดหมู่บทเรียนภาษามือไทย
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                เลือกหมวดหมู่ที่ต้องการศึกษาและฝึกฝน
              </p>
            </div>
            <Link
              href="/lessons"
              className="text-xs font-semibold text-[#B45309] hover:underline"
            >
              ดูทั้งหมด ({categories.length} หมวด) →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const categoryLessons = lessons.filter(
                (l) => l.categoryId === category.id
              );
              return (
                <CategoryCard
                  key={category.id}
                  id={category.id}
                  name={category.name}
                  description={category.description}
                  order={category.order}
                  lessonCount={categoryLessons.length}
                />
              );
            })}
          </div>
        </section>

        {/* LEARNING FLOW (3 STEPS) */}
        <section className="bg-white rounded-2xl p-8 sm:p-10 border border-[#E2E8F0] shadow-xs space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
              เรียนรู้ได้ง่ายใน 3 ขั้นตอน
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              ขั้นตอนการเรียนรู้ภาษามือไทยที่ออกแบบมาเพื่อความเข้าใจและฝึกปฏิบัติจริง
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs shadow-xs">
                  1
                </span>
                <h3 className="font-semibold text-[#0F172A] text-base">
                  เรียนรู้คำศัพท์
                </h3>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                เลือกบทเรียนและศึกษาความหมายของคำศัพท์ภาษามือไทยที่สนใจตามหมวดหมู่
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs shadow-xs">
                  2
                </span>
                <h3 className="font-semibold text-[#0F172A] text-base">
                  ดูและทำความเข้าใจท่าทาง
                </h3>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                ศึกษาตัวอย่างท่าทางภาษามือที่ถูกต้อง สังเกตตำแหน่งมือและทิศทางการเคลื่อนไหว
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs shadow-xs">
                  3
                </span>
                <h3 className="font-semibold text-[#0F172A] text-base">
                  ฝึกทำท่าผ่านกล้อง AI
                </h3>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                เปิดกล้องและทดสอบทำท่าทางตามตัวอย่าง พร้อมรับผลการประเมินความถูกต้องทันที
              </p>
            </div>
          </div>
        </section>

        {/* CALL TO ACTION (CTA) BANNER */}
        <section className="bg-[#FFFBEB] rounded-2xl p-8 sm:p-10 border border-[#FDE68A] text-center space-y-5">
          <div className="max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-[#0F172A]">
              พร้อมที่จะเริ่มต้นเรียนรู้ภาษามือไทยแล้วหรือยัง?
            </h2>
            <p className="text-sm text-[#64748B]">
              เข้าถึงบทเรียนและคลังคำศัพท์ภาษามือไทยได้ฟรี เริ่มต้นก้าวแรกสู่การสื่อสารที่ไร้อุปสรรค
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <Link href="/lessons">
              <Button size="lg" variant="amber" className="shadow-xs font-semibold">
                เริ่มต้นเรียนรู้ทันที
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
