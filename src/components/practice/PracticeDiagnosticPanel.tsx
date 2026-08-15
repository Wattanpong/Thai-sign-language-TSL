"use client";

import * as React from "react";
import { ReferenceGesture } from "@/types";
import { PracticeEvaluationResult } from "@/lib/practice/practiceEngine";
import { LiveFeedbackResult } from "@/lib/practice/liveFeedback";
import { ScoreAnomalyReport } from "@/lib/practice/scoreAnomalyDetector";
import {
  getPracticeSessionRecords,
  clearPracticeSessionRecords,
  exportPracticeSessionsAsJSON,
  PracticeSessionRecord,
} from "@/lib/storage/practiceSessionStorage";
import { Card, Badge, Button } from "@/components/ui";

export interface DiagnosticStats {
  handsCount: number;
  hasLeftHand: boolean;
  hasRightHand: boolean;
  hasPose: boolean;
  fps: number;
  latencyMs: number;
}

export interface PracticeDiagnosticPanelProps {
  stats: DiagnosticStats;
  liveFrameCount: number;
  liveDurationSec: number;
  liveFeedback: LiveFeedbackResult | null;
  evaluationResult: PracticeEvaluationResult | null;
  anomalyReport: ScoreAnomalyReport | null;
  referenceCount: number;
  bestQualityScore: number;
  matchedReference: ReferenceGesture | null | undefined;
  lessonId: string;
}

