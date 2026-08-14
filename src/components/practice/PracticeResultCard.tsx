"use client";

import * as React from "react";
import { PracticeEvaluationResult } from "@/lib/practice/practiceEngine";
import { Card, Button, Badge } from "@/components/ui";

interface PracticeResultCardProps {
  result: PracticeEvaluationResult;
  word: string;
  onReset: () => void;
}

export function PracticeResultCard({
  result,
  word,
  onReset,
}: PracticeResultCardProps) {
  const { score, userSequence, referenceSequence } = result;

  const getScoreGrade = (val: number) => {
    if (val >= 85) {
      return {
        label: "ยอดเยี่ยม (Excellent)",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        badge: "success" as const,
      };
    }
    if (val >= 70) {
      return {
        label: "ดีมาก (Good)",
        color: "text-blue-700 bg-blue-50 border-blue-200",
        badge: "default" as const,
      };
    }
    if (val >= 50) {
      return {
        label: "พอใช้ (Fair)",
        color: "text-amber-700 bg-amber-50 border-amber-200",
        badge: "warning" as const,
      };
    }
    return {
      label: "ควรฝึกฝนเพิ่มเติม (Needs Practice)",
      color: "text-red-700 bg-red-50 border-red-200",
      badge: "outline" as const,
    };
  };

  const grade = getScoreGrade(score.overallScore);
  const userDurationSec = (userSequence.durationMs / 1000).toFixed(1);
  const refDurationSec = (referenceSequence.durationMs / 1000).toFixed(1);

  const breakdownItems = [
    { label: "รูปมือ (Hand Shape)", score: score.handShapeScore, weight: "20%" },
    { label: "มุมข้อนิ้ว (Finger Angles)", score: score.fingerAngleScore, weight: "15%" },
    { label: "การงอนิ้ว (Finger Curls)", score: score.fingerCurlScore, weight: "15%" },
    { label: "ทิศทางฝ่ามือ (Palm Orientation)", score: score.palmOrientationScore, weight: "15%" },
    { label: "ตำแหน่งมือ (Hand Position)", score: score.handPositionScore, weight: "15%" },
    { label: "ความสัมพันธ์ 2 มือ (Two-Hand)", score: score.twoHandScore, weight: "15%" },
    { label: "บริบทศีรษะ/ลำตัว (Body Context)", score: score.bodyContextScore, weight: "5%" },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Score Header Card */}
      <Card className="p-6 sm:p-8 bg-white border border-[#E2E8F0] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="tag">ผลการประเมินท่าทาง AI</Badge>
              <Badge variant={grade.badge}>{grade.label}</Badge>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
              การฝึกฝนคำว่า &quot;{word}&quot;
            </h3>
          </div>

          <Button variant="amber" size="md" onClick={onReset} className="font-semibold shadow-xs">
            ↻ ฝึกฝนใหม่อีกครั้ง (Try Again)
          </Button>
        </div>

        {/* Score & Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white flex flex-col justify-center items-center text-center shadow-xs">
            <span className="text-xs uppercase tracking-wider text-slate-300 font-medium mb-1">
              คะแนนความถูกต้องรวม
            </span>
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-[#FFB400]">
              {score.overallScore}
              <span className="text-xl font-normal text-slate-400">/100</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-center">
            <span className="text-xs text-[#64748B] font-medium mb-1">
              ระดับความเชื่อมั่นของ AI
            </span>
            <div className="text-2xl font-bold text-[#0F172A]">
              {Math.round(score.confidence * 100)}%
            </div>
            <span className="text-[11px] text-[#94A3B8] mt-0.5">
              ประเมินจากความสมบูรณ์ของ Landmark
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-center">
            <span className="text-xs text-[#64748B] font-medium mb-1">
              ข้อมูลการเคลื่อนไหว (DTW Frames)
            </span>
            <div className="text-2xl font-bold text-[#0F172A]">
              {score.matchedFrames} <span className="text-sm font-normal text-[#64748B]">เฟรม</span>
            </div>
            <span className="text-[11px] text-[#94A3B8] mt-0.5">
              เวลา: {userDurationSec}s (ต้นแบบ: {refDurationSec}s)
            </span>
          </div>
        </div>

        {/* Feature Breakdown Progress Bars */}
        <div className="space-y-4 pt-2">
          <h4 className="font-bold text-sm text-[#0F172A]">
            รายละเอียดคะแนนแต่ละองค์ประกอบ (Feature Breakdown)
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {breakdownItems.map((item) => (
              <div key={item.label} className="space-y-1.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F172A]">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#64748B]">({item.weight})</span>
                    <span
                      className={`font-bold ${
                        item.score >= 80
                          ? "text-emerald-700"
                          : item.score >= 60
                          ? "text-amber-700"
                          : "text-red-700"
                      }`}
                    >
                      {item.score}
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.score >= 80
                        ? "bg-emerald-500"
                        : item.score >= 60
                        ? "bg-amber-400"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actionable Thai Feedback Section */}
        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
            <span>คำแนะนำเฉพาะจุดจาก AI (Actionable Feedback)</span>
            <span className="text-xs font-normal text-[#64748B]">
              ({score.feedback.length} ข้อความ)
            </span>
          </h4>

          {score.feedback.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <span className="text-base">✓</span>
              <span>ยอดเยี่ยมมาก! ท่าทางและการเคลื่อนไหวตรงกับต้นแบบอย่างสมบูรณ์แบบ</span>
            </div>
          ) : (
            <div className="space-y-2">
              {score.feedback.map((fb, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    fb.severity === "error"
                      ? "bg-red-50/80 border-red-200 text-red-900"
                      : fb.severity === "warning"
                      ? "bg-amber-50/80 border-amber-200 text-amber-900"
                      : "bg-blue-50/80 border-blue-200 text-blue-900"
                  }`}
                >
                  <span className="font-bold shrink-0 mt-0.5">
                    {fb.severity === "error" ? "⚠️" : fb.severity === "warning" ? "⚡" : "ℹ️"}
                  </span>
                  <div className="space-y-0.5 flex-1">
                    <p className="font-semibold leading-relaxed">{fb.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
