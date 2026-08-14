import {
  GestureFeatureFrame,
  GestureFeatureSequence,
  ScoringOptions,
  GestureType,
} from "@/types";
import { compareSingleFrame } from "@/lib/gesture/scoring";

export type LiveSeverity = "success" | "warning" | "error" | "info";

export interface LiveFeedbackResult {
  liveScore: number;
  rawScore: number;
  confidence: number;
  severity: LiveSeverity;
  primaryFeedback: string;
  secondaryFeedback: string[];
  faultyComponents: string[];
  correctionDirection: string | null;
  targetRefFrameIndex: number;
  gestureProgress: number;
  componentScores: {
    handShape: number;
    fingerAngle: number;
    fingerCurl: number;
    palmOrientation: number;
    handPosition: number;
    twoHand: number;
    bodyContext: number;
  };
}

export interface LiveFeedbackSmootherOptions {
  alpha?: number; // Smoothing factor for EMA (0 < alpha <= 1). Default 0.35
  minFeedbackHoldMs?: number; // Minimum time to hold a primary feedback message. Default 500ms
}

export class LiveFeedbackSmoother {
  private smoothedScore: number | null = null;
  private currentPrimaryFeedback = "กำลังเริ่มต้นท่าทาง...";
  private lastFeedbackChangeTime = 0;
  private alpha: number;
  private minFeedbackHoldMs: number;

  constructor(options: LiveFeedbackSmootherOptions = {}) {
    this.alpha = options.alpha ?? 0.35;
    this.minFeedbackHoldMs = options.minFeedbackHoldMs ?? 500;
  }

  public reset(): void {
    this.smoothedScore = null;
    this.currentPrimaryFeedback = "กำลังเริ่มต้นท่าทาง...";
    this.lastFeedbackChangeTime = 0;
  }

  public smooth(
    rawResult: LiveFeedbackResult,
    now: number = performance.now()
  ): LiveFeedbackResult {
    // 1. Exponential Moving Average for Score
    if (this.smoothedScore === null) {
      this.smoothedScore = rawResult.rawScore;
    } else {
      this.smoothedScore =
        this.alpha * rawResult.rawScore + (1 - this.alpha) * this.smoothedScore;
    }

    const liveScore = Math.round(this.smoothedScore);

    // 2. Feedback Message Stabilization / Debounce
    const timeSinceLastChange = now - this.lastFeedbackChangeTime;
    let primaryFeedback = this.currentPrimaryFeedback;

    if (
      timeSinceLastChange >= this.minFeedbackHoldMs ||
      rawResult.severity === "error" ||
      this.currentPrimaryFeedback === "กำลังเริ่มต้นท่าทาง..."
    ) {
      primaryFeedback = rawResult.primaryFeedback;
      if (primaryFeedback !== this.currentPrimaryFeedback) {
        this.currentPrimaryFeedback = primaryFeedback;
        this.lastFeedbackChangeTime = now;
      }
    }

    return {
      ...rawResult,
      liveScore,
      primaryFeedback,
    };
  }
}

/**
 * Selects the optimal reference frame for live feedback:
 * - Static: Middle/Representative frame
 * - Dynamic: Frame matching the current gesture elapsed time / progress
 */
export function getReferenceFrameForLiveFeedback(
  refSequence: GestureFeatureSequence,
  elapsedMs: number,
  gestureType: GestureType = "dynamic"
): { refFrame: GestureFeatureFrame; frameIndex: number; progress: number } {
  if (!refSequence || !refSequence.frames || refSequence.frames.length === 0) {
    throw new Error("Reference sequence is empty");
  }

  const frames = refSequence.frames;
  const numFrames = frames.length;

  if (gestureType === "static") {
    const frameIndex = Math.floor(numFrames / 2);
    return {
      refFrame: frames[frameIndex] || frames[0],
      frameIndex,
      progress: 0.5,
    };
  }

  // Dynamic gesture: compute progress based on reference duration
  const refDurationMs = Math.max(100, refSequence.durationMs);
  const progress = Math.min(1.0, Math.max(0.0, elapsedMs / refDurationMs));
  const frameIndex = Math.min(numFrames - 1, Math.floor(progress * (numFrames - 1)));

  return {
    refFrame: frames[frameIndex] || frames[0],
    frameIndex,
    progress,
  };
}

/**
 * Priority rank for feedback categories (Lower number = Higher priority)
 */