export function PracticeDiagnosticPanel({
  stats,
  liveFrameCount,
  liveDurationSec,
  liveFeedback,
  evaluationResult,
  anomalyReport,
  referenceCount,
  bestQualityScore,
  matchedReference,
  lessonId,
}: PracticeDiagnosticPanelProps) {
  const [historyLogs, setHistoryLogs] = React.useState<PracticeSessionRecord[]>([]);
  const [activeTab, setActiveTab] = React.useState<"telemetry" | "anomalies" | "history">("telemetry");

  React.useEffect(() => {
    let isMounted = true;

    async function fetchLogs() {
      try {
        const logs = await getPracticeSessionRecords(lessonId);
        if (!isMounted) return;
        setHistoryLogs(logs);
      } catch {
        // ignore
      }
    }

    fetchLogs();

    return () => {
      isMounted = false;
    };
  }, [lessonId, evaluationResult]);

  const loadHistory = React.useCallback(async () => {
    try {
      const logs = await getPracticeSessionRecords(lessonId);
      setHistoryLogs(logs);
    } catch {
      // ignore
    }
  }, [lessonId]);

  const handleExport = async () => {
    const json = await exportPracticeSessionsAsJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tsl_diagnostic_sessions_${lessonId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (confirm("คุณต้องการล้างประวัติการทดสอบ Diagnostic ของบทเรียนนี้ใช่หรือไม่?")) {
      await clearPracticeSessionRecords(lessonId);
      setHistoryLogs([]);
    }
  };

  return (
    <Card className="p-5 bg-white border border-[#CBD5E1] shadow-xs space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <h4 className="font-bold text-sm text-[#0F172A]">
            Real-World Diagnostic & Telemetry Mode
          </h4>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("telemetry")}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === "telemetry"
                ? "bg-white text-[#0F172A] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Live Telemetry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("anomalies")}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
              activeTab === "anomalies"
                ? "bg-white text-[#0F172A] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Anomalies</span>
            {anomalyReport && anomalyReport.hasAnomaly && (
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              loadHistory();
            }}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === "history"
                ? "bg-white text-[#0F172A] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Session Logs ({historyLogs.length})
          </button>
        </div>
      </div>

      {/* 1. Telemetry Tab */}
      {activeTab === "telemetry" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-500 block font-medium">Capture Rate</span>
            <span className="font-bold text-[#0F172A] text-sm">{stats.fps} FPS</span>
            <span className="text-[10px] text-slate-400 block">Latency: {stats.latencyMs}ms</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-500 block font-medium">Hands Detected</span>
            <span className="font-bold text-[#0F172A] text-sm">{stats.handsCount} Hands</span>
            <span className="text-[10px] text-slate-400 block">
              {stats.hasLeftHand && "L "}{stats.hasRightHand && "R"}
              {!stats.hasLeftHand && !stats.hasRightHand && "None"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-500 block font-medium">Buffer Frames</span>
            <span className="font-bold text-[#0EA5E9] text-sm">{liveFrameCount} Frames</span>
            <span className="text-[10px] text-slate-400 block">Duration: {liveDurationSec}s</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-500 block font-medium">Reference Dataset</span>
            <span className="font-bold text-indigo-600 text-sm">{referenceCount} ตัวอย่าง</span>
            <span className="text-[10px] text-slate-400 block">Quality: {bestQualityScore}%</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-500 block font-medium">Live Score (EMA)</span>
            <span className="font-bold text-emerald-600 text-sm">
              {liveFeedback ? `${liveFeedback.liveScore}%` : "-"}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Conf: {liveFeedback ? `${Math.round(liveFeedback.confidence * 100)}%` : "-"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-500 block font-medium">DTW Alignment</span>
            <span className="font-bold text-[#0F172A] text-sm">
              {evaluationResult ? `${evaluationResult.score.matchedFrames} / ${evaluationResult.score.totalFrames}` : "-"}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Matched: {evaluationResult ? `${Math.round((evaluationResult.score.matchedFrames / (evaluationResult.score.totalFrames || 1)) * 100)}%` : "-"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-500 block font-medium">Matched Reference</span>
            <span className="font-bold text-[#0F172A] text-xs truncate block" title={matchedReference?.id || "-"}>
              {matchedReference?.id ? matchedReference.id.slice(0, 14) + "..." : "-"}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {matchedReference?.isPrimary ? "★ Primary" : "Candidate"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-slate-500 block font-medium">Final Evaluation</span>
            <span className="font-bold text-[#0EA5E9] text-sm">
              {evaluationResult ? `${evaluationResult.score.overallScore}/100` : "-"}
            </span>

            <span className="text-[10px] text-slate-400 block">
              Status: {evaluationResult ? (evaluationResult.score.overallScore >= 80 ? "ผ่าน" : "ต้องฝึกเพิ่ม") : "-"}
            </span>
          </div>
        </div>
      )}

      {/* 2. Anomalies Tab */}
      {activeTab === "anomalies" && (
        <div className="space-y-3 text-xs">
          {!anomalyReport ? (
            <p className="text-slate-500 text-center py-4">
              ยังไม่มีข้อมูลการประเมินรอบล่าสุด กด &quot;หยุดและประเมินผล&quot; เพื่อตรวจ Anomaly
            </p>
          ) : !anomalyReport.hasAnomaly ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-3">
              <span className="text-base">✓</span>
              <div>
                <span className="font-bold block">ไม่พบ Anomaly ในการคำนวณคะแนน</span>
                <span className="text-[11px] text-emerald-700">
                  ระบบตรวจสอบคะแนน ความเชื่อมั่น และวิถี DTW มีความสอดคล้องกันตามหลักเกณฑ์ (Verdict: VALID)
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-600">
                  ตรวจพบ {anomalyReport.anomalies.length} ข้อสังเกต (Verdict: {anomalyReport.verdict})
                </span>
                <Badge variant={anomalyReport.criticalCount > 0 ? "outline" : "warning"}>
                  {anomalyReport.criticalCount} Critical • {anomalyReport.warningCount} Warning
                </Badge>
              </div>

              {anomalyReport.anomalies.map((anom, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border ${
                    anom.severity === "critical"
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-amber-50 border-amber-200 text-amber-900"
                  } space-y-1`}
                >
                  <div className="flex items-center justify-between">
                    <strong className="font-mono text-[11px]">{anom.code}</strong>
                    <span className="text-[10px] uppercase font-bold">{anom.severity}</span>
                  </div>
                  <p>{anom.description}</p>
                  <p className="text-[11px] opacity-80">💡 คำแนะนำ: {anom.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. History Tab */}
      {activeTab === "history" && (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">ประวัติการบันทึก Diagnostic ล่าสุด ({historyLogs.length} รอบ)</span>
            <div className="flex items-center gap-2">
              {historyLogs.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleExport} className="text-xs">
                    📥 Export JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClear} className="text-xs text-red-600 border-red-200 hover:bg-red-50">
                    ล้างประวัติ
                  </Button>
                </>
              )}
            </div>
          </div>

          {historyLogs.length === 0 ? (
            <p className="text-slate-400 text-center py-6">ยังไม่มีประวัติการทดสอบในหน่วยความจำ</p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {historyLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0F172A]">{log.finalScore}/100</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600">{new Date(log.timestamp).toLocaleTimeString("th-TH")}</span>
                      <Badge variant={log.verdict === "VALID" ? "success" : log.verdict === "SUSPICIOUS" ? "warning" : "outline"}>
                        {log.verdict}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                      <span>Ref: {log.matchedReferenceId.slice(0, 10)}...</span>
                      <span>Frames: {log.capturedFrames}</span>
                      <span>Conf: {Math.round(log.confidence * 100)}%</span>
                      <span>Matched: {log.dtwMetrics.matchedFrames}f</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-600 sm:text-right">
                    <span>Curl: {log.componentScores.fingerCurl}% | Orient: {log.componentScores.palmOrientation}%</span>
                    <br />
                    <span>Pos: {log.componentScores.handPosition}% | 2-Hand: {log.componentScores.twoHand}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
