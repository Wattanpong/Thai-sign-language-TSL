"use client";

import * as React from "react";
import {
  Lesson,
  ReferenceGesture,
  ReferenceFrame,
  ReferenceHand,
  HandDetectionResult,
  PoseDetectionResult,
  NormalizedLandmark,
  GestureFeatureSequence,
} from "@/types";
import { getReferencesByLessonId } from "@/lib/storage/referenceStorage";
import { getBestReference } from "@/lib/reference/referenceRanking";
import {
  PracticeSessionState,
  PracticeEvaluationResult,
  evaluatePracticeFrames,
} from "./practiceEngine";
import {
  LiveFeedbackResult,
  LiveFeedbackSmoother,
  computeLiveFeedback,
  getReferenceFrameForLiveFeedback,
} from "./liveFeedback";
import {
  extractFrameFeatures,
  extractGestureSequenceFeatures,
} from "@/lib/gesture/featureExtraction";
import {
  detectScoreAnomalies,
  ScoreAnomalyReport,
} from "./scoreAnomalyDetector";
import { savePracticeSessionRecord } from "@/lib/storage/practiceSessionStorage";

export interface UsePracticeSessionReturn {
  lesson: Lesson;
  referenceGesture: ReferenceGesture | null;
  references: ReferenceGesture[];
  referenceCount: number;
  bestQualityScore: number;
  isLoadingReference: boolean;
  sessionState: PracticeSessionState;
  liveDurationSec: number;
  liveFrameCount: number;
  liveFeedback: LiveFeedbackResult | null;
  evaluationResult: PracticeEvaluationResult | null;
  anomalyReport: ScoreAnomalyReport | null;
  errorMessage: string | null;
  startPractice: () => void;
  stopAndAnalyze: () => void;
  resetSession: () => void;
  ingestFrame: (
    handResult: HandDetectionResult | null,
    poseResult: PoseDetectionResult | null
  ) => void;
}

const SAMPLE_INTERVAL_MS = 40; // ~25 FPS frame sampling rate
const LIVE_FEEDBACK_INTERVAL_MS = 80; // ~12.5 FPS live feedback update rate

