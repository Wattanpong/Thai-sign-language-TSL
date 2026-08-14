"use client";

import * as React from "react";
import { Lesson, ReferenceGesture } from "@/types";
import { evaluateReferenceQuality } from "@/lib/gesture/referenceQuality";
import { HAND_CONNECTIONS, UPPER_BODY_POSE_CONNECTIONS } from "@/lib/mediaPipe/drawing";
import { Button, Card, Badge } from "@/components/ui";

export interface ReferenceInspectorProps {
  gesture: ReferenceGesture;
  lesson: Lesson;
  onReRecord: () => void;
  onDelete: () => void;
}

export function ReferenceInspector({
  gesture,
  lesson,
  onReRecord,
  onDelete,
}: ReferenceInspectorProps) {
  const [currentFrameIndex, setCurrentFrameIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const playTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Evaluate Quality Metrics
  const quality = React.useMemo(() => {
    // "สวัสดี" is a wai pose typically involving both hands
    const isWaiSign = lesson.word.includes("สวัสดี") || lesson.id === "hello";
    return evaluateReferenceQuality(gesture, {
      requiresBothHands: isWaiSign,
    });
  }, [gesture, lesson]);

  const currentFrame = gesture.frames[currentFrameIndex] || null;

  // Draw current frame skeleton on canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas and draw background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0F172A"; // Dark canvas for crisp skeleton rendering
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 40; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 1. Draw Pose Landmarks (Blue)
    if (currentFrame.pose && currentFrame.pose.length > 0) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(59, 130, 246, 0.75)";
      ctx.lineCap = "round";

      for (const [startIdx, endIdx] of UPPER_BODY_POSE_CONNECTIONS) {
        const p1 = currentFrame.pose[startIdx];
        const p2 = currentFrame.pose[endIdx];

        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.stroke();
        }
      }

      // Draw Pose joints
      const keyPoseIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24];
      keyPoseIndices.forEach((idx) => {
        const p = currentFrame.pose[idx];
        if (p) {
          ctx.beginPath();
          ctx.arc(p.x * width, p.y * height, 4.5, 0, 2 * Math.PI);
          ctx.fillStyle = "#3B82F6";
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#FFFFFF";
          ctx.stroke();
        }
      });
    }

    // 2. Draw Hand Landmarks (Right: Gold, Left: Emerald)
    if (currentFrame.hands && currentFrame.hands.length > 0) {
      currentFrame.hands.forEach((hand) => {
        const isRightHand = hand.handedness === "Right";
        const connectionColor = isRightHand ? "rgba(255, 180, 0, 0.9)" : "rgba(16, 185, 129, 0.9)";
        const jointColor = isRightHand ? "#FFB400" : "#10B981";

        // Draw connections
        ctx.lineWidth = 3;
        ctx.strokeStyle = connectionColor;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
          const p1 = hand.landmarks[startIdx];
          const p2 = hand.landmarks[endIdx];

          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
          }
        }

        // Draw joints
        hand.landmarks.forEach((p, idx) => {
          const radius = idx === 0 || idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20 ? 5 : 3.5;
          ctx.beginPath();
          ctx.arc(p.x * width, p.y * height, radius, 0, 2 * Math.PI);
          ctx.fillStyle = jointColor;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#FFFFFF";
          ctx.stroke();
        });

        // Label Handedness
        const wrist = hand.landmarks[0];
        if (wrist) {
          const wx = wrist.x * width;
          const wy = wrist.y * height + 18;
          const label = isRightHand ? "มือขวา" : "มือซ้าย";

          ctx.font = "bold 11px Prompt, sans-serif";
          const textWidth = ctx.measureText(label).width;

          ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
          ctx.fillRect(wx - textWidth / 2 - 4, wy - 11, textWidth + 8, 16);

          ctx.fillStyle = isRightHand ? "#FFB400" : "#34D399";
          ctx.textAlign = "center";
          ctx.fillText(label, wx, wy + 1);
        }
      });
    }
  }, [currentFrame]);

  // Animation Playback Timer
  React.useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => {
          if (prev >= gesture.frameCount - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 40); // ~25 FPS playback
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, gesture.frameCount]);

  const handlePlayToggle = () => {
    if (currentFrameIndex >= gesture.frameCount - 1) {
      setCurrentFrameIndex(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentFrameIndex(0);
  };

  const handlePrevFrame = () => {
    setIsPlaying(false);
    setCurrentFrameIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextFrame = () => {
    setIsPlaying(false);
    setCurrentFrameIndex((prev) => Math.min(gesture.frameCount - 1, prev + 1));
  };

  // Status Colors
  const qualityBg =
    quality.level === "good"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : quality.level === "fair"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-red-50 border-red-200 text-red-900";

  const qualityBadgeVariant =
    quality.level === "good" ? "success" : quality.level === "fair" ? "warning" : "outline";

  return (
    <div className="space-y-6">
      {/* 1. Quality Summary Banner */}
      <div className={`p-6 rounded-2xl border ${qualityBg} space-y-4 shadow-xs`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                quality.level === "good"
                  ? "bg-emerald-200 text-emerald-800"
                  : quality.level === "fair"
                  ? "bg-amber-200 text-amber-800"
                  : "bg-red-200 text-red-800"
              }`}
            >
              {quality.level === "good" ? "✓" : quality.level === "fair" ? "!" : "✕"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">
                  ผลการประเมินคุณภาพ Reference: {quality.levelLabel} ({quality.scorePercent}%)
                </h3>
                <Badge variant={qualityBadgeVariant}>
                  {quality.level === "good" ? "คุณภาพดี" : quality.level === "fair" ? "ควรตรวจสอบ" : "ควรบันทึกใหม่"}
                </Badge>
              </div>
              <p className="text-xs mt-0.5 opacity-90">{quality.summaryMessage}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={onReRecord}>
              🎥 บันทึกใหม่ (Re-record)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 border-red-200 hover:bg-red-100"
            >
              🗑️ ลบ Reference
            </Button>
          </div>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="bg-white/80 p-3 rounded-xl border border-current/10">
            <span className="text-[11px] block opacity-70">ความยาวเวลา</span>
            <span className="font-mono font-bold text-sm">
              {(gesture.durationMs / 1000).toFixed(2)} วินาที
            </span>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-current/10">
            <span className="text-[11px] block opacity-70">จำนวนเฟรม</span>
            <span className="font-mono font-bold text-sm">{gesture.frameCount} เฟรม</span>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-current/10">
            <span className="text-[11px] block opacity-70">ตรวจพบมือ</span>
            <span className="font-mono font-bold text-sm">
              {quality.details.handCoveragePercent}%
            </span>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-current/10">
            <span className="text-[11px] block opacity-70">ตรวจพบคบ 2 มือ</span>
            <span className="font-mono font-bold text-sm">
              {quality.details.bothHandsCoveragePercent}%
            </span>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-current/10">
            <span className="text-[11px] block opacity-70">ตรวจพบ Pose</span>
            <span className="font-mono font-bold text-sm">
              {quality.details.poseCoveragePercent}%
            </span>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-current/10">
            <span className="text-[11px] block opacity-70">ช่วงมือหายสูงสุด</span>
            <span className="font-mono font-bold text-sm">
              {quality.details.maxConsecutiveMissingHandFrames} เฟรม
            </span>
          </div>
        </div>

        {/* Issues & Recommendations */}
        {quality.details.issues.length > 0 && (
          <div className="bg-white/80 p-3.5 rounded-xl border border-current/15 text-xs space-y-1">
            <span className="font-bold block">ข้อสังเกต / ประเด็นที่พบ:</span>
            <ul className="list-disc list-inside space-y-0.5 opacity-90">
              {quality.details.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 2. Playback Viewport & Frame Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Playback Canvas and Timeline */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="overflow-hidden p-0 border-[#E2E8F0]">
            <div className="relative aspect-video w-full bg-[#0F172A] rounded-2xl overflow-hidden flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={640}
                height={360}
                className="w-full h-full object-contain"
              />

              {/* Timestamp & Frame Counter Overlay */}
              <div className="absolute top-4 left-4 z-20 flex gap-2">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-black/75 text-white border border-white/20">
                  เฟรม: {currentFrameIndex + 1} / {gesture.frameCount}
                </span>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-black/75 text-white border border-white/20">
                  เวลา: {((currentFrame?.timestampMs || 0) / 1000).toFixed(2)}s / {(gesture.durationMs / 1000).toFixed(2)}s
                </span>
              </div>
            </div>
          </Card>

          {/* Playback Controls & Timeline Scrubbing */}
          <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs space-y-3">
            {/* Timeline Slider */}
            <div className="space-y-1.5">
              <input
                type="range"
                min={0}
                max={Math.max(0, gesture.frameCount - 1)}
                value={currentFrameIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentFrameIndex(Number(e.target.value));
                }}
                className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#FFB400]"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                <span>0.00s (Start)</span>
                <span>{(gesture.durationMs / 1000).toFixed(2)}s (End)</span>
              </div>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Button size="sm" variant={isPlaying ? "amber" : "primary"} onClick={handlePlayToggle}>
                  {isPlaying ? "⏸ พักการเล่น (Pause)" : "▶ เล่นท่าทาง (Play)"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleRestart}>
                  ⏮ รีสตาร์ท
                </Button>
                <Button size="sm" variant="outline" onClick={handlePrevFrame}>
                  -1 เฟรม
                </Button>
                <Button size="sm" variant="outline" onClick={handleNextFrame}>
                  +1 เฟรม
                </Button>
              </div>

              <div className="text-xs text-[#64748B] font-mono">
                Frame Rate: ~25 FPS
              </div>
            </div>
          </div>
        </div>

        {/* Frame Inspector Panel */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-6 space-y-5 bg-white border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#0F172A] text-sm">
                Frame Inspector (เฟรมที่ {currentFrameIndex + 1})
              </h3>
              <Badge variant="tag">Timestamp: {currentFrame?.timestampMs || 0} ms</Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">มือซ้าย (Left Hand):</span>
                <Badge
                  variant={
                    currentFrame?.hands?.some((h) => h.handedness === "Left")
                      ? "success"
                      : "default"
                  }
                >
                  {currentFrame?.hands?.some((h) => h.handedness === "Left")
                    ? "✓ ตรวจพบ (21 จุด)"
                    : "ไม่พบในเฟรมนี้"}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">มือขวา (Right Hand):</span>
                <Badge
                  variant={
                    currentFrame?.hands?.some((h) => h.handedness === "Right")
                      ? "primary"
                      : "default"
                  }
                >
                  {currentFrame?.hands?.some((h) => h.handedness === "Right")
                    ? "✓ ตรวจพบ (21 จุด)"
                    : "ไม่พบในเฟรมนี้"}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">โครงสร้างร่างกาย (Pose):</span>
                <Badge
                  variant={
                    (currentFrame?.pose?.length || 0) > 0 ? "success" : "default"
                  }
                >
                  {(currentFrame?.pose?.length || 0) > 0
                    ? `✓ ตรวจพบ (${currentFrame?.pose?.length} จุด)`
                    : "ไม่พบในเฟรมนี้"}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">จำนวนมือรวมในเฟรมนี้:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {currentFrame?.hands?.length || 0} ข้าง
                </span>
              </div>
            </div>

            {/* Sign Reference Metadata */}
            <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-[11px] text-[#64748B] space-y-1">
              <span className="font-semibold text-[#0F172A] block">
                คำศัพท์: {lesson.word} (#{lesson.id})
              </span>
              <p>คำอธิบาย: {lesson.description}</p>
              <p className="text-[10px] opacity-75 mt-1 font-mono">
                ID: {gesture.id}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
