"use client";

import * as React from "react";
import Link from "next/link";
import { Category, Lesson } from "@/types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/components/ui";
import { getCategories } from "@/lib/storage/categoryStorage";
import { getLessons } from "@/lib/storage/lessonStorage";

interface LessonListProps {
  initialCategories: Category[];
  initialLessons: Lesson[];
}

export function LessonList({
  initialCategories,
  initialLessons,
}: LessonListProps) {
  const [categories, setCategories] = React.useState<Category[]>(initialCategories);
  const [lessons, setLessons] = React.useState<Lesson[]>(initialLessons);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);

  // Sync with storage on mount and storage changes
  React.useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [loadedCats, loadedLessons] = await Promise.all([
          getCategories(),
          getLessons(),
        ]);
        if (isMounted) {
          setCategories(loadedCats);
          setLessons(loadedLessons);
        }
      } catch {
        // keep initial
      }
    };

    loadData();

    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const filteredCategories = selectedCategoryId
    ? categories.filter((c) => c.id === selectedCategoryId)
    : categories;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Category Filter Area */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="tablist" aria-label="เลือกหมวดหมู่บทเรียน">
        <button
          type="button"
          onClick={() => setSelectedCategoryId(null)}
          className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
            selectedCategoryId === null
              ? "bg-[#0F172A] text-white font-medium shadow-xs"
              : "bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
          }`}
        >
          ทั้งหมด ({lessons.length})
        </button>
        {categories.map((cat) => {
          const count = lessons.filter((l) => l.categoryId === cat.id).length;
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#0F172A] text-white font-medium shadow-xs"
                  : "bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Lessons Grouped by Category */}
      <div className="space-y-6 sm:space-y-8">
        {filteredCategories.length === 0 ? (
          <div className="p-6 sm:p-8 text-center bg-white rounded-2xl border border-[#E2E8F0] space-y-1.5">
            <p className="text-sm font-semibold text-[#0F172A]">ไม่พบหมวดหมู่บทเรียน</p>
            <p className="text-xs text-[#64748B]">ยังไม่มีบทเรียนในหมวดหมู่นี้</p>
          </div>
        ) : (
          filteredCategories.map((category) => {
            const categoryLessons = lessons.filter(
              (l) => l.categoryId === category.id
            );

            return (
              <section key={category.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-[#0F172A]">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="default">{categoryLessons.length} คำ</Badge>
                </div>

                {categoryLessons.length === 0 ? (
                  <div className="p-4 sm:p-5 text-center bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">
                    ยังไม่มีบทเรียนในหมวดหมู่นี้
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {categoryLessons.map((lesson) => (
                      <Card
                        key={lesson.id}
                        className="group flex flex-col justify-between hover:border-[#CBD5E1] transition-colors"
                      >
                        <CardHeader className="p-4 sm:p-5">
                          <div className="flex items-center justify-between mb-2">
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
                            <span className="text-[11px] text-[#94A3B8]">
                              #{lesson.id}
                            </span>
                          </div>
                          <CardTitle className="text-sm sm:text-base text-[#0F172A]">
                            {lesson.word}
                          </CardTitle>
                          <CardDescription className="line-clamp-2 mt-0.5 text-xs">
                            {lesson.description}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="p-4 sm:p-5 pt-0">
                          <Link
                            href={`/lessons/${lesson.id}`}
                            className="block w-full"
                          >
                            <Button variant="outline" size="sm" className="w-full font-medium text-xs">
                              <span>เริ่มเรียน</span>
                              <span aria-hidden="true" className="ml-1">→</span>
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