export function usePracticeSession(lesson: Lesson): UsePracticeSessionReturn {
  const [references, setReferences] = React.useState<ReferenceGesture[]>([]);
  const [referenceGesture, setReferenceGesture] = React.useState<ReferenceGesture | null>(null);
  const [isLoadingReference, setIsLoadingReference] = React.useState<boolean>(true);
  const [sessionState, setSessionState] = React.useState<PracticeSessionState>("idle");
  const [liveDurationSec, setLiveDurationSec] = React.useState<number>(0);
  const [liveFrameCount, setLiveFrameCount] = React.useState<number>(0);
  const [liveFeedback, setLiveFeedback] = React.useState<LiveFeedbackResult | null>(null);
  const [evaluationResult, setEvaluationResult] = React.useState<PracticeEvaluationResult | null>(null);
  const [anomalyReport, setAnomalyReport] = React.useState<ScoreAnomalyReport | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const recordedFramesRef = React.useRef<ReferenceFrame[]>([]);
  const referencesRef = React.useRef<ReferenceGesture[]>([]);
  const isPracticingRef = React.useRef<boolean>(false);
  const sessionStartTimeRef = React.useRef<number>(0);
  const lastSampleTimeRef = React.useRef<number>(0);
  const lastFeedbackTimeRef = React.useRef<number>(0);
  const refSequenceRef = React.useRef<GestureFeatureSequence | null>(null);
  const liveSmootherRef = React.useRef<LiveFeedbackSmoother>(
    new LiveFeedbackSmoother({ alpha: 0.35, minFeedbackHoldMs: 450 })
  );

  // 1. Load Reference Gestures (Multi-Reference dataset) for the active lesson
  React.useEffect(() => {
    let isMounted = true;
    recordedFramesRef.current = [];
    isPracticingRef.current = false;
    refSequenceRef.current = null;
    liveSmootherRef.current.reset();

    async function loadRefs() {
      try {
        const loadedRefs = await getReferencesByLessonId(lesson.id);
        if (isMounted) {
          setReferences(loadedRefs);
          referencesRef.current = loadedRefs;

          const bestRef = getBestReference(loadedRefs);
          setReferenceGesture(bestRef);

          if (bestRef && bestRef.frames && bestRef.frames.length > 0) {
            refSequenceRef.current = extractGestureSequenceFeatures(bestRef);
          }

          setIsLoadingReference(false);
          setErrorMessage(null);
          setEvaluationResult(null);
          setLiveFeedback(null);
          setSessionState("idle");
        }
      } catch (err) {
        if (isMounted) {
          setIsLoadingReference(false);
          setErrorMessage("ไม่สามารถโหลด Reference Gesture จากระบบจัดเก็บข้อมูลได้");
          console.error("[usePracticeSession] Failed to load reference gestures:", err);
        }
      }
    }

    loadRefs();

    return () => {
      isMounted = false;
      isPracticingRef.current = false;
    };
  }, [lesson.id]);

  // 2. Start Practice Session
  const startPractice = React.useCallback(() => {
    if (!referenceGesture && referencesRef.current.length === 0) {
      setErrorMessage("ยังไม่มี Reference Gesture ต้นแบบสำหรับคำศัพท์นี้ กรุณาบันทึกต้นแบบในระบบผู้ดูแลก่อนเริ่มฝึก");
      setSessionState("error");
      return;
    }

    setErrorMessage(null);
    setEvaluationResult(null);
    setLiveFeedback(null);
    recordedFramesRef.current = [];
    liveSmootherRef.current.reset();
    setLiveDurationSec(0);
    setLiveFrameCount(0);

    const activeRef = referenceGesture || referencesRef.current[0];
    if (activeRef && !refSequenceRef.current) {
      refSequenceRef.current = extractGestureSequenceFeatures(activeRef);
    }

    const now = performance.now();
    sessionStartTimeRef.current = now;
    lastSampleTimeRef.current = 0;
    lastFeedbackTimeRef.current = 0;
    isPracticingRef.current = true;
    setSessionState("practicing");
  }, [referenceGesture]);

  // 3. Ingest real-time MediaPipe frame from camera loop
  const ingestFrame = React.useCallback(
    (handResult: HandDetectionResult | null, poseResult: PoseDetectionResult | null) => {
      if (!isPracticingRef.current) return;

      const now = performance.now();
      const elapsed = now - sessionStartTimeRef.current;
      const timeSinceLastSample = now - lastSampleTimeRef.current;

      if (timeSinceLastSample >= SAMPLE_INTERVAL_MS) {
        lastSampleTimeRef.current = now;

        const recordedHands: ReferenceHand[] = [];
        if (handResult && handResult.landmarks) {
          handResult.landmarks.forEach((landmarks: NormalizedLandmark[], hIdx: number) => {
            const handednessInfo = handResult.handednesses[hIdx]?.[0];
            const handedness = handednessInfo?.categoryName.toLowerCase().includes("left")
              ? "Left"
              : "Right";

            recordedHands.push({
              handedness,
              landmarks: landmarks.map((pt: NormalizedLandmark) => ({
                x: pt.x,
                y: pt.y,
                z: pt.z,
                visibility: pt.visibility,
              })),
            });
          });
        }

        const recordedPose = (poseResult?.landmarks[0] || []).map((pt: NormalizedLandmark) => ({
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

        // Throttle UI duration & frame count updates
        setLiveDurationSec(Number((elapsed / 1000).toFixed(1)));
        setLiveFrameCount(recordedFramesRef.current.length);

        // 4. Real-time Live Feedback (throttled at ~12.5 updates/sec)
        const timeSinceLastFeedback = now - lastFeedbackTimeRef.current;
        if (
          timeSinceLastFeedback >= LIVE_FEEDBACK_INTERVAL_MS &&
          refSequenceRef.current &&
          refSequenceRef.current.frames.length > 0
        ) {
          lastFeedbackTimeRef.current = now;

          try {
            // Extract single frame features for the current live frame
            const userFeatureFrame = extractFrameFeatures({
              timestampMs: Math.round(elapsed),
              hands: recordedHands,
              pose: recordedPose,
            });

            // Select optimal reference frame for live feedback (static vs dynamic progress)
            const target = getReferenceFrameForLiveFeedback(
              refSequenceRef.current,
              elapsed,
              lesson.gestureType
            );

            const requiresBothHands =
              refSequenceRef.current?.frames.some(
                (f) => f.leftHand?.detected && f.rightHand?.detected
              ) ?? false;

            // Evaluate frame against the target reference frame
            const rawLiveResult = computeLiveFeedback(
              userFeatureFrame,
              target.refFrame,
              {
                gestureType: lesson.gestureType,
                requiresBothHands,
                targetRefFrameIndex: target.frameIndex,
                gestureProgress: target.progress,
              }
            );

            // Apply temporal exponential moving average & message debounce
            const smoothedLiveResult = liveSmootherRef.current.smooth(
              rawLiveResult,
              now
            );

            setLiveFeedback(smoothedLiveResult);
          } catch (fbErr) {
            console.warn("[usePracticeSession] Live feedback warning:", fbErr);
          }
        }
      }
    },
    [lesson.gestureType]
  );

  // 5. Stop Practice & Execute Multi-Reference Scoring Pipeline (STEP 6A + 6B + 6C DTW + 7D + 7E)
  const stopAndAnalyze = React.useCallback(() => {
    isPracticingRef.current = false;
    setSessionState("analyzing");

    const candidateRefs = referencesRef.current.length > 0
      ? referencesRef.current
      : referenceGesture
      ? [referenceGesture]
      : [];

    if (candidateRefs.length === 0) {
      setErrorMessage("ไม่พบ Reference Gesture ต้นแบบ");
      setSessionState("error");
      return;
    }

    try {
      const result = evaluatePracticeFrames(
        lesson,
        candidateRefs,
        recordedFramesRef.current
      );

      const anomaly = detectScoreAnomalies(result);
      setAnomalyReport(anomaly);
      setEvaluationResult(result);
      setSessionState("completed");

      // Save diagnostic session record
      const matchedRefId = result.matchedReference?.id || candidateRefs[0]?.id || "unknown";
      savePracticeSessionRecord({
        id: `sess_${Date.now()}`,
        lessonId: lesson.id,
        word: lesson.word,
        matchedReferenceId: matchedRefId,
        timestamp: new Date().toISOString(),
        durationMs: result.userSequence.durationMs,
        capturedFrames: result.userSequence.frameCount,
        finalScore: result.score.overallScore,
        confidence: result.score.confidence,
        componentScores: {
          fingerCurl: result.score.fingerCurlScore,
          fingerAngle: result.score.fingerAngleScore,
          palmOrientation: result.score.palmOrientationScore,
          handPosition: result.score.handPositionScore,
          twoHand: result.score.twoHandScore,
          bodyContext: result.score.bodyContextScore,
        },
        dtwMetrics: {
          matchedFrames: result.score.matchedFrames,
          totalFrames: result.score.totalFrames,
        },
        feedback: result.score.feedback.map((f) => (typeof f === "string" ? f : f.message)),
        anomalies: anomaly.anomalies.map((a) => `${a.severity.toUpperCase()}: ${a.description}`),
        verdict: anomaly.verdict,
      }).catch((err) => {
        console.warn("[usePracticeSession] Failed to persist session log:", err);
      });
    } catch (err) {
      const errorObj = err as { message?: string };
      setErrorMessage(errorObj?.message || "เกิดข้อผิดพลาดในการวิเคราะห์ท่าทาง กรุณาลองใหม่อีกครั้ง");
      setSessionState("error");
    }
  }, [lesson, referenceGesture]);

  // 6. Reset Practice Session for another attempt
  const resetSession = React.useCallback(() => {
    isPracticingRef.current = false;
    recordedFramesRef.current = [];
    liveSmootherRef.current.reset();
    setLiveFeedback(null);
    setLiveDurationSec(0);
    setLiveFrameCount(0);
    setEvaluationResult(null);
    setAnomalyReport(null);
    setErrorMessage(null);
    setSessionState("idle");
  }, []);

  const bestQualityScore = referenceGesture?.qualityScore ?? (references[0]?.qualityScore ?? 90);

  return {
    lesson,
    referenceGesture,
    references,
    referenceCount: references.length,
    bestQualityScore,
    isLoadingReference,
    sessionState,
    liveDurationSec,
    liveFrameCount,
    liveFeedback,
    evaluationResult,
    anomalyReport,
    errorMessage,
    startPractice,
    stopAndAnalyze,
    resetSession,
    ingestFrame,
  };
}
