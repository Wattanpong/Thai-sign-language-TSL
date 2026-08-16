"use client";

import * as React from "react";
import { PracticeEvaluationResult } from "@/lib/practice/practiceEngine";
import { Button, Badge } from "@/components/ui";

interface PracticeResultCardProps {
  result: PracticeEvaluationResult | null;
  word: string;
  onReset: () => void;
  isStandby?: boolean;
  statusMessage?: string;
}

export function PracticeResultCard({
  result,
  word,
  onReset,
  isStandby = false,
  statusMessage,
}: PracticeResultCardProps) {
  const getScoreGrade = (val: number) => {
    if (val >= 85) {
      return {
        label: "ยอดเยี่ยม (Excellent)",
        shortLabel: "ผ่านเกณฑ์ดีเยี่ยม",
        badge: "success" as const,
      };
    }
    if (val >= 70) {
      return {
        label: "ดีมาก (Good)",
        shortLabel: "ผ่านเกณฑ์",
        badge: "default" as const,
      };
    }
    if (val >= 50) {
      return {
        label: "พอใช้ (Fair)",
        shortLabel: "พอใช้",
        badge: "warning" as const,
      };
    }
    return {
      label: "ควรฝึกฝนเพิ่มเติม",
      shortLabel: "ควรฝึกเพิ่ม",
      badge: "outline" as const,
    };
  };

  // If no result or explicitly standby
  if (!result || isStandby) {
    const standbyItems = [
      { label: "รูปมือ (Shape)", weight: "20%" },
      { label: "มุมข้อนิ้ว (Angles)", weight: "15%" },
      { label: "การงอนิ้ว (Curls)", weight: "15%" },
      { label: "ทิศทางมือ (Palm)", weight: "15%" },
      { label: "ตำแหน่งมือ (Pos)", weight: "15%" },
      { label: "ความสัมพันธ์ 2 มือ", weight: "15%" },
      { label: "บริบทลำตัว (Pose)", weight: "5%" },
    ];

    return (
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-sm space-y-3.5 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#64748B]">แผงประเมินผล:</span>
              <span className="text-sm font-black text-[#0F172A]">&quot;{word}&quot;</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[11px] font-bold text-sky-700 bg-sky-50 border-sky-200">
                พร้อมสำหรับการประเมิน
              </Badge>
              <span className="text-[11px] text-[#64748B]">
                (เกณฑ์ &gt;= 70%)
              </span>
            </div>
          </div>

          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" title="ระบบ AI พร้อมประเมินผล" />
        </div>

        {/* Placeholder Score Cards Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white flex flex-col justify-center items-center shadow-xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              คะแนนรวม
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-300 leading-tight">
              --
              <span className="text-xs font-normal text-slate-500">/100</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-center items-center">
            <span className="text-[10px] text-[#64748B] font-medium">
              ความเชื่อมั่น AI
            </span>
            <div className="text-lg sm:text-xl font-bold text-slate-400 leading-tight">
              --%
            </div>
            <span className="text-[9px] text-[#94A3B8]">Landmarks Quality</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-center items-center">
            <span className="text-[10px] text-[#64748B] font-medium">
              เวลา / เฟรม
            </span>
            <div className="text-sm sm:text-base font-bold text-slate-400 leading-tight">
              --s
            </div>
            <span className="text-[9px] text-[#94A3B8]">-- เฟรม</span>
          </div>
        </div>

        {/* Feature Breakdown Placeholders */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
            <span>เกณฑ์ประเมิน 7 มิติ (Feature Breakdown):</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {standbyItems.map((item) => (
              <div
                key={item.label}
                className="p-1.5 sm:p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#64748B] truncate font-medium max-w-[90px] sm:max-w-[110px]" title={item.label}>
                    {item.label}
                  </span>
                  <span className="font-bold text-slate-400">
                    --%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-300 w-0" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Guidance Placeholder */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
            <span>💡 คำแนะนำจาก AI:</span>
          </div>

          <div className="p-3 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-xs text-[#0369A1] space-y-1">
            <p className="font-semibold">
              {statusMessage || "กดปุ่ม 'เริ่มฝึกท่า' ตรงกลาง แล้วทำท่าทางตามตัวอย่าง"}
            </p>
            <p className="text-[11px] text-[#0C4A6E] leading-relaxed">
              เมื่อทำท่าทางเสร็จสิ้น ให้กดปุ่ม &quot;⏹ หยุดและตรวจคะแนน&quot; ระบบ AI จะประมวลผลความแม่นยำและแสดงผลคะแนนทันทีที่นี่
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { score, userSequence, referenceSequence } = result;
  const grade = getScoreGrade(score.overallScore);
  const userDurationSec = (userSequence.durationMs / 1000).toFixed(1);
  const refDurationSec = (referenceSequence.durationMs / 1000).toFixed(1);

  const breakdownItems = [
    { label: "รูปมือ (Shape)", score: score.handShapeScore, weight: "20%" },
    { label: "มุมข้อนิ้ว (Angles)", score: score.fingerAngleScore, weight: "15%" },
    { label: "การงอนิ้ว (Curls)", score: score.fingerCurlScore, weight: "15%" },
    { label: "ทิศทางมือ (Palm)", score: score.palmOrientationScore, weight: "15%" },
    { label: "ตำแหน่งมือ (Pos)", score: score.handPositionScore, weight: "15%" },
    { label: "ความสัมพันธ์ 2 มือ", score: score.twoHandScore, weight: "15%" },
    { label: "บริบทลำตัว (Pose)", score: score.bodyContextScore, weight: "5%" },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-sm space-y-3.5 animate-fadeIn">
      {/* 1. Header with Word & Reset Button */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#64748B]">ผลประเมินคำว่า:</span>
            <span className="text-sm font-black text-[#0F172A]">&quot;{word}&quot;</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant={grade.badge} className="text-[11px] font-bold">
              {grade.shortLabel}
            </Badge>
            <span className="text-[11px] text-[#64748B]">
              (เกณฑ์ &gt;= 70%)
            </span>
          </div>
        </div>

        <Button
          variant="amber"
          size="sm"
          onClick={onReset}
          className="font-bold shadow-xs text-xs px-3.5 py-1.5 h-8 shrink-0 rounded-xl"
        >
          ↻ ฝึกใหม่อีกครั้ง
        </Button>
      </div>

      {/* 2. Compact Score Cards Grid (Single Horizontal Row) */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white flex flex-col justify-center items-center shadow-xs">
          <span className="text-[10px] uppercase tracking-wider text-slate-300 font-medium">
            คะแนนรวม
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#38BDF8] leading-tight">
            {score.overallScore}
            <span className="text-xs font-normal text-slate-400">/100</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-center items-center">
          <span className="text-[10px] text-[#64748B] font-medium">
            ความเชื่อมั่น AI
          </span>
          <div className="text-lg sm:text-xl font-bold text-[#0F172A] leading-tight">
            {Math.round(score.confidence * 100)}%
          </div>
          <span className="text-[9px] text-[#94A3B8]">Landmark Quality</span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-center items-center">
          <span className="text-[10px] text-[#64748B] font-medium">
            เวลา / เฟรม
          </span>
          <div className="text-sm sm:text-base font-bold text-[#0F172A] leading-tight">
            {userDurationSec}s
          </div>
          <span className="text-[9px] text-[#94A3B8]">
            {score.matchedFrames}f (ต้นแบบ {refDurationSec}s)
          </span>
        </div>
      </div>

      {/* 3. Feature Breakdown Mini Bars Grid (2 Columns) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
          <span>คะแนนย่อย 7 มิติ (Feature Breakdown):</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {breakdownItems.map((item) => (
            <div
              key={item.label}
              className="p-1.5 sm:p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#475569] truncate font-medium max-w-[90px] sm:max-w-[110px]" title={item.label}>
                  {item.label}
                </span>
                <span
                  className={`font-black ${
                    item.score >= 80
                      ? "text-emerald-700"
                      : item.score >= 60
                      ? "text-amber-700"
                      : "text-red-700"
                  }`}
                >
                  {item.score}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.score >= 80
                      ? "bg-emerald-500"
                      : item.score >= 60
                      ? "bg-amber-400"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Actionable AI Feedback Section */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
          <span className="flex items-center gap-1">
            <span>💡 คำแนะนำจาก AI:</span>
          </span>
          <span className="text-[11px] font-normal text-[#64748B]">
            {score.feedback.length} ข้อ
          </span>
        </div>

        {score.feedback.length === 0 ? (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <span className="text-sm">✓</span>
            <span className="font-medium">ยอดเยี่ยมมาก! ท่าทางและการเคลื่อนไหวตรงกับต้นแบบอย่างสมบูรณ์</span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {score.feedback.map((fb, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-xl border text-xs flex items-start gap-2 ${
                  fb.severity === "error"
                    ? "bg-red-50/90 border-red-200 text-red-900"
                    : fb.severity === "warning"
                    ? "bg-amber-50/90 border-amber-200 text-amber-900"
                    : "bg-blue-50/90 border-blue-200 text-blue-900"
                }`}
              >
                <span className="font-bold shrink-0 text-xs">
                  {fb.severity === "error" ? "⚠️" : fb.severity === "warning" ? "⚡" : "ℹ️"}
                </span>
                <p className="font-medium leading-tight flex-1">{fb.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
