import Link from "next/link";
import { AppLayout } from "@/components/layout";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/components/ui";
import { getCategories, getLessons } from "@/data";

export default async function LessonsPage() {
  const categories = await getCategories();
  const lessons = await getLessons();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-10">
        {/* Page Header */}
        <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-xs space-y-4">
          <Badge variant="tag">
            คลังบทเรียนภาษามือไทย
          </Badge>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
              บทเรียนทั้งหมด
            </h1>
            <p className="text-sm text-[#64748B]">
              เลือกหมวดหมู่และบทเรียนเพื่อศึกษาท่าทางภาษามือไทยที่ถูกต้องและเตรียมความพร้อมสู่การฝึกซ้อม
            </p>
          </div>
        </div>

        {/* Category Filter Area */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#64748B] mr-1">
            หมวดหมู่:
          </span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F172A] text-white">
            ทั้งหมด ({lessons.length})
          </span>
          {categories.map((cat) => {
            const count = lessons.filter((l) => l.categoryId === cat.id).length;
            return (
              <span
                key={cat.id}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-[#475569] border border-[#CBD5E1] hover:bg-[#F8FAFC] transition-colors"
              >
                {cat.name} ({count})
              </span>
            );
          })}
        </div>

        {/* Lessons Grouped by Category */}
        <div className="space-y-10">
          {categories.map((category) => {
            const categoryLessons = lessons.filter(
              (l) => l.categoryId === category.id
            );

            return (
              <section key={category.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A]">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="default">{categoryLessons.length} บทเรียน</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {categoryLessons.map((lesson) => (
                    <Card
                      key={lesson.id}
                      className="group flex flex-col justify-between hover:border-[#FFB400] transition-all shadow-xs hover:shadow-sm"
                    >
                      <CardHeader className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <Badge
                            variant={
                              lesson.gestureType === "dynamic"
                                ? "primary"
                                : "outline"
                            }
                          >
                            {lesson.gestureType === "dynamic"
                              ? "ท่าทางต่อเนื่อง"
                              : "ท่าทางคงที่"}
                          </Badge>
                          <span className="text-[11px] font-mono text-[#94A3B8]">
                            #{lesson.id}
                          </span>
                        </div>
                        <CardTitle className="text-lg text-[#0F172A] group-hover:text-[#B45309] transition-colors">
                          {lesson.word}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">
                          {lesson.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-6 pt-0">
                        <Link
                          href={`/lessons/${lesson.id}`}
                          className="block w-full"
                        >
                          <Button variant="outline" size="sm" className="w-full font-medium">
                            <span>เรียนรู้บทเรียน</span>
                            <svg
                              className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform"
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
