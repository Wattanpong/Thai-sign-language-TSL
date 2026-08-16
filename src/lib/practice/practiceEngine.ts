import {
  ReferenceGesture,
  ReferenceFrame,
  GestureFeatureSequence,
  GestureScore,
  Lesson,
} from "@/types";
import { extractGestureSequenceFeatures } from "@/lib/gesture/featureExtraction";
import { scoreGesture } from "@/lib/gesture/scoring";
import { trimGestureSequence } from "@/lib/gesture/motionTrimming";
import { filterUsableReferences } from "@/lib/reference/referenceRanking";

export type PracticeSessionState =
  | "idle" // Waiting to start
  | "practicing" // Recording user motion frames
  | "analyzing" // Extracting features & running DTW / Scoring
  | "completed" // Analysis done, score available
  | "error"; // Error encountered

export interface CandidateEvaluation {
  referenceId: string;
  referenceWord: string;
  isPrimary: boolean;
  qualityScore: number;
  overallScore: number;
  confidence: number;
}

export interface PracticeEvaluationResult {
  score: GestureScore;
  userSequence: GestureFeatureSequence;
  referenceSequence: GestureFeatureSequence;
  matchedReference?: ReferenceGesture;
  candidateEvaluations?: CandidateEvaluation[];
  totalReferencesEvaluated?: number;
}

export interface PracticeEngineOptions {
  minRequiredFrames?: number;
  sampleIntervalMs?: number;
}

/**
 * Validates and converts user recorded frames against single or multiple references into a scored evaluation result
 */
export function evaluatePracticeFrames(
  lesson: Lesson,
  referenceOrList: ReferenceGesture | ReferenceGesture[],
  userFrames: ReferenceFrame[],
  options: PracticeEngineOptions = {}
): PracticeEvaluationResult {
  const minFrames = options.minRequiredFrames ?? 3;

  const references: ReferenceGesture[] = Array.isArray(referenceOrList)
    ? referenceOrList
    : [referenceOrList];

  if (!references || references.length === 0 || !references[0]?.frames || references[0].frames.length === 0) {
    throw new Error("ไม่พบข้อมูล Reference Gesture สำหรับบทเรียนนี้ กรุณาบันทึกต้นแบบก่อนเริ่มฝึก");
  }

  if (!userFrames || userFrames.length < minFrames) {
    throw new Error(
      `จำนวนเฟรมที่บันทึกได้น้อยเกินไป (${userFrames?.length || 0} เฟรม) กรุณาทำท่าทางค้างไว้อย่างน้อย 1 วินาทีแล้วลองใหม่`
    );
  }

  // 1. Filter usable references and rank
  const usableReferences = filterUsableReferences(references);

  // 2. Wrap User Raw Frames into ReferenceGesture shape and extract Feature Sequence (STEP 6A)
  const firstTimestamp = userFrames[0]?.timestampMs || 0;
  const lastTimestamp = userFrames[userFrames.length - 1]?.timestampMs || 0;
  const durationMs = Math.max(100, lastTimestamp - firstTimestamp);

  const userGesture: ReferenceGesture = {
    id: `user_practice_${Date.now()}`,
    lessonId: lesson.id,
    word: lesson.word,
    durationMs,
    frameCount: userFrames.length,
    frames: userFrames,
    createdAt: new Date().toISOString(),
  };

  const userSequence = extractGestureSequenceFeatures(userGesture);
  const trimmedUserSequence = trimGestureSequence(userSequence, {
    gestureType: lesson.gestureType,
    minRetainedRatio: 0.6,
    minRequiredFrames: minFrames,
  });

  // 3. Single reference fast-path
  if (usableReferences.length === 1) {
    const singleRef = usableReferences[0];
    const referenceSequence = extractGestureSequenceFeatures(singleRef);

    const score = scoreGesture(referenceSequence, trimmedUserSequence, {
      gestureType: lesson.gestureType,
      requiresBothHands:
        lesson.word === "สวัสดี" ||
        singleRef.frames.some((f) => f.hands.length >= 2),
      includePerFrameScores: true,
    });

    return {
      score,
      userSequence,
      referenceSequence,
      matchedReference: singleRef,
      totalReferencesEvaluated: 1,
    };
  }

  // 4. Multi-Reference Evaluation Pipeline (STEP 7D)
  // Evaluate user sequence against each candidate reference
  const candidateResults: {
    ref: ReferenceGesture;
    refSeq: GestureFeatureSequence;
    score: GestureScore;
    weightedScore: number;
    evaluation: CandidateEvaluation;
  }[] = [];

  for (const ref of usableReferences) {
    const refSeq = extractGestureSequenceFeatures(ref);
    const requiresBothHands =
      lesson.word === "สวัสดี" || ref.frames.some((f) => f.hands.length >= 2);

    const score = scoreGesture(refSeq, trimmedUserSequence, {
      gestureType: lesson.gestureType,
      requiresBothHands,
      includePerFrameScores: true,
    });

    const qualityScore = ref.qualityScore ?? 90;
    // Weight candidate score: High-quality reference retains full score weight
    const qualityFactor = 0.85 + 0.15 * (qualityScore / 100);
    const weightedScore = score.overallScore * qualityFactor;

    candidateResults.push({
      ref,
      refSeq,
      score,
      weightedScore,
      evaluation: {
        referenceId: ref.id,
        referenceWord: ref.word,
        isPrimary: Boolean(ref.isPrimary),
        qualityScore,
        overallScore: score.overallScore,
        confidence: score.confidence,
      },
    });
  }

  // Sort candidate results to select best matching natural variation
  candidateResults.sort((a, b) => {
    // 1. Higher weighted score
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    // 2. Primary preference on exact tie
    if (a.ref.isPrimary && !b.ref.isPrimary) return -1;
    if (!a.ref.isPrimary && b.ref.isPrimary) return 1;
    return (b.ref.qualityScore ?? 90) - (a.ref.qualityScore ?? 90);
  });

  const bestMatch = candidateResults[0];

  return {
    score: bestMatch.score,
    userSequence,
    referenceSequence: bestMatch.refSeq,
    matchedReference: bestMatch.ref,
    candidateEvaluations: candidateResults.map((c) => c.evaluation),
    totalReferencesEvaluated: candidateResults.length,
  };
}
