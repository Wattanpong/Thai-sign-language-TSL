"use client";

import * as React from "react";
import { Category, Lesson } from "@/types";
import { StatisticsCard, CategoryCard } from "@/components/ui";
import { getCategories } from "@/lib/storage/categoryStorage";
import { getLessons } from "@/lib/storage/lessonStorage";

interface HomeCategoriesSectionProps {
  initialCategories: Category[];
  initialLessons: Lesson[];
}

export function HomeCategoriesSection({
  initialCategories,
  initialLessons,
}: HomeCategoriesSectionProps) {
  const [categories, setCategories] = React.useState<Category[]>(initialCategories);
  const [lessons, setLessons] = React.useState<Lesson[]>(initialLessons);

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
        // fallback
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

  return (
    <>
      {/* STATISTICS SECTION */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <StatisticsCard
          label="คำศัพท์"
          value={`${lessons.length}+`}
          description="คำศัพท์พร้อมตัวอย่างท่าทาง"
        />
        <StatisticsCard
          label="หมวดหมู่"
          value={`${categories.length}+`}
          description="จัดกลุ่มตามการใช้งานจริง"
        />
        <StatisticsCard
          label="ตรวจท่าทาง"
          value="AI Realtime"
          description="ประเมินผลผ่านกล้องทันที"
        />
      </section>

      {/* LEARNING CATEGORIES SECTION */}
      <section className="space-y-4">
        <div className="border-b border-[#E2E8F0] pb-2.5">
          <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">
            หมวดหมู่บทเรียน
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            เลือกหมวดหมู่ที่ต้องการศึกษา
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
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

    </>
  );
}
