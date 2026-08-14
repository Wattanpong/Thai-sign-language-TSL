"use client";

import * as React from "react";
import {
  createHandLandmarker,
  createPoseLandmarker,
  detectHandsForVideo,
  detectPoseForVideo,
  disposeHandLandmarker,
  disposePoseLandmarker,
  drawHandLandmarks,
  drawPoseLandmarks,
  isBrowserSupported,
} from "@/lib/mediaPipe";
import type { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Button, Card, Badge } from "@/components/ui";

export type CameraState = "off" | "requesting" | "ready" | "error";

export interface DetectionDebugStats {
  handsCount: number;
  hasLeftHand: boolean;
  hasRightHand: boolean;
  hasPose: boolean;
  fps: number;
  latencyMs: number;
}

export function PracticeCameraViewer() {
  const [cameraState, setCameraState] = React.useState<CameraState>("off");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isMirrored, setIsMirrored] = React.useState(true);
  const [showDebug, setShowDebug] = React.useState(true);
  const [debugStats, setDebugStats] = React.useState<DetectionDebugStats>({
    handsCount: 0,
    hasLeftHand: false,
    hasRightHand: false,
    hasPose: false,
    fps: 0,
    latencyMs: 0,
  });

  // DOM and Instance Refs
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const animationFrameIdRef = React.useRef<number | null>(null);

  const handLandmarkerRef = React.useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = React.useRef<PoseLandmarker | null>(null);
  const isDetectingRef = React.useRef<boolean>(false);
  const isMirroredRef = React.useRef<boolean>(isMirrored);

  // Performance tracking refs
  const lastTimeRef = React.useRef<number>(0);
  const frameCountRef = React.useRef<number>(0);

  // Synchronize isMirroredRef
  React.useEffect(() => {
    isMirroredRef.current = isMirrored;
  }, [isMirrored]);

  /**
   * Stop camera stream, cancel animation loop, and cleanup resources
   */
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
          // ignore track stop error
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Clear canvas
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

  /**
   * Detection & Animation Loop (uses named function loop for recursive frame processing)
   */
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
        // Synchronize canvas resolution with video stream dimensions
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        // Clear previous frame overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const startTime = performance.now();
        const timestampMs = startTime;

        let handResult = null;
        let poseResult = null;

        // 1. Detect Hand Landmarks
        if (handLandmarkerRef.current) {
          try {
            handResult = detectHandsForVideo(handLandmarkerRef.current, video, timestampMs);
          } catch {
            // ignore per-frame detection hiccups
          }
        }

        // 2. Detect Pose Landmarks
        if (poseLandmarkerRef.current) {
          try {
            poseResult = detectPoseForVideo(poseLandmarkerRef.current, video, timestampMs);
          } catch {
            // ignore per-frame detection hiccups
          }
        }

        const endTime = performance.now();
        const latencyMs = Math.round(endTime - startTime);

        // 3. Render Overlays
        if (poseResult && poseResult.landmarks.length > 0) {
          drawPoseLandmarks(ctx, poseResult, canvas.width, canvas.height, {
            isMirrored: isMirroredRef.current,
          });
        }

        if (handResult && handResult.landmarks.length > 0) {
          drawHandLandmarks(ctx, handResult, canvas.width, canvas.height, {
            isMirrored: isMirroredRef.current,
          });
        }

        // 4. Calculate FPS & Update Debug Stats (throttled every 250ms)
        frameCountRef.current += 1;
        const now = performance.now();
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = now;
        }
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
  }, []);

  const [initStepMessage, setInitStepMessage] = React.useState<string | null>(null);
  const [errorDetails, setErrorDetails] = React.useState<{
    name?: string;
    message?: string;
    step?: string;
    stack?: string;
  } | null>(null);

  /**
   * Request webcam stream and initialize MediaPipe models
   */
  const startCamera = async () => {
    setErrorMessage(null);
    setErrorDetails(null);
    setCameraState("requesting");

    let currentStep = "ตรวจสอบสภาพแวดล้อม (Browser Environment Check)";

    try {
      setInitStepMessage("กำลังตรวจสอบสภาพแวดล้อมและเบราว์เซอร์...");
      if (!isBrowserSupported()) {
        throw new Error("เบราว์เซอร์ของคุณไม่รองรับการใช้งานกล้องหรือ WebAssembly");
      }

      // 1. Initialize MediaPipe HandLandmarker
      currentStep = "เริ่มต้น MediaPipe HandLandmarker (โมเดลตรวจจับมือ)";
      setInitStepMessage("กำลังโหลดโมเดลตรวจจับมือ (MediaPipe HandLandmarker)...");
      if (!handLandmarkerRef.current) {
        handLandmarkerRef.current = await createHandLandmarker({
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      // 2. Initialize MediaPipe PoseLandmarker
      currentStep = "เริ่มต้น MediaPipe PoseLandmarker (โมเดลตรวจจับท่าทางร่างกาย)";
      setInitStepMessage("กำลังโหลดโมเดลตรวจจับร่างกาย (MediaPipe PoseLandmarker)...");
      if (!poseLandmarkerRef.current) {
        poseLandmarkerRef.current = await createPoseLandmarker({
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      // 3. Request User Media (Webcam)
      currentStep = "ขออนุญาตและเปิดกล้องเว็บแคม (getUserMedia)";
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

      // 4. Play video stream
      currentStep = "เริ่มเล่นสตรีมวิดีโอจากกล้อง (video.play)";
      setInitStepMessage("กำลังเริ่มแสดงผลวิดีโอจากกล้อง...");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setInitStepMessage(null);
      setErrorDetails(null);
      setCameraState("ready");
      isDetectingRef.current = true;
      lastTimeRef.current = 0;
      frameCountRef.current = 0;
      animationFrameIdRef.current = requestAnimationFrame(startDetectionLoop);
    } catch (err: unknown) {
      stopCamera();
      setCameraState("error");
      setInitStepMessage(null);

      const error = err as { name?: string; message?: string; stack?: string };
      console.error(`[Camera/MediaPipe Error at step "${currentStep}"]`, err);

      setErrorDetails({
        name: error?.name || "Error",
        message: error?.message || String(err),
        step: currentStep,
        stack: error?.stack,
      });

      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        setErrorMessage("กรุณากดอนุญาตการเข้าถึงกล้องเว็บแคม (Camera Permission) ในแถบเบราว์เซอร์เพื่อเริ่มใช้งาน");
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        setErrorMessage("ไม่พบอุปกรณ์กล้องเว็บแคมที่เชื่อมต่ออยู่ กรุณาเสียบสายหรือเปิดใช้งานกล้อง");
      } else if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
        setErrorMessage("กล้องกำลังถูกใช้งานโดยแอปพลิเคชันหรือแท็บอื่น กรุณาปิดโปรแกรมอื่นแล้วลองใหม่อีกครั้ง");
      } else if (error?.name === "OverconstrainedError") {
        setErrorMessage("ความละเอียดของกล้องที่ร้องขอไม่ได้รับการสนับสนุน กรุณาลองใหม่อีกครั้ง");
      } else {
        setErrorMessage(
          `เกิดข้อผิดพลาดในขั้นตอน [${currentStep}]: ${error?.message || "ไม่สามารถเริ่มต้นได้"}`
        );
      }
    }
  };

  // Full cleanup on unmount
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
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMirrored((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors"
          >
            {isMirrored ? "โหมดกระจก: เปิด (Mirror ON)" : "โหมดกระจก: ปิด (Mirror OFF)"}
          </button>

          <button
            type="button"
            onClick={() => setShowDebug((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors"
          >
            {showDebug ? "ซ่อน Debug Panel" : "แสดง Debug Panel"}
          </button>

          {cameraState === "ready" || cameraState === "requesting" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={stopCamera}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              <span>ปิดกล้อง (Stop Camera)</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="amber"
              onClick={startCamera}
              className="shadow-xs font-semibold"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>เปิดกล้อง (Start Camera)</span>
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

      {/* Error Alert Message with Technical Diagnostics */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setErrorDetails(null);
              }}
              className="text-red-500 hover:text-red-700 font-semibold"
            >
              ✕
            </button>
          </div>

          {errorDetails && (
            <details className="mt-2 text-xs bg-white p-3 rounded-lg border border-red-200">
              <summary className="font-mono cursor-pointer text-red-700 font-semibold hover:underline">
                ดูรายละเอียดทางเทคนิค (Developer Diagnostic Information)
              </summary>
              <div className="mt-2 font-mono text-[11px] text-slate-700 space-y-1 overflow-x-auto">
                <p><span className="font-bold text-slate-900">Step:</span> {errorDetails.step}</p>
                <p><span className="font-bold text-slate-900">Error Name:</span> {errorDetails.name}</p>
                <p><span className="font-bold text-slate-900">Message:</span> {errorDetails.message}</p>
                {errorDetails.stack && (
                  <pre className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-[10px] whitespace-pre-wrap">
                    {errorDetails.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Main Viewport & Video / Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={showDebug ? "lg:col-span-8" : "lg:col-span-12"}>
          <Card className="overflow-hidden p-0 border-[#E2E8F0]">
            <div className="relative aspect-video w-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
              {/* Webcam Video Element */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 h-full w-full object-cover ${
                  isMirrored ? "scale-x-[-1]" : ""
                } ${cameraState === "ready" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              />

              {/* Landmark Drawing Canvas Overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full pointer-events-none z-10"
              />

              {/* Placeholder when Camera is OFF */}
              {cameraState === "off" && (
                <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[#FFB400]">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">
                      กล้องยังไม่ได้เปิดใช้งาน
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      กดปุ่ม &quot;เปิดกล้อง (Start Camera)&quot; เพื่อเริ่มการตรวจจับท่าทางภาษามือไทยด้วย MediaPipe แบบ Real-time
                    </p>
                  </div>
                  <Button variant="amber" size="md" onClick={startCamera}>
                    เปิดกล้องทันที
                  </Button>
                </div>
              )}

              {/* Placeholder when Requesting Camera Permission */}
              {cameraState === "requesting" && (
                <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                  <svg className="animate-spin h-10 w-10 text-[#FFB400]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm font-semibold text-white">
                    กำลังโหลดโมเดล MediaPipe Vision & ขออนุญาตกล้อง...
                  </p>
                </div>
              )}

              {/* Real-time On-Screen Overlay Indicators */}
              {cameraState === "ready" && (
                <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2 pointer-events-none">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-black/60 text-white backdrop-blur-xs border border-white/20">
                    FPS: {debugStats.fps}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-black/60 text-white backdrop-blur-xs border border-white/20">
                    มือที่ตรวจพบ: {debugStats.handsCount} ข้าง
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Developer Debug Panel */}
        {showDebug && (
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-6 space-y-5 bg-white border-[#E2E8F0]">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#FFB400]" />
                  <h3 className="font-bold text-[#0F172A] text-sm">
                    Developer Debug Panel
                  </h3>
                </div>
                <Badge variant="tag">Real-time</Badge>
              </div>

              {/* Status List */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Camera State:</span>
                  <span className="font-mono font-bold text-[#0F172A] uppercase">
                    {cameraState}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Hands Detected:</span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {debugStats.handsCount} / 2
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Left Hand:</span>
                  <Badge variant={debugStats.hasLeftHand ? "success" : "default"}>
                    {debugStats.hasLeftHand ? "Detected (ตรวจพบ)" : "Not detected"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Right Hand:</span>
                  <Badge variant={debugStats.hasRightHand ? "primary" : "default"}>
                    {debugStats.hasRightHand ? "Detected (ตรวจพบ)" : "Not detected"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Body Pose (Upper body):</span>
                  <Badge variant={debugStats.hasPose ? "success" : "default"}>
                    {debugStats.hasPose ? "Detected (ตรวจพบ)" : "Not detected"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Frame Rate (FPS):</span>
                  <span className="font-mono font-bold text-emerald-600">
                    ~{debugStats.fps} FPS
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[#64748B]">Inference Latency:</span>
                  <span className="font-mono text-[#0F172A]">
                    {debugStats.latencyMs} ms
                  </span>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-[11px] text-[#64748B] leading-relaxed">
                <span className="font-semibold text-[#0F172A] block mb-0.5">
                  🛡️ Local Processing & Privacy
                </span>
                การตรวจจับโครงสร้างมือและร่างกายทำงานบนเบราว์เซอร์ของคุณโดยตรง ไม่มีการส่งภาพหรือวิดีโอไปยัง Server
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
