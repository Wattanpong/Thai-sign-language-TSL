"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Lesson } from "@/types";
import { getLessonById } from "@/lib/storage/lessonStorage";
import { PageHeader, Button } from "@/components/ui";
import { ReferenceManager } from "./ReferenceManager";

interface Props {
  lessonId: string;
  initialLesson: Lesson | null;
}

export function AdminLessonReferenceContainer({
  lessonId,
  initialLesson,
}: Props) {
  const [lesson, setLesson] = useState<Lesson | null>(initialLesson);
  const [loading, setLoading] = useState<boolean>(!initialLesson);

  useEffect(() => {
    async function loadLesson() {
      if (!initialLesson) {
        let cleanId = lessonId;
        try {
          cleanId = decodeURIComponent(lessonId);
        } catch {
          // ignore
        }
        const found = await getLessonById(cleanId);
        setLesson(found);
        setLoading(false);
      }
    }
    loadLesson();
  }, [lessonId, initialLesson]);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-[#64748B] animate-pulse">
        กำลังโหลดข้อมูลบทเรียน...
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="space-y-6">
        <PageHeader
          badge="ไม่พบข้อมูล"
          title="ไม่พบบทเรียนที่ระบุ"
          description={`รหัสบทเรียน: ${lessonId}`}
          action={
            <Link href="/admin/lessons">
              <Button variant="outline" size="sm">
                ← กลับสู่รายการบทเรียน
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader

        badge="Reference Gesture Management"
        title={`จัดการท่าทางอ้างอิง: "${lesson.word}"`}
        description="ระบบบันทึกและตรวจสอบคุณภาพของ Reference Gesture ต้นแบบสำหรับบทเรียนภาษามือไทย"
        action={
          <Link href="/admin/lessons">
            <Button variant="outline" size="sm">
              ← กลับสู่รายการบทเรียน
            </Button>
          </Link>
        }
      />

      <ReferenceManager lesson={lesson} />
    </div>
  );
}
