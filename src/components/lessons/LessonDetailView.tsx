"use client";

import * as React from "react";
import Link from "next/link";
import { Lesson, Category } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@/components/ui";
import { getLessonById } from "@/lib/storage/lessonStorage";
import { getCategoryById } from "@/lib/storage/categoryStorage";

interface LessonDetailViewProps {
  lessonId: string;
  initialLesson: Lesson | null;
  initialCategory: Category | null;
}

export function LessonDetailView({
  lessonId,
  initialLesson,
  initialCategory,
}: LessonDetailViewProps) {
  const [lesson, setLesson] = React.useState<Lesson | null>(initialLesson);
  const [category, setCategory] = React.useState<Category | null>(initialCategory);
  const [isLoading, setIsLoading] = React.useState<boolean>(!initialLesson);

  React.useEffect(() => {
    let isMounted = true;

    const loadLessonData = async () => {
      try {
        const loadedLesson = await getLessonById(lessonId);
        if (!isMounted) return;

        setLesson(loadedLesson);
        if (loadedLesson) {
          const loadedCat = await getCategoryById(loadedLesson.categoryId);
          if (isMounted) setCategory(loadedCat);
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadLessonData();

    const handleStorageChange = () => {
      loadLessonData();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [lessonId]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-12 text-center space-y-3 animate-fadeIn">
        <div className="w-7 h-7 border-2 border-[#0EA5E9] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#64748B]">กำลังโหลดข้อมูลบทเรียน...</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 sm:py-12 text-center space-y-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
          ไม่พบบทเรียนที่ระบุ
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B]">รหัสบทเรียน: {lessonId}</p>
        <Link href="/lessons">
          <Button variant="outline" size="sm">← กลับสู่หน้ารายการบทเรียน</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6 sm:space-y-7">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#64748B]">
        <Link href="/lessons" className="hover:text-[#0F172A] transition-colors">
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
      <div className="bg-white rounded-2xl p-5 sm:p-6 lg:p-8 border border-[#E2E8F0] flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6 shadow-2xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="default">{category?.name || "หมวดหมู่"}</Badge>
            <Badge variant={lesson.gestureType === "dynamic" ? "primary" : "outline"}>
              {lesson.gestureType === "dynamic" ? "ท่าทางต่อเนื่อง" : "ท่าทางคงที่"}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
            {lesson.word}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed max-w-xl">
            {lesson.description}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href={`/practice?lesson=${lesson.id}`}>
            <Button size="lg" className="font-medium px-6 shadow-xs">
              <span>ฝึกท่านี้กับ AI</span>
              <span aria-hidden="true" className="ml-1">→</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Gesture Display Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base">ท่าทางตัวอย่าง</CardTitle>
                <span className="text-[11px] text-[#94A3B8]">Reference</span>
              </div>
              <CardDescription className="text-xs">
                {lesson.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <div className="aspect-video w-full rounded-xl bg-[#F8FAFC] flex flex-col items-center justify-center text-center p-4 sm:p-5 text-[#64748B] border border-[#E2E8F0]">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] mb-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[#0F172A]">
                  {lesson.word}
                </p>
                <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5 max-w-sm">
                  {lesson.description}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-5">
              <CardTitle className="text-sm sm:text-base">ข้อมูลบทเรียน</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0 space-y-2 text-xs text-[#475569]">
              <div className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#0F172A] block mb-0.5">
                  ลักษณะท่าทาง
                </span>
                {lesson.gestureType === "dynamic" ? "ท่าทางต่อเนื่อง (Dynamic)" : "ท่าทางคงที่ (Static)"}
              </div>
              <div className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#0F172A] block mb-0.5">
                  คำอธิบาย
                </span>
                {lesson.description}
              </div>
              <div className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#0F172A] block mb-0.5">
                  รหัสบทเรียน
                </span>
                #{lesson.id}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
