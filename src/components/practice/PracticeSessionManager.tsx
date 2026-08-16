"use client";

import * as React from "react";
import Link from "next/link";

import { Category, Lesson, ReferenceGesture } from "@/types";
import { Card, Button, Badge } from "@/components/ui";
import { usePracticeSession } from "@/lib/practice/usePracticeSession";
import { PracticeResultCard } from "./PracticeResultCard";
import { PracticeDiagnosticPanel } from "./PracticeDiagnosticPanel";
import { PracticeGuide } from "./PracticeGuide";



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

import { getCategories } from "@/lib/storage/categoryStorage";
import { getLessons } from "@/lib/storage/lessonStorage";

interface PracticeSessionManagerProps {
  lessons: Lesson[];
  categories?: Category[];
  initialLessonId?: string;
  initialReference?: ReferenceGesture | null;
}

export function PracticeSessionManager({
  lessons: initialLessons,
  categories: initialCategories = [],
  initialLessonId = "hello",
}: PracticeSessionManagerProps) {
  const [activeLessons, setActiveLessons] = React.useState<Lesson[]>(initialLessons);
  const [activeCategories, setActiveCategories] = React.useState<Category[]>(initialCategories);
  const [selectedLessonId, setSelectedLessonId] = React.useState<string>(initialLessonId);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("");

  // Sync lessons and categories from storage on mount & read ?lesson=... query param
  React.useEffect(() => {
    let isMounted = true;

    const loadLiveData = async () => {
      try {
        const [storedCats, storedLessons] = await Promise.all([
          getCategories(),
          getLessons(),
        ]);
        if (!isMounted) return;

        if (storedCats && storedCats.length > 0) {
          setActiveCategories(storedCats);
        }
        if (storedLessons && storedLessons.length > 0) {
          setActiveLessons(storedLessons);
        }

        // Check if query param specified a custom lesson
        const urlParams = new URLSearchParams(window.location.search);
        const queryLesson = urlParams.get("lesson");
        if (queryLesson) {
          setSelectedLessonId(queryLesson);
        }
      } catch {
        // fallback to initial
      }
    };

    loadLiveData();

    const handleStorageChange = () => {
      loadLiveData();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // 1. Select Active Lesson
  const selectedLesson = React.useMemo(() => {
    return (
      activeLessons.find((l) => l.id === selectedLessonId) || activeLessons[0] || {
        id: "hello",
        categoryId: "greeting-basic",
        word: "สวัสดี",
        description: "พนมมือระดับอกแล้วก้มศีรษะลงเล็กน้อย",
        gestureType: "dynamic",
        order: 1,
        difficulty: "beginner",
        isActive: true,
      }
    );
  }, [activeLessons, selectedLessonId]);


  // 1.1 Compute Categorized Tabs
  const categoryTabs = React.useMemo(() => {
    const tabs: { id: string; name: string; count: number; order: number }[] = [];
    const knownCatIds = new Set<string>();

    activeCategories.forEach((cat) => {
      knownCatIds.add(cat.id);
      const count = activeLessons.filter((l) => l.categoryId === cat.id).length;
      if (count > 0) {
        tabs.push({
          id: cat.id,
          name: cat.name,
          count,
          order: cat.order ?? 0,
        });
      }
    });

    // Sort categories by order
    tabs.sort((a, b) => a.order - b.order);

    // Uncategorized lessons (where categoryId is missing or not in activeCategories)
    const uncategorizedCount = activeLessons.filter(
      (l) => !l.categoryId || !knownCatIds.has(l.categoryId)
    ).length;

    if (uncategorizedCount > 0) {
      tabs.push({
        id: "__uncategorized__",
        name: "อื่นๆ",
        count: uncategorizedCount,
        order: 9999,
      });
    }

    return tabs;
  }, [activeCategories, activeLessons]);

  // Set / Sync selected category tab based on selected lesson
  React.useEffect(() => {
    if (selectedLesson) {
      const lessonCatId = selectedLesson.categoryId;
      const isKnownCat = activeCategories.some((c) => c.id === lessonCatId);
      const targetCatId = isKnownCat ? lessonCatId : (categoryTabs[0]?.id || "__uncategorized__");

      setSelectedCategoryId((prev) => {
        if (!prev) return targetCatId;
        const exists = categoryTabs.some((t) => t.id === prev);
        return exists ? prev : targetCatId;
      });
    }
  }, [selectedLesson, activeCategories, categoryTabs]);

  // Lessons displayed in the currently selected Category Tab
  const displayedLessons = React.useMemo(() => {
    if (!selectedCategoryId) return activeLessons;
    if (selectedCategoryId === "__uncategorized__") {
      const knownCatIds = new Set(activeCategories.map((c) => c.id));
      return activeLessons.filter((l) => !l.categoryId || !knownCatIds.has(l.categoryId));
    }
    return activeLessons.filter((l) => l.categoryId === selectedCategoryId);
  }, [activeLessons, activeCategories, selectedCategoryId]);



  // 2. Practice Session State & Pipeline
  const {
    referenceGesture,
    referenceCount,
    bestQualityScore,
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

  // Query param-only debug mode (e.g. ?debug=true) — hidden completely in production by default
  const [isDebugMode, setIsDebugMode] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setIsDebugMode(params.get("debug") === "true");
    }
  }, []);

  const currentStepNumber =
    sessionState === "completed" || sessionState === "analyzing"
      ? 3
      : cameraState === "ready"
      ? 2
      : 1;

  const currentStepName =
    currentStepNumber === 1
      ? "ขั้นตอนที่ 1/3: เลือกคำศัพท์ & เปิดกล้อง"
      : currentStepNumber === 2
      ? sessionState === "practicing"
        ? "ขั้นตอนที่ 2/3: กำลังบันทึกท่าทาง (กดหยุดเมื่อทำเสร็จ)"
        : "ขั้นตอนที่ 2/3: กดเริ่มฝึกและทำท่าทาง"
      : "ขั้นตอนที่ 3/3: ประเมินคะแนน & คำแนะนำจาก AI";

  const renderWordSelectorCard = () => (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
          เลือกคำศัพท์ที่ต้องการฝึก ({activeLessons.length} คำ):
        </span>
        <Badge variant="tag">
          {selectedLesson.gestureType === "dynamic"
            ? "ท่าทางต่อเนื่อง (Dynamic)"
            : "ท่าทางคงที่ (Static)"}
        </Badge>
      </div>

      {/* Category Tabs with Horizontal Scroll for Mobile & Desktop */}
      {categoryTabs.length > 1 && (
        <div className="relative border-b border-[#E2E8F0] -mx-4 sm:-mx-5 px-4 sm:px-5">
          <div
            className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-0.5 flex-nowrap"
            role="tablist"
            aria-label="หมวดหมู่คำศัพท์สำหรับฝึกฝน"
          >
            {categoryTabs.map((tab) => {
              const isSelected = selectedCategoryId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedCategoryId(tab.id);
                    // Auto-select first word in this tab if current word is not in this tab
                    const wordsInTab =
                      tab.id === "__uncategorized__"
                        ? activeLessons.filter(
                            (l) => !l.categoryId || !activeCategories.some((c) => c.id === l.categoryId)
                          )
                        : activeLessons.filter((l) => l.categoryId === tab.id);

                    if (wordsInTab.length > 0 && !wordsInTab.some((w) => w.id === selectedLessonId)) {
                      setSelectedLessonId(wordsInTab[0].id);
                      resetSession();
                    }
                  }}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-[#0F172A] text-white shadow-xs"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0]"
                  }`}
                >
                  <span>{tab.name}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-normal ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-[#F1F5F9] text-[#64748B]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selectable Words Chips Grid with Max-Height (Scrollable if > 20 words) */}
      <div
        className="flex flex-wrap gap-2 max-h-[220px] lg:max-h-[280px] overflow-y-auto pr-1"
        role="radiogroup"
        aria-label="เลือกคำศัพท์สำหรับฝึกฝน"
      >
        {displayedLessons.length === 0 ? (
          <div className="w-full py-3 text-center text-xs text-[#64748B]">
            ไม่พบคำศัพท์ในหมวดหมู่นี้
          </div>
        ) : (
          displayedLessons.map((item) => {
            const isSelected = item.id === selectedLessonId;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  setSelectedLessonId(item.id);
                  resetSession();
                }}
                className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm transition-all text-left cursor-pointer ${
                  isSelected
                    ? "bg-[#E0F2FE] text-[#0C4A6E] border-2 border-[#0EA5E9] font-semibold shadow-xs"
                    : "bg-white text-[#475569] border border-[#E2E8F0] font-normal hover:bg-[#F8FAFC] hover:border-[#CBD5E1] hover:text-[#0F172A]"
                }`}
              >
                {isSelected ? (
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0EA5E9] text-white font-bold text-[9px] shrink-0"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                ) : (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{item.word}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Selected Word Description */}
      <div className="p-3 bg-[#F0F9FF] rounded-xl border border-[#BAE6FD] text-xs text-[#0C4A6E] flex items-start gap-2.5">
        <span className="font-bold text-sm text-[#0284C7] shrink-0">💡</span>
        <div className="space-y-0.5">
          <span className="font-bold text-[#0F172A]">วิธีทำท่า &quot;{selectedLesson.word}&quot;: </span>
          <span className="leading-relaxed text-[#475569]">{selectedLesson.description}</span>
        </div>
      </div>
    </div>
  );

  const renderDemoVideoCard = () => {
    const videoSrc = selectedLesson.videoUrl || selectedLesson.demoVideoUrl;

    return (
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#0F172A]">📹 วิดีโอตัวอย่างท่าทาง</span>
            <Badge variant="tag">Demo Sign</Badge>
          </div>
          {videoSrc ? (
            <Badge variant="success" className="text-[10px]">
              มีคลิปต้นแบบ
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              คำอธิบายท่าทาง
            </Badge>
          )}
        </div>

        {videoSrc ? (
          <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video max-h-[220px] flex items-center justify-center border border-slate-200 shadow-inner">
            <video
              key={videoSrc}
              src={videoSrc}
              controls
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1.5 flex flex-col items-center justify-center">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center text-lg font-bold">
              🖐️
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#0F172A] block">
                ยังไม่มีคลิปวิดีโอตัวอย่าง
              </span>
              <p className="text-[11px] text-[#64748B] max-w-xs">
                สามารถศึกษาลักษณะท่าทาง &quot;{selectedLesson.word}&quot; ได้จากคำอธิบายและแนวทางการวางมือด้านล่าง
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLessonGuideCard = () => (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#0F172A]">คำศัพท์ที่เลือก</span>
          <Badge variant="primary" className="font-bold">
            {selectedLesson.word}
          </Badge>
        </div>
        <Badge variant="tag">
          {selectedLesson.difficulty === "beginner" && "ระดับ: ง่าย"}
          {selectedLesson.difficulty === "intermediate" && "ระดับ: ปานกลาง"}
          {selectedLesson.difficulty === "advanced" && "ระดับ: ขั้นสูง"}
          {!selectedLesson.difficulty && "ระดับ: ทั่วไป"}
        </Badge>
      </div>

      <div className="p-3.5 bg-[#F0F9FF] rounded-xl border border-[#BAE6FD] space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0369A1]">
          <span>💡 วิธีทำท่าภาษามือ:</span>
        </div>
        <p className="text-xs sm:text-sm text-[#0F172A] leading-relaxed">
          {selectedLesson.description || "ทำท่าทางตามตัวอย่างให้ชัดเจนและมั่นคง"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <span className="text-[#64748B] block">ประเภทท่าทาง</span>
          <span className="font-semibold text-[#0F172A]">
            {selectedLesson.gestureType === "dynamic" ? "🔄 ท่าต่อเนื่อง (Dynamic)" : "🖐️ ท่าคงที่ (Static Hold)"}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <span className="text-[#64748B] block">ต้นแบบในระบบ</span>
          <span className="font-semibold text-[#0F172A]">
            {referenceCount > 0 ? `✓ มี ${referenceCount} ตัวอย่าง` : "⚡ ใช้เกณฑ์มาตรฐาน"}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 pt-1 border-t border-slate-100 text-xs text-[#64748B]">
        <span className="font-semibold text-[#334155] block">คำแนะนำขณะฝึกฝน:</span>
        <ul className="space-y-1 pl-1">
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>จัดระยะห่างให้เห็นท่อนแขนและมือชัดเจนในมุมกล้อง</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>หันฝ่ามือและตำแหน่งนิ้วให้ตรงกับคำอธิบาย</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>เมื่อทำท่าเสร็จแล้ว ให้กดปุ่ม &quot;หยุดและตรวจคะแนน&quot;</span>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
      {/* LEFT COLUMN: Demo Video Preview, Word Selector & Lesson Guidance */}
      <div className="lg:col-span-5 xl:col-span-5 space-y-4 w-full">
        {/* 1. Demo Video Preview Card (Top of Left Column) */}
        {renderDemoVideoCard()}

        {/* 2. Word Selector Card */}
        {renderWordSelectorCard()}

        {/* 3. Lesson Guidance Card */}
        {renderLessonGuideCard()}

        {/* 4. Collapsible 3-Step Guide */}
        <PracticeGuide />
      </div>

      {/* RIGHT COLUMN: Live Camera, Practice Controls & Evaluation Results */}
      <div className="lg:col-span-7 xl:col-span-7 space-y-4 min-w-0">
        {/* 1. Practice Header Banner */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Badge variant="default">ฝึกฝนด้วย AI</Badge>
              <h1 className="text-base sm:text-lg font-bold text-[#0F172A]">
                ห้องฝึกภาษามือกับ AI
              </h1>
            </div>
            <p className="text-xs text-[#64748B]">
              ฝึกทำท่าทางผ่านกล้อง ระบบจะเปรียบเทียบกับต้นแบบและให้คะแนนทันที
            </p>
          </div>

          <Link
            href="/lessons"
            className="text-xs font-semibold text-[#0284C7] hover:text-[#0369A1] inline-flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-xl hover:bg-sky-50 transition-colors"
          >
            <span>← คลังบทเรียน</span>
          </Link>
        </div>

        {/* 2. Step Indicator Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#F0F9FF] rounded-xl border border-[#BAE6FD] text-xs font-semibold text-[#0369A1]">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0EA5E9] text-white font-bold text-[11px]">
              {currentStepNumber}
            </span>
            <span>{currentStepName}</span>
          </div>
          <span className="text-[11px] text-[#0284C7] font-normal hidden sm:inline">
            {currentStepNumber === 1 && "เลือกคำศัพท์ด้านซ้าย แล้วกดปุ่มเปิดกล้อง"}
            {currentStepNumber === 2 && "ทำท่าทางตามตัวอย่าง แล้วกดหยุดเพื่อตรวจคะแนน"}
            {currentStepNumber === 3 && "ดูคะแนนความถูกต้องแยกตามส่วนและคำแนะนำ"}
          </span>
        </div>

        {/* 3. Evaluation Result Panel (Appears at top of right column when completed) */}
        {sessionState === "completed" && evaluationResult && (
          <PracticeResultCard
            result={evaluationResult}
            word={selectedLesson.word}
            onReset={resetSession}
          />
        )}

        {/* 4. Top Camera Controls & Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  cameraState === "ready"
                    ? "bg-emerald-500 animate-pulse"
                    : cameraState === "requesting"
                    ? "bg-amber-400 animate-ping"
                    : cameraState === "error"
                    ? "bg-red-500"
                    : "bg-slate-300"
                }`}
              />
              <span className="text-xs sm:text-sm font-semibold text-[#0F172A]">
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
              {cameraState === "ready" && "พร้อมตรวจจับ"}
              {cameraState === "requesting" && "กำลังเปิดกล้อง..."}
              {cameraState === "error" && "Camera Error"}
              {cameraState === "off" && "Camera Off"}
            </Badge>

            {sessionState === "practicing" && (
              <Badge variant="warning" className="animate-pulse">
                🔴 กำลังบันทึก: {liveDurationSec}s
              </Badge>
            )}

            {sessionState === "analyzing" && (
              <Badge variant="default" className="animate-pulse">
                ⚡ กำลังวิเคราะห์...
              </Badge>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMirrored((prev) => !prev)}
              title="สลับภาพให้เหมือนกระจกเงา"
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              {isMirrored ? "กระจก: เปิด" : "กระจก: ปิด"}
            </button>

            {isDebugMode && (
              <button
                type="button"
                onClick={() => setShowDebug((prev) => !prev)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                {showDebug ? "ซ่อน Debug" : "แสดง Debug"}
              </button>
            )}

            {cameraState === "ready" || cameraState === "requesting" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={stopCamera}
                className="text-red-600 border-red-200 hover:bg-red-50 text-xs py-1 h-8"
              >
                ปิดกล้อง
              </Button>
            ) : (
              <Button
                size="sm"
                variant="amber"
                onClick={startCamera}
                className="shadow-xs font-semibold text-xs py-1 h-8"
              >
                เปิดกล้อง
              </Button>
            )}
          </div>
        </div>

        {/* Loading Step Progress Indicator */}
        {cameraState === "requesting" && initStepMessage && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2.5">
            <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="font-medium">{initStepMessage}</span>
          </div>
        )}

        {/* Camera / Practice Errors */}
        {(cameraError || practiceError) && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex flex-wrap items-center justify-between gap-2.5 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span>⚠️ {cameraError || practiceError}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCameraError(null);
                  resetSession();
                }}
                className="text-red-700 border-red-300 hover:bg-red-100 font-semibold text-xs py-1 h-7"
              >
                ↻ รีเซ็ตลองใหม่
              </Button>
            </div>
          </div>
        )}

        {/* 5. Compact Main Viewport & Video / Canvas Area */}
        <Card className="overflow-hidden p-0 border-[#E2E8F0] shadow-sm rounded-2xl bg-slate-950">
          <div
            className={`relative w-full max-h-[360px] sm:max-h-[380px] aspect-video bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300 ${
              cameraState === "ready" || cameraState === "requesting"
                ? "h-[280px] sm:h-[340px] lg:h-[360px]"
                : "h-[180px] sm:h-[220px]"
            }`}
          >
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

            {/* Real-time Live Practice HUD */}
            {sessionState === "practicing" && liveFeedback && (
              <div className="absolute top-2.5 inset-x-2.5 sm:top-3 sm:inset-x-3 z-20 flex flex-col gap-1.5 pointer-events-none animate-fadeIn">
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-white/15 shadow-md text-white">
                  {/* Live Score Pill */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wider flex items-center gap-1 shadow-xs ${
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
                    <span className="text-xs sm:text-sm font-semibold truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                      {liveFeedback.severity === "success" && "🟢 "}
                      {liveFeedback.severity === "warning" && "🟡 "}
                      {liveFeedback.severity === "error" && "🔴 "}
                      {liveFeedback.primaryFeedback}
                    </span>
                  </div>

                  {/* Gesture Progress if dynamic */}
                  {selectedLesson.gestureType === "dynamic" && (
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-300 shrink-0">
                      <span className="hidden sm:inline">จังหวะท่า:</span>
                      <div className="w-14 sm:w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0EA5E9] transition-all duration-100"
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

            {/* Analyzing Processing Overlay inside Video Viewport */}
            {sessionState === "analyzing" && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-white p-6 space-y-3 animate-fadeIn">
                <div className="w-10 h-10 border-3 border-[#0EA5E9] border-t-transparent rounded-full animate-spin" />
                <div className="text-center space-y-1">
                  <h4 className="text-base font-bold text-white">กำลังวิเคราะห์ผลคะแนน AI...</h4>
                  <p className="text-xs text-slate-300">ระบบกำลังคำนวณความแม่นยำด้วย DTW & Scoring Engine</p>
                </div>
              </div>
            )}

            {/* Standby screen when camera is off */}
            {cameraState === "off" && (
              <div className="flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                <div className="h-11 w-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[#0EA5E9]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-slate-200">
                    กล้องยังไม่ได้เปิดใช้งาน
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs">
                    กดปุ่ม &quot;เปิดกล้อง&quot; ด้านบน เพื่อเริ่มการตรวจจับท่าทางภาษามือแบบ Real-time
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 6. Practice Action Controls Bar (Prominent Outside Video Feed) */}
        {cameraState === "ready" && (
          <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex items-center gap-3">
              {sessionState === "idle" && (
                <Button
                  variant="amber"
                  size="lg"
                  onClick={startPractice}
                  className="w-full sm:w-auto font-bold shadow-xs px-8 py-3 text-sm sm:text-base rounded-xl"
                >
                  ▶ เริ่มฝึกท่า &quot;{selectedLesson.word}&quot; (Start Practice)
                </Button>
              )}

              {sessionState === "practicing" && (
                <button
                  type="button"
                  onClick={stopAndAnalyze}
                  className="w-full sm:w-auto min-h-[46px] px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer animate-pulse"
                >
                  <span className="text-lg leading-none">⏹</span>
                  <span>หยุดและตรวจคะแนน (Stop & Evaluate)</span>
                </button>
              )}

              {sessionState === "analyzing" && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[#0284C7] text-xs font-semibold">
                  <div className="w-4 h-4 border-2 border-[#0EA5E9] border-t-transparent rounded-full animate-spin" />
                  <span>กำลังประเมินผลคะแนน AI...</span>
                </div>
              )}

              {sessionState === "completed" && (
                <Button
                  variant="amber"
                  size="md"
                  onClick={resetSession}
                  className="font-bold shadow-xs px-6 py-2.5 rounded-xl"
                >
                  ↻ ฝึกใหม่อีกครั้ง (Practice Again)
                </Button>
              )}

              {sessionState === "error" && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={resetSession}
                  className="font-bold text-red-600 border-red-200 hover:bg-red-50 rounded-xl"
                >
                  ↻ ลองใหม่อีกครั้ง (Try Again)
                </Button>
              )}
            </div>

            <div className="text-xs text-[#64748B] flex items-center gap-2">
              {sessionState === "idle" && "กดปุ่มเริ่มฝึกเมื่อจัดท่าพร้อมแล้ว"}
              {sessionState === "practicing" && (
                <span className="text-red-600 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  กำลังบันทึก: {liveDurationSec}s ({liveFrameCount} เฟรม)
                </span>
              )}
              {sessionState === "analyzing" && "กำลังประมวลผลความแม่นยำด้วย Scoring Engine..."}
              {sessionState === "completed" && "ประเมินผลเรียบร้อยแล้ว"}
              {sessionState === "error" && "กดปุ่มเพื่อเริ่มใหม่อีกครั้ง"}
            </div>
          </div>
        )}

        {/* 7. Live AI Component Scores & Real-Time Finger Feedback */}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-xs">
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

        {/* Real-World Diagnostic & Telemetry Panel */}
        {isDebugMode && showDebug && (
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
        )}
      </div>
    </div>
  );
}




