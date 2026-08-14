"use client";

import * as React from "react";
import { Lesson, ReferenceGesture } from "@/types";
import {
  getReferencesByLessonId,
  deleteReference,
  setPrimaryReference,
} from "@/lib/storage/referenceStorage";
import { ReferenceRecorder } from "./ReferenceRecorder";
import { ReferenceInspector } from "./ReferenceInspector";
import { Card, Button, Badge } from "@/components/ui";

export interface ReferenceManagerProps {
  lesson: Lesson;
}

export function ReferenceManager({ lesson }: ReferenceManagerProps) {
  const [references, setReferences] = React.useState<ReferenceGesture[]>([]);
  const [activeGesture, setActiveGesture] = React.useState<ReferenceGesture | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [mode, setMode] = React.useState<"list" | "recorder" | "inspector">("list");
  const [notification, setNotification] = React.useState<{ message: string; type: "success" | "error" } | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function fetchRefs() {
      try {
        const list = await getReferencesByLessonId(lesson.id);
        if (!isMounted) return;
        setReferences(list);
        setIsLoaded(true);
        if (list.length === 0) {
          setMode("recorder");
        }
      } catch {
        if (!isMounted) return;
        setIsLoaded(true);
      }
    }

    fetchRefs();

    return () => {
      isMounted = false;
    };
  }, [lesson.id]);

  const loadReferences = React.useCallback(async () => {
    try {
      const list = await getReferencesByLessonId(lesson.id);
      setReferences(list);
      setIsLoaded(true);
      if (list.length === 0) {
        setMode("recorder");
      }
    } catch {
      setIsLoaded(true);
    }
  }, [lesson.id]);

  const handleSetPrimary = async (refId: string) => {
    try {
      await setPrimaryReference(lesson.id, refId);
      setNotification({ message: "ตั้งเป็น Reference หลักเรียบร้อยแล้ว", type: "success" });
      await loadReferences();
    } catch {
      setNotification({ message: "เกิดข้อผิดพลาดในการตั้ง Reference หลัก", type: "error" });
    }
  };

  const handleDelete = async (ref: ReferenceGesture) => {
    if (!confirm(`คุณต้องการลบ Reference ตัวอย่าง (${ref.id}) ของคำว่า "${lesson.word}" ใช่หรือไม่?`)) {
      return;
    }

    try {
      await deleteReference(ref.id);
      setNotification({ message: `ลบ Reference ตัวอย่างเรียบร้อยแล้ว`, type: "success" });
      await loadReferences();
    } catch {
      setNotification({ message: "เกิดข้อผิดพลาดในการลบข้อมูล", type: "error" });
    }
  };

  if (!isLoaded) {
    return (
      <div className="p-12 text-center text-slate-400">
        <span className="animate-spin inline-block mr-2">⟳</span>
        กำลังโหลดชุดข้อมูล Reference Gesture...
      </div>
    );
  }

  // 1. Inspector View (Inspect a specific reference)
  if (mode === "inspector" && activeGesture) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("list")}
          >
            ← กลับสู่รายการ Reference ทั้งหมด
          </Button>
          <span className="text-xs text-[#64748B] font-mono">
            ID: {activeGesture.id}
          </span>
        </div>

        <ReferenceInspector
          gesture={activeGesture}
          lesson={lesson}
          onReRecord={() => setMode("recorder")}
          onDelete={async () => {
            await handleDelete(activeGesture);
            setMode("list");
          }}
        />
      </div>
    );
  }

  // 2. Recorder View (Record a new reference)
  if (mode === "recorder") {
    return (
      <ReferenceRecorder
        lesson={lesson}
        onSaved={async () => {
          setNotification({ message: "บันทึก Reference Gesture ตัวอย่างใหม่สำเร็จ", type: "success" });
          await loadReferences();
          setMode("list");
        }}
        onCancel={() => setMode("list")}
      />
    );
  }

  // 3. Multi-Reference List / Dashboard View
  const bestQuality = references.reduce(
    (max, r) => Math.max(max, r.qualityScore ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Notification banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <span>{notification.type === "success" ? "✓" : "⚠️"} {notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dataset Summary & Action Bar */}
      <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="font-bold text-base text-[#0F172A]">
              ชุดตัวอย่างท่าทางอ้างอิง (Reference Dataset)
            </h3>
            <Badge variant="tag">
              {references.length} ตัวอย่าง
            </Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            มี Reference หลากหลายตัวอย่างช่วยให้ AI ประเมินผู้เรียนได้แม่นยำและลดความลำเอียง
            {bestQuality > 0 && ` • คุณภาพสูงสุดในชุด: ${bestQuality}%`}
          </p>
        </div>

        <Button
          variant="amber"
          size="md"
          onClick={() => setMode("recorder")}
          className="font-bold shadow-xs"
        >
          + บันทึกตัวอย่างเพิ่ม (Add Example)
        </Button>
      </div>

      {/* List of References */}
      {references.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <p className="text-sm text-slate-500">
            ยังไม่มี Reference Gesture ต้นแบบสำหรับคำว่า &quot;{lesson.word}&quot;
          </p>
          <Button
            variant="amber"
            onClick={() => setMode("recorder")}
            className="font-semibold"
          >
            เริ่มบันทึกตัวอย่างแรก
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {references.map((ref, index) => {
            const qualityScore = ref.qualityScore ?? (ref.qualityLevel === "good" ? 95 : ref.qualityLevel === "fair" ? 70 : 40);
            const isGood = qualityScore >= 80;
            const isFair = qualityScore >= 50 && qualityScore < 80;

            return (
              <Card
                key={ref.id}
                className={`p-5 transition-all ${
                  ref.isPrimary
                    ? "border-[#FFB400] bg-amber-50/20 shadow-xs ring-1 ring-[#FFB400]/40"
                    : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Reference Info */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-[#0F172A]">
                        ตัวอย่าง #{index + 1}
                      </span>

                      {ref.isPrimary && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FFB400] text-[#0F172A] shadow-xs">
                          ★ Reference หลัก (Primary)
                        </span>
                      )}

                      <Badge
                        variant={isGood ? "success" : isFair ? "warning" : "outline"}
                      >
                        {isGood && `🟢 คุณภาพดี (${qualityScore}%)`}
                        {isFair && `🟡 คุณภาพพอใช้ (${qualityScore}%)`}
                        {!isGood && !isFair && `🔴 ควรบันทึกใหม่ (${qualityScore}%)`}
                      </Badge>

                      {ref.metadata?.source && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {ref.metadata.source === "seed" ? "Built-in Seed" : "Webcam Recorded"}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                      <span>ความยาว: <strong className="text-[#0F172A]">{(ref.durationMs / 1000).toFixed(1)} วินาที</strong> ({ref.frameCount} เฟรม)</span>
                      <span>บันทึกเมื่อ: <strong className="text-[#0F172A]">{new Date(ref.createdAt).toLocaleDateString("th-TH")}</strong></span>
                      <span className="font-mono text-[11px] text-slate-400">ID: {ref.id}</span>
                    </div>

                    {ref.metadata?.label && (
                      <p className="text-xs text-[#475569] italic">
                        &quot;{ref.metadata.label}&quot;
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!ref.isPrimary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(ref.id)}
                        className="text-amber-800 border-amber-300 hover:bg-amber-50 text-xs"
                      >
                        ★ ตั้งเป็นหลัก
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveGesture(ref);
                        setMode("inspector");
                      }}
                      className="text-xs"
                    >
                      🔍 ตรวจสอบคุณภาพ
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(ref)}
                      className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                    >
                      ลบ
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
