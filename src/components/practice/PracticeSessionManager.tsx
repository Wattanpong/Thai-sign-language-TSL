"use client";

import * as React from "react";
import Link from "next/link";
import { Lesson, ReferenceGesture } from "@/types";
import { Card, Button, Badge } from "@/components/ui";
import { usePracticeSession } from "@/lib/practice/usePracticeSession";
import { PracticeResultCard } from "./PracticeResultCard";
import { PracticeDiagnosticPanel } from "./PracticeDiagnosticPanel";
import {
  createHandLandmarker,
  disposeHandLandmarker,
  detectHandsForVideo,
} from "@/lib/mediaPipe/handLandmarker";
import {
  createPoseLandmarker,
  disposePoseLandmarker,
  detectPoseForVideo,
} from "@/lib/mediaPipe/poseLandmarker";
import {
  drawHandLandmarks,
  drawPoseLandmarks,
} from "@/lib/mediaPipe/drawing";
import { isBrowserSupported } from "@/lib/mediaPipe/vision";
import type { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

interface PracticeSessionManagerProps {
  lessons: Lesson[];
  initialLessonId?: string;
  initialReference?: ReferenceGesture | null;
}

export function PracticeSessionManager({
  lessons,
  initialLessonId = "hello",
}: PracticeSessionManagerProps) {
  // 1. Select Active Lesson
  const [selectedLessonId, setSelectedLessonId] = React.useState<string>(initialLessonId);
  const selectedLesson =
    lessons.find((l) => l.id === selectedLessonId) || lessons[0] || {
      id: "hello",
      categoryId: "greeting-basic",
      word: "สวัสดี",
      description: "พนมมือระดับอกแล้วก้มศีรษะลงเล็กน้อย",
      gestureType: "dynamic",
      order: 1,
      difficulty: "beginner",
      isActive: true,
    };

  // 2. Practice Session State & Pipeline
  const {
    referenceGesture,
    referenceCount,
    bestQualityScore,
    isLoadingReference,
    sessionState,
    liveDurationSec,
    liveFrameCount,
    liveFeedback,
    evaluationResult,
    anomalyReport,
    errorMessage: practiceError,
    startPractice,
    stopAndAnalyze,
    resetSession,
    ingestFrame,
  } = usePracticeSession(selectedLesson);

  const liveFeedbackRef = React.useRef(liveFeedback);
  React.useEffect(() => {
    liveFeedbackRef.current = liveFeedback;
  }, [liveFeedback]);

  // 3. Camera & MediaPipe State
  const [cameraState, setCameraState] = React.useState<"off" | "requesting" | "ready" | "error">("off");
  const [isMirrored, setIsMirrored] = React.useState<boolean>(true);
  const [showDebug, setShowDebug] = React.useState<boolean>(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [initStepMessage, setInitStepMessage] = React.useState<string | null>(null);

  const [debugStats, setDebugStats] = React.useState({
    handsCount: 0,
    hasLeftHand: false,
    hasRightHand: false,
    hasPose: false,
    fps: 0,
    latencyMs: 0,
  });

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const handLandmarkerRef = React.useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = React.useRef<PoseLandmarker | null>(null);
  const animationFrameIdRef = React.useRef<number | null>(null);
  const isDetectingRef = React.useRef<boolean>(false);
  const isMirroredRef = React.useRef<boolean>(isMirrored);
  const lastTimeRef = React.useRef<number>(0);
  const frameCountRef = React.useRef<number>(0);

  React.useEffect(() => {
    isMirroredRef.current = isMirrored;
  }, [isMirrored]);

  // Stop camera stream & cleanup
  const stopCamera = React.useCallback(() => {
    isDetectingRef.current = false;

    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    setCameraState("off");
    setDebugStats({
      handsCount: 0,
      hasLeftHand: false,
      hasRightHand: false,
      hasPose: false,
      fps: 0,
      latencyMs: 0,
    });
  }, []);

  // Real-time detection loop
  const startDetectionLoop = React.useCallback(function executeLoop() {
    if (!isDetectingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      video &&
      canvas &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      !video.paused &&
      !video.ended
    ) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const startTime = performance.now();
        const timestampMs = startTime;

        let handResult = null;
        let poseResult = null;

        // Detect Hands
        if (handLandmarkerRef.current) {
          try {
            handResult = detectHandsForVideo(handLandmarkerRef.current, video, timestampMs);
          } catch {
            // ignore frame drop
          }
        }

        // Detect Pose
        if (poseLandmarkerRef.current) {
          try {
            poseResult = detectPoseForVideo(poseLandmarkerRef.current, video, timestampMs);
          } catch {
            // ignore frame drop
          }
        }

        const endTime = performance.now();
        const latencyMs = Math.round(endTime - startTime);

        // Draw Overlays
        if (poseResult && poseResult.landmarks.length > 0) {
          drawPoseLandmarks(ctx, poseResult, canvas.width, canvas.height, {
            isMirrored: isMirroredRef.current,
          });
        }

        if (handResult && handResult.landmarks.length > 0) {
          drawHandLandmarks(ctx, handResult, canvas.width, canvas.height, {
            isMirrored: isMirroredRef.current,
            faultyComponents: liveFeedbackRef.current?.faultyComponents || [],
          });
        }

        // Ingest frame into practice session if practicing
        ingestFrame(handResult, poseResult);

        // FPS & Stats calculation
        frameCountRef.current += 1;
        const now = performance.now();
        if (lastTimeRef.current === 0) lastTimeRef.current = now;
        const delta = now - lastTimeRef.current;

        if (delta >= 250) {
          const calculatedFps = Math.round((frameCountRef.current * 1000) / delta);
          frameCountRef.current = 0;
          lastTimeRef.current = now;

          const handsCount = handResult?.landmarks.length || 0;
          const hasLeftHand = Boolean(
            handResult?.handednesses.some((h) =>
              h.some((item) => item.categoryName.toLowerCase().includes("left"))
            )
          );
          const hasRightHand = Boolean(
            handResult?.handednesses.some((h) =>
              h.some((item) => item.categoryName.toLowerCase().includes("right"))
            )
          );
          const hasPose = Boolean((poseResult?.landmarks.length || 0) > 0);

          setDebugStats({
            handsCount,
            hasLeftHand,
            hasRightHand,
            hasPose,
            fps: calculatedFps,
            latencyMs,
          });
        }
      }
    }

    if (isDetectingRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(executeLoop);
    }
  }, [ingestFrame]);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    setCameraState("requesting");

    let currentStep = "ตรวจสอบสภาพแวดล้อม (Browser Check)";

    try {
      setInitStepMessage("กำลังตรวจสอบสภาพแวดล้อมและเบราว์เซอร์...");
      if (!isBrowserSupported()) {
        throw new Error("เบราว์เซอร์ของคุณไม่รองรับกล้องหรือ WebAssembly");
      }

      currentStep = "เริ่มต้นโมเดลตรวจจับมือ (HandLandmarker)";
      setInitStepMessage("กำลังโหลดโมเดลตรวจจับมือ...");
      if (!handLandmarkerRef.current) {
        handLandmarkerRef.current = await createHandLandmarker({
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      currentStep = "เริ่มต้นโมเดลตรวจจับร่างกาย (PoseLandmarker)";
      setInitStepMessage("กำลังโหลดโมเดลตรวจจับร่างกาย...");
      if (!poseLandmarkerRef.current) {
        poseLandmarkerRef.current = await createPoseLandmarker({
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      currentStep = "ขออนุญาตเปิดกล้องเว็บแคม (getUserMedia)";
      setInitStepMessage("กำลังขออนุญาตเข้าถึงกล้องเว็บแคม...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      currentStep = "เริ่มเล่นวิดีโอ (video.play)";
      setInitStepMessage("กำลังเริ่มแสดงผลวิดีโอ...");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setInitStepMessage(null);
      setCameraState("ready");
      isDetectingRef.current = true;
      lastTimeRef.current = 0;
      frameCountRef.current = 0;
      animationFrameIdRef.current = requestAnimationFrame(startDetectionLoop);
    } catch (err: unknown) {
      stopCamera();
      setCameraState("error");
      setInitStepMessage(null);

      const error = err as { name?: string; message?: string };
      console.error(`[Practice Camera Error at step "${currentStep}"]`, err);

      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        setCameraError("กรุณากดอนุญาตการเข้าถึงกล้องเว็บแคมในแถบเบราว์เซอร์");
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        setCameraError("ไม่พบอุปกรณ์กล้องเว็บแคมที่เชื่อมต่ออยู่");
      } else if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
        setCameraError("กล้องกำลังถูกใช้งานโดยแอปพลิเคชันอื่น");
      } else {
        setCameraError(`เกิดข้อผิดพลาดในขั้นตอน [${currentStep}]: ${error?.message || "ไม่สามารถเริ่มต้นได้"}`);
      }
    }
  };

  React.useEffect(() => {
    return () => {
      stopCamera();
      disposeHandLandmarker(handLandmarkerRef.current);
      disposePoseLandmarker(poseLandmarkerRef.current);
      handLandmarkerRef.current = null;
      poseLandmarkerRef.current = null;
    };
  }, [stopCamera]);

  return (
    <div className="space-y-6">
      {/* Lesson Selector Bar */}
      <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              เลือกคำศัพท์ที่ต้องการฝึกฝน
            </span>
            <div className="flex items-center gap-3">
              <select
                value={selectedLessonId}
                onChange={(e) => {
                  setSelectedLessonId(e.target.value);
                  resetSession();
                }}
                className="font-bold text-lg text-[#0F172A] bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#FFB400]"
              >
                {lessons.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.word} ({item.description})
                  </option>
                ))}
              </select>

              <Badge variant="tag">
                {selectedLesson.gestureType === "dynamic" ? "ท่าทางต่อเนื่อง (Dynamic)" : "ท่าทางคงที่ (Static)"}
              </Badge>
            </div>
          </div>

          {/* Reference Status Pill */}
          <div className="flex items-center gap-2">
            {isLoadingReference ? (
              <Badge variant="outline">กำลังตรวจสอบต้นแบบ...</Badge>
            ) : referenceCount > 1 ? (
              <Badge variant="success">
                ✓ มี Reference {referenceCount} ตัวอย่าง (Best Quality: {bestQualityScore}%)
              </Badge>
            ) : referenceGesture ? (
              <Badge variant="success">
                ✓ มี Reference 1 ตัวอย่าง (Quality: {bestQualityScore}%)
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="warning">ยังไม่มี Reference ต้นแบบ</Badge>
                <Link href={`/admin/lessons/${selectedLesson.id}/reference`}>
                  <Button variant="outline" size="sm">
                    บันทึกต้นแบบใน Admin
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-[#475569] bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
          <span className="font-semibold text-[#0F172A]">คำอธิบายท่าทาง: </span>
          {selectedLesson.description}
        </p>
      </div>

      {/* Top Camera Controls & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                cameraState === "ready"
                  ? "bg-emerald-500 animate-pulse"
                  : cameraState === "requesting"
                  ? "bg-amber-400 animate-ping"
                  : cameraState === "error"
                  ? "bg-red-500"
                  : "bg-slate-300"
              }`}
            />
            <span className="text-sm font-semibold text-[#0F172A]">
              สถานะกล้อง:
            </span>
          </div>

          <Badge
            variant={
              cameraState === "ready"
                ? "success"
                : cameraState === "requesting"
                ? "warning"
                : cameraState === "error"
                ? "outline"
                : "default"
            }
          >
            {cameraState === "ready" && "Camera Ready (กำลังตรวจจับ)"}
            {cameraState === "requesting" && "กำลังขออนุญาตกล้อง / โหลดโมเดล..."}
            {cameraState === "error" && "Camera Error"}
            {cameraState === "off" && "Camera Off"}
          </Badge>

          {sessionState === "practicing" && (
            <Badge variant="warning" className="animate-pulse">
              🔴 กำลังบันทึกการฝึกฝน: {liveDurationSec}s ({liveFrameCount} เฟรม)
            </Badge>
          )}

          {sessionState === "analyzing" && (
            <Badge variant="default" className="animate-pulse">
              ⚡ กำลังประมวลผล DTW & Scoring...
            </Badge>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMirrored((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors"
          >
            {isMirrored ? "โหมดกระจก: เปิด" : "โหมดกระจก: ปิด"}
          </button>

          <button
            type="button"
            onClick={() => setShowDebug((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors"
          >
            {showDebug ? "ซ่อน Debug" : "แสดง Debug"}
          </button>

          {cameraState === "ready" || cameraState === "requesting" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={stopCamera}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              ปิดกล้อง
            </Button>
          ) : (
            <Button
              size="sm"
              variant="amber"
              onClick={startCamera}
              className="shadow-xs font-semibold"
            >
              เปิดกล้อง
            </Button>
          )}
        </div>
      </div>

      {/* Loading Step Progress Indicator */}
      {cameraState === "requesting" && initStepMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm text-amber-900 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-medium">{initStepMessage}</span>
        </div>
      )}

      {/* Camera / Practice Errors */}
      {(cameraError || practiceError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️ {cameraError || practiceError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              resetSession();
            }}
            className="text-red-500 hover:text-red-700 font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Viewport & Video / Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={showDebug ? "lg:col-span-8 space-y-4" : "lg:col-span-12 space-y-4"}>
          <Card className="overflow-hidden p-0 border-[#E2E8F0]">
            <div className="relative aspect-video w-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 h-full w-full object-cover ${
                  isMirrored ? "scale-x-[-1]" : ""
                } ${cameraState === "ready" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              />

              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full pointer-events-none z-10"
              />

              {/* Real-time Live Practice HUD (Overlay inside viewport) */}
              {sessionState === "practicing" && liveFeedback && (
                <div className="absolute top-3 inset-x-3 z-20 flex flex-col gap-2 pointer-events-none animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg text-white">
                    {/* Live Score Pill */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`px-3 py-1 rounded-lg text-xs font-black tracking-wider flex items-center gap-1.5 shadow-xs ${
                          liveFeedback.liveScore >= 85
                            ? "bg-emerald-500 text-white"
                            : liveFeedback.liveScore >= 60
                            ? "bg-amber-500 text-white"
                            : "bg-rose-500 text-white"
                        }`}
                      >
                        <span>LIVE</span>
                        <span>{liveFeedback.liveScore}%</span>
                      </div>

                      {/* Primary Feedback Status */}
                      <span className="text-xs sm:text-sm font-semibold truncate max-w-xs sm:max-w-md">
                        {liveFeedback.severity === "success" && "🟢 "}
                        {liveFeedback.severity === "warning" && "🟡 "}
                        {liveFeedback.severity === "error" && "🔴 "}
                        {liveFeedback.primaryFeedback}
                      </span>
                    </div>

                    {/* Gesture Progress if dynamic */}
                    {selectedLesson.gestureType === "dynamic" && (
                      <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-300">
                        <span>จังหวะท่า:</span>
                        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#FFB400] transition-all duration-100"
                            style={{
                              width: `${Math.round(liveFeedback.gestureProgress * 100)}%`,
                            }}
                          />
                        </div>
                        <span>{Math.round(liveFeedback.gestureProgress * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Standby screen when camera is off */}
              {cameraState === "off" && (
                <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[#FFB400]">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-200">
                      กล้องยังไม่ได้เปิดใช้งาน
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      กดปุ่ม &quot;เปิดกล้อง&quot; ด้านบน เพื่อเริ่มการตรวจจับท่าทางภาษามือแบบ Real-time
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Live Component Status Card during practice */}
          {sessionState === "practicing" && liveFeedback && (
            <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs space-y-3 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0F172A]">
                    AI Real-Time Feedback
                  </span>
                  <Badge
                    variant={
                      liveFeedback.severity === "success"
                        ? "success"
                        : liveFeedback.severity === "warning"
                        ? "warning"
                        : "outline"
                    }
                  >
                    {liveFeedback.severity === "success" && "ท่าทางถูกต้อง"}
                    {liveFeedback.severity === "warning" && "ควรปรับปรุงเล็กน้อย"}
                    {liveFeedback.severity === "error" && "ท่าทางยังไม่ถูกต้อง"}
                  </Badge>
                </div>

                {liveFeedback.correctionDirection && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    💡 คำแนะนำ: {liveFeedback.correctionDirection}
                  </span>
                )}
              </div>

              {/* Secondary feedback list if any */}
              {liveFeedback.secondaryFeedback.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-[#475569]">
                  {liveFeedback.secondaryFeedback.map((msg, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200"
                    >
                      • {msg}
                    </span>
                  ))}
                </div>
              )}

              {/* Real-time Component Score Breakdown Bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex justify-between text-[#64748B]">
                    <span>ทิศทางมือ</span>
                    <span className="font-bold text-[#0F172A]">{liveFeedback.componentScores.palmOrientation}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        liveFeedback.componentScores.palmOrientation >= 70 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${liveFeedback.componentScores.palmOrientation}%` }}
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex justify-between text-[#64748B]">
                    <span>ตำแหน่งมือ</span>
                    <span className="font-bold text-[#0F172A]">{liveFeedback.componentScores.handPosition}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        liveFeedback.componentScores.handPosition >= 70 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${liveFeedback.componentScores.handPosition}%` }}
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex justify-between text-[#64748B]">
                    <span>การงอนิ้ว</span>
                    <span className="font-bold text-[#0F172A]">{liveFeedback.componentScores.fingerCurl}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        liveFeedback.componentScores.fingerCurl >= 70 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${liveFeedback.componentScores.fingerCurl}%` }}
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex justify-between text-[#64748B]">
                    <span>มุมข้อนิ้ว</span>
                    <span className="font-bold text-[#0F172A]">{liveFeedback.componentScores.fingerAngle}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        liveFeedback.componentScores.fingerAngle >= 70 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${liveFeedback.componentScores.fingerAngle}%` }}
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex justify-between text-[#64748B]">
                    <span>รูปทรงมือ</span>
                    <span className="font-bold text-[#0F172A]">{liveFeedback.componentScores.handShape}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        liveFeedback.componentScores.handShape >= 70 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${liveFeedback.componentScores.handShape}%` }}
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex justify-between text-[#64748B]">
                    <span>ความสัมพันธ์สองมือ</span>
                    <span className="font-bold text-[#0F172A]">{liveFeedback.componentScores.twoHand}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        liveFeedback.componentScores.twoHand >= 70 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${liveFeedback.componentScores.twoHand}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Practice Controls Bar */}
          {cameraState === "ready" && (
            <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {sessionState === "idle" && (
                  <Button
                    variant="amber"
                    size="md"
                    onClick={startPractice}
                    className="font-bold shadow-xs px-6"
                  >
                    ▶ เริ่มฝึกท่า &quot;{selectedLesson.word}&quot; (Start Practice)
                  </Button>
                )}

                {sessionState === "practicing" && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={stopAndAnalyze}
                    className="font-bold bg-red-600 text-white hover:bg-red-700 border-transparent shadow-xs px-6"
                  >
                    ⏹ หยุดและตรวจคะแนน (Stop & Evaluate)
                  </Button>
                )}

                {sessionState === "completed" && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={resetSession}
                    className="font-semibold"
                  >
                    ↻ ลองใหม่อีกครั้ง (Try Again)
                  </Button>
                )}
              </div>

              <div className="text-xs text-[#64748B] flex items-center gap-2">
                {sessionState === "idle" && "กดเริ่มฝึกเมื่อพร้อมทำท่าทาง"}
                {sessionState === "practicing" && (
                  <span className="text-red-600 font-semibold animate-pulse">
                    ● กำลังบันทึกท่าทาง... ทำท่าทางให้สมบูรณ์แล้วกดหยุด
                  </span>
                )}
                {sessionState === "analyzing" && "กำลังส่งต่อเข้า DTW & Scoring Pipeline..."}
                {sessionState === "completed" && "ประเมินผลเรียบร้อยแล้ว ดูคะแนนด้านล่าง"}
              </div>
            </div>
          )}
        </div>

        {/* Real-World Diagnostic & Telemetry Panel (STEP 7E) */}
        {showDebug && (
          <div className="lg:col-span-4 space-y-4">
            <PracticeDiagnosticPanel
              stats={debugStats}
              liveFrameCount={liveFrameCount}
              liveDurationSec={liveDurationSec}
              liveFeedback={liveFeedback}
              evaluationResult={evaluationResult}
              anomalyReport={anomalyReport}
              referenceCount={referenceCount}
              bestQualityScore={bestQualityScore}
              matchedReference={evaluationResult?.matchedReference || referenceGesture}
              lessonId={selectedLesson.id}
            />
          </div>
        )}
      </div>

      {/* Practice Results View (Appears on completed analysis) */}
      {sessionState === "completed" && evaluationResult && (
        <PracticeResultCard
          result={evaluationResult}
          word={selectedLesson.word}
          onReset={resetSession}
        />
      )}
    </div>
  );
}