const FEEDBACK_PRIORITY: Record<string, number> = {
  coverage: 1, // Missing hand entirely
  twoHand: 2, // Two-hand missing or broken symmetry
  palmOrientation: 3, // Palm flipped or angled incorrectly
  handPosition: 4, // Hand too high / too low / displaced
  handShape: 5, // Hand spread / fist mismatch
  fingerCurl: 6, // Specific finger too curled / extended
  fingerAngle: 7, // Finger joint angle
  bodyContext: 8, // Head tilt / torso
};

/**
 * Evaluates a single real-time user frame against reference frame and generates prioritized live feedback
 */
export function computeLiveFeedback(
  userFrame: GestureFeatureFrame,
  refFrame: GestureFeatureFrame,
  options: {
    gestureType?: GestureType;
    requiresBothHands?: boolean;
    targetRefFrameIndex?: number;
    gestureProgress?: number;
    scoringOptions?: ScoringOptions;
  } = {}
): LiveFeedbackResult {
  const comparison = compareSingleFrame(refFrame, userFrame, {
    gestureType: options.gestureType,
    requiresBothHands: options.requiresBothHands,
    ...options.scoringOptions,
  });

  const rawScore = Math.round(comparison.score);
  const confidence = Number(comparison.confidence.toFixed(2));

  // Determine faulty components where score is low
  const faultyComponents: string[] = [];
  const bd = comparison.breakdown;

  if (bd.palmOrientation.score < 60) faultyComponents.push("palmOrientation");
  if (bd.handPosition.score < 60) faultyComponents.push("handPosition");
  if (bd.handShape.score < 60) faultyComponents.push("handShape");
  if (bd.fingerCurl.score < 60) faultyComponents.push("fingerCurl");
  if (bd.fingerAngle.score < 60) faultyComponents.push("fingerAngle");
  if (bd.twoHand.score < 60) faultyComponents.push("twoHand");
  if (bd.bodyContext.score < 60) faultyComponents.push("bodyContext");

  // Sort feedback by strict priority hierarchy
  const sortedFeedback = [...comparison.feedback].sort((a, b) => {
    const pA = FEEDBACK_PRIORITY[a.category] || 99;
    const pB = FEEDBACK_PRIORITY[b.category] || 99;
    if (pA !== pB) return pA - pB;
    return a.score - b.score;
  });

  let primaryFeedback = "ท่าทางถูกต้อง สวยงามมาก";
  let severity: LiveSeverity = "success";
  const secondaryFeedback: string[] = [];
  let correctionDirection: string | null = null;

  if (sortedFeedback.length > 0) {
    const topError = sortedFeedback[0];
    primaryFeedback = topError.message;
    severity =
      topError.severity === "error"
        ? "error"
        : topError.severity === "warning"
        ? "warning"
        : "info";

    // Extract secondary feedback (up to 2 extra distinct items)
    for (let i = 1; i < sortedFeedback.length && secondaryFeedback.length < 2; i++) {
      if (sortedFeedback[i].message !== primaryFeedback) {
        secondaryFeedback.push(sortedFeedback[i].message);
      }
    }

    // Determine correction guidance
    if (topError.relatedFeature?.includes("posRelShoulderCenter")) {
      correctionDirection = topError.message.includes("สูง")
        ? "กดมือลงเล็กน้อย"
        : topError.message.includes("ต่ำ")
        ? "ยกมือขึ้นระดับอก"
        : "ปรับตำแหน่งมือให้อยู่กึ่งกลาง";
    } else if (topError.category === "palmOrientation") {
      correctionDirection = "หมุนปรับมุมฝ่ามือให้ตรงตามตัวอย่าง";
    } else if (topError.category === "twoHand") {
      correctionDirection = "ขยับมือทั้งสองข้างให้สมมาตร";
    }
  } else if (rawScore < 88) {
    primaryFeedback = "ปรับท่าทางให้กระชับและตรงตามตัวอย่าง";
    severity = "warning";
  }

  return {
    liveScore: rawScore,
    rawScore,
    confidence,
    severity,
    primaryFeedback,
    secondaryFeedback,
    faultyComponents,
    correctionDirection,
    targetRefFrameIndex: options.targetRefFrameIndex ?? 0,
    gestureProgress: options.gestureProgress ?? 0,
    componentScores: {
      handShape: Math.round(bd.handShape.score),
      fingerAngle: Math.round(bd.fingerAngle.score),
      fingerCurl: Math.round(bd.fingerCurl.score),
      palmOrientation: Math.round(bd.palmOrientation.score),
      handPosition: Math.round(bd.handPosition.score),
      twoHand: Math.round(bd.twoHand.score),
      bodyContext: Math.round(bd.bodyContext.score),
    },
  };
}
