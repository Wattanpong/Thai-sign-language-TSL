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
import {
  saveReferenceGesture,
  getReferenceGestureByLessonId,
  deleteReferenceGesture,
} from "@/lib/storage/referenceStorage";
import type { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Lesson, ReferenceGesture, ReferenceFrame, ReferenceHand, RecordingStatus } from "@/types";
import { Button, Card, Badge } from "@/components/ui";

export interface ReferenceRecorderProps {
  lesson: Lesson;
  onSaved?: (savedGesture: ReferenceGesture) => void;
  onCancel?: () => void;
}

export function ReferenceRecorder({ lesson, onSaved, onCancel }: ReferenceRecorderProps) {
  // Camera & Detection States
  const [cameraState, setCameraState] = React.useState<"off" | "requesting" | "ready" | "error">("off");
  const [recordingStatus, setRecordingStatus] = React.useState<RecordingStatus>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isMirrored, setIsMirrored] = React.useState(true);

  // Existing Stored Reference
  const [existingGesture, setExistingGesture] = React.useState<ReferenceGesture | null>(null);
  const [recordedGesture, setRecordedGesture] = React.useState<ReferenceGesture | null>(null);

  // Live Recording Metrics State (for UI)
  const [liveDurationSec, setLiveDurationSec] = React.useState<number>(0);
  const [liveFrameCount, setLiveFrameCount] = React.useState<number>(0);

  // DOM and Model Refs
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const animationFrameIdRef = React.useRef<number | null>(null);

  const handLandmarkerRef = React.useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = React.useRef<PoseLandmarker | null>(null);
  const isDetectingRef = React.useRef<boolean>(false);
  const isMirroredRef = React.useRef<boolean>(isMirrored);

  // Recording Buffers in Refs (avoids per-frame state re-renders)
  const isRecordingRef = React.useRef<boolean>(false);
  const recordingStartTimeRef = React.useRef<number>(0);
  const lastSampleTimeRef = React.useRef<number>(0);
  const recordedFramesRef = React.useRef<ReferenceFrame[]>([]);
  const TARGET_SAMPLE_INTERVAL_MS = 40; // ~25 FPS sampling

  // Synchronize isMirroredRef
  React.useEffect(() => {
    isMirroredRef.current = isMirrored;
  }, [isMirrored]);

  // Load existing saved reference on component mount
  React.useEffect(() => {
    async function loadExisting() {
      const stored = await getReferenceGestureByLessonId(lesson.id);
      if (stored) {
        setExistingGesture(stored);
      }
    }
    loadExisting();
  }, [lesson.id]);

  /**
   * Stop camera stream & cancel detection loop
   */
  const stopCamera = React.useCallback(() => {
    isDetectingRef.current = false;
    isRecordingRef.current = false;

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
  }, []);

  /**
   * Continuous Detection & Recording Loop
   */
  const startLoop = React.useCallback(function executeLoop() {
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

        const now = performance.now();
        const timestampMs = now;

        let handResult = null;
        let poseResult = null;

        if (handLandmarkerRef.current) {
          try {
            handResult = detectHandsForVideo(handLandmarkerRef.current, video, timestampMs);
          } catch {
            // ignore
          }
        }

        if (poseLandmarkerRef.current) {
          try {
            poseResult = detectPoseForVideo(poseLandmarkerRef.current, video, timestampMs);
          } catch {
            // ignore
          }
        }

        // Render Canvas Overlays
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

        // Sampling & Recording logic
        if (isRecordingRef.current) {
          const elapsed = now - recordingStartTimeRef.current;
          const timeSinceLastSample = now - lastSampleTimeRef.current;

          if (timeSinceLastSample >= TARGET_SAMPLE_INTERVAL_MS) {
            lastSampleTimeRef.current = now;

            // Extract hand data
            const recordedHands: ReferenceHand[] = [];
            if (handResult && handResult.landmarks) {
              handResult.landmarks.forEach((landmarks, hIdx) => {
                const handednessInfo = handResult.handednesses[hIdx]?.[0];
                const handedness = handednessInfo?.categoryName.toLowerCase().includes("left")
                  ? "Left"
                  : "Right";

                recordedHands.push({
                  handedness,
                  landmarks: landmarks.map((pt) => ({
                    x: pt.x,
                    y: pt.y,
                    z: pt.z,
                    visibility: pt.visibility,
                  })),
                });
              });
            }

            // Extract upper body / pose data
            const recordedPose = (poseResult?.landmarks[0] || []).map((pt) => ({
              x: pt.x,
              y: pt.y,
              z: pt.z,
              visibility: pt.visibility,
            }));

            recordedFramesRef.current.push({
              timestampMs: Math.round(elapsed),
              hands: recordedHands,
              pose: recordedPose,
            });

            // Update live metrics for UI
            setLiveDurationSec(Number((elapsed / 1000).toFixed(1)));
            setLiveFrameCount(recordedFramesRef.current.length);
          }
        }
      }
    }

    if (isDetectingRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(executeLoop);
    }
  }, [TARGET_SAMPLE_INTERVAL_MS]);

  const [initStepMessage, setInitStepMessage] = React.useState<string | null>(null);
  const [errorDetails, setErrorDetails] = React.useState<{
    name?: string;
    message?: string;
    step?: string;
    stack?: string;
  } | null>(null);

  /**
   * Start Camera Stream
   */
  const startCamera = async () => {
    setErrorMessage(null);
    setErrorDetails(null);
    setSuccessMessage(null);
    setCameraState("requesting");

    let currentStep = "ตรวจสอบสภาพแวดล้อม (Browser Environment Check)";

    try {
      setInitStepMessage("กำลังตรวจสอบสภาพแวดล้อมและเบราว์เซอร์...");
      if (!isBrowserSupported()) {
        throw new Error("เบราว์เซอร์ของคุณไม่รองรับกล้องหรือ WebAssembly");
      }

      // 1. Hand Landmarker
      currentStep = "เริ่มต้น MediaPipe HandLandmarker (โมเดลตรวจจับมือ)";
      setInitStepMessage("กำลังโหลดโมเดลตรวจจับมือ (MediaPipe HandLandmarker)...");
      if (!handLandmarkerRef.current) {
        handLandmarkerRef.current = await createHandLandmarker({
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      // 2. Pose Landmarker
      currentStep = "เริ่มต้น MediaPipe PoseLandmarker (โมเดลตรวจจับโครงสร้างร่างกาย)";
      setInitStepMessage("กำลังโหลดโมเดลตรวจจับร่างกาย (MediaPipe PoseLandmarker)...");
      if (!poseLandmarkerRef.current) {
        poseLandmarkerRef.current = await createPoseLandmarker({
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      // 3. getUserMedia
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

      // 4. Video play
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
      animationFrameIdRef.current = requestAnimationFrame(startLoop);
    } catch (err: unknown) {
      stopCamera();
      setCameraState("error");
      setInitStepMessage(null);

      const error = err as { name?: string; message?: string; stack?: string };
      console.error(`[Admin Reference Camera Error at step "${currentStep}"]`, err);

      setErrorDetails({
        name: error?.name || "Error",
        message: error?.message || String(err),
        step: currentStep,
        stack: error?.stack,
      });

      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        setErrorMessage("กรุณากดอนุญาตการเข้าถึงกล้องเว็บแคมในแถบเบราว์เซอร์เพื่อเริ่มบันทึกท่าทาง");
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        setErrorMessage("ไม่พบอุปกรณ์กล้องเว็บแคมที่เชื่อมต่ออยู่ กรุณาตรวจสอบการเชื่อมต่อกล้อง");
      } else if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
        setErrorMessage("กล้องกำลังถูกใช้งานโดยแอปพลิเคชันหรือแท็บอื่น กรุณาปิดโปรแกรมอื่นแล้วลองใหม่");
      } else if (error?.name === "OverconstrainedError") {
        setErrorMessage("ความละเอียดของกล้องที่ร้องขอไม่ได้รับการสนับสนุน กรุณาลองใหม่อีกครั้ง");
      } else {
        setErrorMessage(
          `เกิดข้อผิดพลาดในขั้นตอน [${currentStep}]: ${error?.message || "ไม่สามารถเริ่มต้นได้"}`
        );
      }
    }
  };

  /**
   * Start Recording gesture landmarks
   */
  const handleStartRecording = () => {
    if (cameraState !== "ready") {
      setErrorMessage("กรุณาเปิดกล้องให้พร้อมก่อนเริ่มบันทึกท่าทาง");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setRecordedGesture(null);
    recordedFramesRef.current = [];
    recordingStartTimeRef.current = performance.now();
    lastSampleTimeRef.current = performance.now();
    setLiveDurationSec(0);
    setLiveFrameCount(0);

    isRecordingRef.current = true;
    setRecordingStatus("recording");
  };

  /**
   * Stop Recording gesture landmarks & Validate
   */
  const handleStopRecording = () => {
    isRecordingRef.current = false;
    const totalDuration = Math.round(performance.now() - recordingStartTimeRef.current);
    const frames = [...recordedFramesRef.current];

    // Validation
    const totalHandsDetected = frames.reduce((acc, f) => acc + f.hands.length, 0);
    const hasPoseDetected = frames.some((f) => f.pose.length > 0);

    if (frames.length === 0 || totalDuration < 300) {
      setErrorMessage("ระยะเวลาการบันทึกสั้นเกินไป กรุณาบันทึกใหม่อีกครั้ง");
      setRecordingStatus("idle");
      return;
    }

    if (totalHandsDetected === 0) {
      setErrorMessage("ไม่พบตำแหน่งมือในระหว่างการบันทึก กรุณาจัดตำแหน่งมือให้อยู่ในมุมกล้องแล้วลองใหม่");
      setRecordingStatus("idle");
      return;
    }

    if (!hasPoseDetected) {
      setErrorMessage("ไม่พบตำแหน่งร่างกายในระหว่างการบันทึก กรุณาให้เห็นลำตัวท่อนบนชัดเจน");
      setRecordingStatus("idle");
      return;
    }

    const newGesture: ReferenceGesture = {
      id: `ref_${lesson.id}_${Date.now()}`,
      lessonId: lesson.id,
      word: lesson.word,
      createdAt: new Date().toISOString(),
      durationMs: totalDuration,
      frameCount: frames.length,
      frames,
      notes: `Recorded reference for lesson: ${lesson.word}`,
    };

    setRecordedGesture(newGesture);
    setRecordingStatus("recorded");
  };

  /**
   * Reset recording buffer
   */
  const handleResetRecording = () => {
    isRecordingRef.current = false;
    recordedFramesRef.current = [];
    setRecordedGesture(null);
    setRecordingStatus("idle");
    setLiveDurationSec(0);
    setLiveFrameCount(0);
    setErrorMessage(null);
  };

  /**
   * Save Reference Gesture to Storage
   */
  const handleSaveReference = async () => {
    if (!recordedGesture) return;

    setRecordingStatus("saving");
    try {
      await saveReferenceGesture(recordedGesture);
      setExistingGesture(recordedGesture);
      setRecordingStatus("saved");
      setSuccessMessage(`บันทึก Reference Gesture สำหรับคำว่า "${lesson.word}" สำเร็จเรียบร้อย`);
      if (onSaved) {
        onSaved(recordedGesture);
      }
    } catch {
      setRecordingStatus("error");
      setErrorMessage("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
    }
  };

  /**
   * Delete existing stored reference
   */
  const handleDeleteExisting = async () => {
    if (!confirm(`ยืนยันการลบ Reference Gesture เดิมของคำว่า "${lesson.word}" หรือไม่?`)) {
      return;
    }

    await deleteReferenceGesture(lesson.id);
    setExistingGesture(null);
    setSuccessMessage("ลบ Reference Gesture เดิมเรียบร้อยแล้ว");
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
      {/* Existing Saved Gesture Notification Banner */}
      {existingGesture && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-emerald-900">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 font-bold text-xs">
              ✓
            </span>
            <div>
              <span className="font-semibold block">
                มี Reference Gesture ที่บันทึกไว้แล้วในระบบ
              </span>
              <span className="text-emerald-700 text-xs">
                รหัส: {existingGesture.id} • บันทึกเมื่อ: {new Date(existingGesture.createdAt).toLocaleString("th-TH")} • ความยาว: {(existingGesture.durationMs / 1000).toFixed(1)} วินาที ({existingGesture.frameCount} เฟรม)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteExisting}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              ลบ Reference เดิม
            </Button>
          </div>
        </div>
      )}

      {/* Success Alert Message */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓ {successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 font-semibold"
          >
            ✕
          </button>
        </div>
      )}

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
              <span className="text-base">⚠️</span>
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

      {/* Main Recording Viewport & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Camera Viewport */}
        <div className="lg:col-span-8 space-y-4">
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

              {/* Standby screen when Camera is OFF */}
              {cameraState === "off" && (
                <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[#FFB400]">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">
                      เปิดกล้องเพื่อบันทึกท่าทางอ้างอิง: &quot;{lesson.word}&quot;
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      คำอธิบายท่า: {lesson.description}
                    </p>
                  </div>
                  <Button variant="amber" size="md" onClick={startCamera}>
                    เปิดกล้อง (Start Camera)
                  </Button>
                </div>
              )}

              {/* Requesting Camera */}
              {cameraState === "requesting" && (
                <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                  <svg className="animate-spin h-10 w-10 text-[#FFB400]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm font-semibold text-white">
                    กำลังโหลดโมเดล MediaPipe & เริ่มต้นกล้อง...
                  </p>
                </div>
              )}

              {/* Recording Active Indicator on Viewport */}
              {recordingStatus === "recording" && (
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-red-600/90 text-white font-bold text-xs backdrop-blur-xs shadow-lg animate-pulse">
                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
                  <span>กำลังบันทึกท่าทาง... {liveDurationSec}s ({liveFrameCount} เฟรม)</span>
                </div>
              )}
            </div>
          </Card>

          {/* Bottom Control Bar */}
          <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button variant="outline" size="sm" onClick={onCancel}>
                  ← กลับสู่รายการ Reference
                </Button>
              )}

              <button
                type="button"
                onClick={() => setIsMirrored((prev) => !prev)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC]"
              >
                {isMirrored ? "โหมดกระจก: เปิด" : "โหมดกระจก: ปิด"}
              </button>

              {cameraState === "ready" && (
                <Button variant="outline" size="sm" onClick={stopCamera}>
                  ปิดกล้อง
                </Button>
              )}
            </div>

            {/* Recording Action Buttons */}
            <div className="flex items-center gap-3">
              {recordingStatus === "idle" && (
                <Button
                  size="md"
                  variant="amber"
                  onClick={handleStartRecording}
                  disabled={cameraState !== "ready"}
                  className="font-semibold shadow-xs"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600 mr-2" />
                  <span>เริ่มบันทึก (Start Recording)</span>
                </Button>
              )}

              {recordingStatus === "recording" && (
                <Button
                  size="md"
                  variant="primary"
                  onClick={handleStopRecording}
                  className="bg-red-600 text-white hover:bg-red-700 font-semibold shadow-xs animate-pulse"
                >
                  <span className="h-2.5 w-2.5 rounded-sm bg-white mr-2" />
                  <span>หยุดบันทึก (Stop Recording)</span>
                </Button>
              )}

              {(recordingStatus === "recorded" || recordingStatus === "saved") && (
                <>
                  <Button variant="outline" size="sm" onClick={handleResetRecording}>
                    เริ่มบันทึกใหม่
                  </Button>

                  {recordingStatus === "recorded" && (
                    <Button
                      size="md"
                      variant="amber"
                      onClick={handleSaveReference}
                      className="font-semibold shadow-xs"
                    >
                      💾 บันทึก Reference Gesture
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Recording Information & Metadata Panel */}
        <div className="lg:col-span-4 space-y-4">
          {/* Target Word Info Card */}
          <Card className="p-6 space-y-4 bg-white border-[#E2E8F0]">
            <div className="space-y-1">
              <Badge variant="tag">คำศัพท์เป้าหมาย</Badge>
              <h3 className="text-2xl font-bold text-[#0F172A]">{lesson.word}</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                {lesson.description}
              </p>
            </div>

            <div className="pt-2 border-t border-[#F1F5F9] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">ประเภทท่า:</span>
                <span className="font-semibold text-[#0F172A]">{lesson.gestureType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Sampling Rate:</span>
                <span className="font-mono text-[#0F172A]">~25 FPS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">สถานะบันทึก:</span>
                <Badge
                  variant={
                    recordingStatus === "recording"
                      ? "warning"
                      : recordingStatus === "recorded" || recordingStatus === "saved"
                      ? "success"
                      : "default"
                  }
                >
                  {recordingStatus}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Recorded Result Summary Card */}
          {recordedGesture && (
            <Card className="p-6 space-y-4 bg-[#FFFBEB] border-[#FDE68A]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#92400E] uppercase">
                  ผลการบันทึกท่าทาง (Summary)
                </span>
                <Badge variant="primary">พร้อมบันทึก</Badge>
              </div>

              <div className="space-y-2 text-xs text-[#78350F]">
                <div className="flex justify-between">
                  <span>ความยาวเวลา (Duration):</span>
                  <span className="font-mono font-bold">
                    {(recordedGesture.durationMs / 1000).toFixed(2)} วินาที
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>จำนวนเฟรม (Frames):</span>
                  <span className="font-mono font-bold">{recordedGesture.frameCount} เฟรม</span>
                </div>
                <div className="flex justify-between">
                  <span>เฟรมที่มีมือ (Hands):</span>
                  <span className="font-mono font-bold">
                    {recordedGesture.frames.filter((f) => f.hands.length > 0).length} / {recordedGesture.frameCount} เฟรม
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>เฟรมที่มี Pose (Body):</span>
                  <span className="font-mono font-bold">
                    {recordedGesture.frames.filter((f) => f.pose.length > 0).length} / {recordedGesture.frameCount} เฟรม
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  variant="amber"
                  onClick={handleSaveReference}
                  disabled={recordingStatus === "saving" || recordingStatus === "saved"}
                  className="w-full font-semibold shadow-xs"
                >
                  {recordingStatus === "saving" ? "กำลังบันทึก..." : recordingStatus === "saved" ? "✓ บันทึกสำเร็จแล้ว" : "บันทึกข้อมูล Reference"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
