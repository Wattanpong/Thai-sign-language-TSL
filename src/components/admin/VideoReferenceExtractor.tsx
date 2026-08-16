"use client";

import * as React from "react";
import { Lesson, ReferenceGesture, ReferenceFrame } from "@/types";
import { saveReferenceGesture } from "@/lib/storage/referenceStorage";
import {
  extractGestureFromVideo,
  VideoExtractionProgress,
  VideoExtractionResult,
} from "@/lib/gesture/videoLandmarkExtractor";
import {
  HAND_CONNECTIONS,
  UPPER_BODY_POSE_CONNECTIONS,
} from "@/lib/mediaPipe/drawing";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";

export interface VideoReferenceExtractorProps {
  lesson: Lesson;
  onSaved?: (savedGesture: ReferenceGesture) => void;
  onCancel?: () => void;
}

export function VideoReferenceExtractor({
  lesson,
  onSaved,
  onCancel,
}: VideoReferenceExtractorProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState<VideoExtractionProgress | null>(null);
  const [extractionResult, setExtractionResult] = React.useState<VideoExtractionResult | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Settings
  const [fps, setFps] = React.useState<number>(25);
  const [autoTrim, setAutoTrim] = React.useState<boolean>(true);
  const [enableSmoothing, setEnableSmoothing] = React.useState<boolean>(true);

  // DOM Refs
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setErrorMessage("กรุณาเลือกไฟล์วิดีโอ (.mp4, .webm, .mov)");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setExtractionResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProgress(null);
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(file);
      setSelectedFile(file);
      setPreviewUrl(url);
      setExtractionResult(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setProgress(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Draw detected frame overlay onto canvas
  const drawFrameOverlay = React.useCallback(
    (_frameIndex: number, frame: ReferenceFrame, videoEl: HTMLVideoElement) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = videoEl.videoWidth || canvas.width;
      const height = videoEl.videoHeight || canvas.height;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw Pose Landmarks
      if (frame.pose && frame.pose.length > 0) {
        ctx.strokeStyle = "rgba(59, 130, 246, 0.75)";
        ctx.lineWidth = 3;

        UPPER_BODY_POSE_CONNECTIONS.forEach(([i, j]) => {
          const p1 = frame.pose[i];
          const p2 = frame.pose[j];
          if (p1 && p2 && (p1.visibility ?? 1) > 0.3 && (p2.visibility ?? 1) > 0.3) {
            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
          }
        });

        frame.pose.forEach((p, idx) => {
          if ((p.visibility ?? 1) > 0.3 && idx <= 24) {
            ctx.fillStyle = "#3B82F6";
            ctx.beginPath();
            ctx.arc(p.x * width, p.y * height, 4, 0, 2 * Math.PI);
            ctx.fill();
          }
        });
      }

      // Draw Hand Landmarks
      frame.hands.forEach((hand) => {
        const isRight = hand.handedness === "Right";
        const color = isRight ? "#0EA5E9" : "#10B981";
        const strokeColor = isRight ? "rgba(14, 165, 233, 0.9)" : "rgba(16, 185, 129, 0.9)";

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;

        HAND_CONNECTIONS.forEach(([i, j]) => {
          const p1 = hand.landmarks[i];
          const p2 = hand.landmarks[j];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
          }
        });

        hand.landmarks.forEach((p) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x * width, p.y * height, 3.5, 0, 2 * Math.PI);
          ctx.fill();
        });
      });
    },
    []
  );

  // Execute extraction
  const handleStartExtraction = async () => {
    if (!selectedFile) {
      setErrorMessage("กรุณาเลือกไฟล์วิดีโอก่อน");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setExtractionResult(null);

    try {
      const result = await extractGestureFromVideo(
        selectedFile,
        {
          id: lesson.id,
          word: lesson.word,
          gestureType: lesson.gestureType,
        },
        {
          fps,
          autoTrimLeadInLeadOut: autoTrim,
          enableSmoothing,
          onProgress: (p) => {
            setProgress(p);
          },
          onFrameProcessed: (idx, frame, videoEl) => {
            drawFrameOverlay(idx, frame, videoEl);
          },
        }
      );

      setExtractionResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสกัด Landmarks จากวิดีโอ";
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save extracted gesture to Storage & Supabase Cloud
  const handleSaveToCloud = async () => {
    if (!extractionResult) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await saveReferenceGesture(extractionResult.gesture);
      setSuccessMessage(
        `บันทึก Reference Gesture จากวิดีโอเรียบร้อยแล้ว (อัปโหลดขึ้น Supabase Storage สำเร็จ)`
      );
      if (onSaved) {
        onSaved(extractionResult.gesture);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Cleanup object URL
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-xs">
              Video Extractor
            </span>
            <span className="text-xs text-blue-100">คำศัพท์: {lesson.word}</span>
          </div>
          <h2 className="text-xl font-bold">สกัดท่าทางต้นแบบจากไฟล์วิดีโอ (Video Upload)</h2>
          <p className="text-xs text-blue-100 mt-1 max-w-xl">
            อัปโหลดวิดีโอต้นแบบ ระบบจะวิเคราะห์โครงสร้างมือ (Hand Landmarks) และร่างกาย (Pose) ด้วย MediaPipe
            พร้อมปรับปรุงความนุ่มนวลและตัดต่อช่วงเริ่มต้น-สิ้นสุดอัตโนมัติ
          </p>
        </div>

        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="border-white/40 bg-white/10 text-white hover:bg-white/20 self-start sm:self-center"
          >
            กลับสู่หน้ารายการ
          </Button>
        )}
      </div>

      {/* Error & Success Messages */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <span>✅</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Grid: Upload & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Dropzone & Settings */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border border-[#E2E8F0] shadow-2xs rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#0F172A]">
                1. เลือกไฟล์วิดีโอท่าทาง
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                รองรับไฟล์ .mp4, .webm, .mov (ความยาวแนะนำ 1-10 วินาที)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#0EA5E9] bg-[#F8FAFC] hover:bg-[#F0F9FF] p-6 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="h-12 w-12 rounded-2xl bg-white shadow-2xs border border-[#E2E8F0] flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  📹
                </div>
                <p className="mt-3 text-xs font-bold text-[#334155] group-hover:text-[#0284C7]">
                  {selectedFile ? selectedFile.name : "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์"}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  {selectedFile
                    ? `ขนาด: ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                    : "MP4, WebM หรือ QuickTime (.mov)"}
                </p>
              </div>

              {/* Extraction Parameters */}
              <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
                <p className="text-xs font-semibold text-[#0F172A]">การตั้งค่าการประมวลผล</p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">อัตราสุ่มเฟรม (FPS):</span>
                  <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    disabled={isProcessing}
                    className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold"
                  >
                    <option value={20}>20 FPS (เร็วขึ้น)</option>
                    <option value={25}>25 FPS (มาตรฐานแนะนำ)</option>
                    <option value={30}>30 FPS (ความละเอียดสูง)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">ตัดเฟรมหัว-ท้าย (Auto Trimming):</span>
                  <input
                    type="checkbox"
                    checked={autoTrim}
                    onChange={(e) => setAutoTrim(e.target.checked)}
                    disabled={isProcessing}
                    className="h-4 w-4 rounded-sm border-gray-300 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">ลดการสั่นไหว (One-Euro Filter):</span>
                  <input
                    type="checkbox"
                    checked={enableSmoothing}
                    onChange={(e) => setEnableSmoothing(e.target.checked)}
                    disabled={isProcessing}
                    className="h-4 w-4 rounded-sm border-gray-300 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                </div>
              </div>

              <Button
                onClick={handleStartExtraction}
                disabled={!selectedFile || isProcessing}
                variant="primary"
                className="w-full py-2.5 font-bold text-sm shadow-xs rounded-xl flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    กำลังประมวลผลวิดีโอ...
                  </>
                ) : (
                  "✨ เริ่มสกัดท่าทางจากวิดีโอ"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Video & Skeleton Preview */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border border-[#E2E8F0] shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-[#0F172A]">
                  2. หน้าจอแสดงผลและ Skeleton Preview
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  ตรวจสอบท่วงท่าและตำแหน่งจุดข้อต่อที่ตรวจจับได้
                </CardDescription>
              </div>
              {extractionResult && (
                <Badge
                  variant={
                    extractionResult.quality.level === "good"
                      ? "success"
                      : "warning"
                  }
                >
                  คุณภาพ: {extractionResult.quality.levelLabel} ({extractionResult.quality.scorePercent}%)
                </Badge>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Video with Overlay Canvas */}
              <div className="relative aspect-video w-full rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center">
                {previewUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      src={previewUrl}
                      controls
                      playsInline
                      muted
                      className="h-full w-full object-contain"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 pointer-events-none h-full w-full object-contain"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-2 p-6 text-center">
                    <span className="text-4xl">🎬</span>
                    <span className="text-xs">ยังไม่ได้เลือกไฟล์วิดีโอ</span>
                  </div>
                )}
              </div>

              {/* Processing Progress Bar */}
              {isProcessing && progress && (
                <div className="space-y-2 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] p-4 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#0369A1]">
                    <span>{progress.statusText}</span>
                    <span>{progress.progressPercent}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E0F2FE]">
                    <div
                      className="h-full bg-[#0EA5E9] transition-all duration-150 rounded-full"
                      style={{ width: `${progress.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#0284C7]">
                    <span>เฟรม: {progress.currentFrame} / {progress.totalFrames}</span>
                    <span>เวลา: {progress.currentTimeSec.toFixed(1)}s / {progress.totalDurationSec.toFixed(1)}s</span>
                  </div>
                </div>
              )}

              {/* Extraction Quality & Result Summary */}
              {extractionResult && (
                <div className="space-y-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">ผลการวิเคราะห์ Reference:</span>
                    <span className="text-xs text-[#64748B]">
                      {extractionResult.trimmedFrameCount} เฟรม ({((extractionResult.gesture.durationMs || 0) / 1000).toFixed(1)} วินาที)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-2">
                      <span className="text-[10px] text-[#64748B] block">เฟรมที่สกัดได้</span>
                      <span className="font-bold text-[#0F172A]">{extractionResult.trimmedFrameCount} / {extractionResult.rawFrameCount}</span>
                    </div>
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-2">
                      <span className="text-[10px] text-[#64748B] block">ตรวจพบมือ</span>
                      <span className="font-bold text-[#0EA5E9]">{extractionResult.quality.details.handCoveragePercent}%</span>
                    </div>
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-2">
                      <span className="text-[10px] text-[#64748B] block">คะแนนความสมบูรณ์</span>
                      <span className="font-bold text-emerald-600">{extractionResult.quality.scorePercent}%</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#334155]">
                    💡 {extractionResult.quality.summaryMessage}
                  </p>

                  <div className="pt-2 flex gap-3">
                    <Button
                      onClick={handleSaveToCloud}
                      disabled={isSaving}
                      variant="primary"
                      className="flex-1 py-2.5 font-bold text-xs rounded-xl shadow-xs"
                    >
                      {isSaving ? "กำลังบันทึกขึ้น Supabase..." : "☁️ บันทึกท่าต้นแบบนี้ (Save to Cloud)"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
