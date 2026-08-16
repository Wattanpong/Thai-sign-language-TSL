import {
  GestureFeatureFrame,
  GestureFeatureSequence,
} from "@/types";
import { dist3D, vectorAngleDiff } from "./featureExtraction";

export interface MotionBoundaryResult {
  startIndex: number;
  endIndex: number;
  originalFrameCount: number;
  trimmedFrameCount: number;
  isTrimmed: boolean;
  trimRatio: number;
  motionEnergies: number[];
}

export interface MotionTrimmingOptions {
  gestureType?: "static" | "dynamic";
  minRetainedRatio?: number; // Minimum ratio of frames to retain (default: 0.60)
  minRequiredFrames?: number; // Absolute minimum frames (default: 10)
  energyThreshold?: number; // Baseline motion energy threshold (default: 0.015)
  paddingFrames?: number; // Extra margin frames to keep around boundary (default: 1)
}

/**
 * Computes frame-to-frame motion energy between two consecutive GestureFeatureFrames
 */
export function computeFrameMotionEnergy(
  f1: GestureFeatureFrame,
  f2: GestureFeatureFrame
): number {
  const hasHand1 = Boolean(f1.rightHand?.detected || f1.leftHand?.detected);
  const hasHand2 = Boolean(f2.rightHand?.detected || f2.leftHand?.detected);

  // Both frames have no detected hands -> Zero motion energy
  if (!hasHand1 && !hasHand2) {
    return 0.0;
  }

  // Hand entrance / exit transition
  if (!hasHand1 || !hasHand2) {
    return 0.35;
  }

  let totalEnergy = 0.0;
  let handCount = 0;

  // 1. Right hand motion delta
  if (f1.rightHand?.detected && f2.rightHand?.detected) {
    const p1 = f1.rightHand.wristPosition;
    const p2 = f2.rightHand.wristPosition;
    const posDist = dist3D(p1, p2);

    const orientDiff =
      vectorAngleDiff(f1.rightHand.palmNormal, f2.rightHand.palmNormal) / 180.0;

    let curlDiff = 0;
    const curls1 = f1.rightHand.fingerCurls;
    const curls2 = f2.rightHand.fingerCurls;
    const curlKeys = Object.keys(curls1) as (keyof typeof curls1)[];
    curlKeys.forEach((k) => {
      curlDiff += Math.abs(curls1[k] - curls2[k]);
    });
    curlDiff /= curlKeys.length;

    totalEnergy += posDist * 0.5 + orientDiff * 0.25 + curlDiff * 0.25;
    handCount++;
  }

  // 2. Left hand motion delta
  if (f1.leftHand?.detected && f2.leftHand?.detected) {
    const p1 = f1.leftHand.wristPosition;
    const p2 = f2.leftHand.wristPosition;
    const posDist = dist3D(p1, p2);

    const orientDiff =
      vectorAngleDiff(f1.leftHand.palmNormal, f2.leftHand.palmNormal) / 180.0;

    let curlDiff = 0;
    const curls1 = f1.leftHand.fingerCurls;
    const curls2 = f2.leftHand.fingerCurls;
    const curlKeys = Object.keys(curls1) as (keyof typeof curls1)[];
    curlKeys.forEach((k) => {
      curlDiff += Math.abs(curls1[k] - curls2[k]);
    });
    curlDiff /= curlKeys.length;

    totalEnergy += posDist * 0.5 + orientDiff * 0.25 + curlDiff * 0.25;
    handCount++;
  }

  // If hands were present in both but on different sides (e.g. right in f1, left in f2)
  if (handCount === 0) {
    return 0.35;
  }

  return totalEnergy / handCount;
}

/**
 * Detects the active gesture start and end boundary indices from a GestureFeatureSequence
 */
export function detectMotionBoundaries(
  sequence: GestureFeatureSequence,
  options: MotionTrimmingOptions = {}
): MotionBoundaryResult {
  const frames = sequence?.frames || [];
  const N = frames.length;

  const minRequiredFrames = options.minRequiredFrames ?? 10;
  const minRetainedRatio = options.minRetainedRatio ?? 0.6;
  const paddingFrames = options.paddingFrames ?? 1;
  const gestureType = options.gestureType ?? "dynamic";

  // If sequence is already short, keep full sequence
  if (N <= minRequiredFrames) {
    return {
      startIndex: 0,
      endIndex: Math.max(0, N - 1),
      originalFrameCount: N,
      trimmedFrameCount: N,
      isTrimmed: false,
      trimRatio: 1.0,
      motionEnergies: [],
    };
  }

  // 1. Compute frame-to-frame motion energy array
  const motionEnergies: number[] = [];
  for (let i = 0; i < N - 1; i++) {
    motionEnergies.push(computeFrameMotionEnergy(frames[i], frames[i + 1]));
  }

  // Find first frame with any detected hand
  let firstHandIndex = -1;
  for (let i = 0; i < N; i++) {
    if (frames[i].rightHand?.detected || frames[i].leftHand?.detected) {
      firstHandIndex = i;
      break;
    }
  }

  // Find last frame with any detected hand
  let lastHandIndex = -1;
  for (let j = N - 1; j >= 0; j--) {
    if (frames[j].rightHand?.detected || frames[j].leftHand?.detected) {
      lastHandIndex = j;
      break;
    }
  }

  // If no hands detected at all across the sequence
  if (firstHandIndex === -1 || lastHandIndex === -1 || lastHandIndex <= firstHandIndex) {
    return {
      startIndex: 0,
      endIndex: Math.max(0, N - 1),
      originalFrameCount: N,
      trimmedFrameCount: N,
      isTrimmed: false,
      trimRatio: 1.0,
      motionEnergies,
    };
  }

  let rawStartIndex = firstHandIndex;
  let rawEndIndex = lastHandIndex;

  if (gestureType === "dynamic") {
    const activeMotionEnergies = motionEnergies.slice(firstHandIndex, lastHandIndex);
    const meanEnergy =
      activeMotionEnergies.length > 0
        ? activeMotionEnergies.reduce((a, b) => a + b, 0) / activeMotionEnergies.length
        : 0;

    const dynamicEnergyThreshold = Math.max(
      options.energyThreshold ?? 0.015,
      meanEnergy * 0.20
    );

    // Scan forward from firstHandIndex for significant motion start
    for (let i = firstHandIndex; i < lastHandIndex; i++) {
      const energy = motionEnergies[i] ?? 0;
      if (energy >= dynamicEnergyThreshold || i - firstHandIndex >= Math.floor(N * 0.25)) {
        rawStartIndex = i;
        break;
      }
    }

    // Scan backward from lastHandIndex for significant motion end
    for (let j = lastHandIndex; j > rawStartIndex; j--) {
      const prevEnergy = motionEnergies[Math.max(0, j - 1)] ?? 0;
      if (prevEnergy >= dynamicEnergyThreshold || lastHandIndex - j >= Math.floor(N * 0.25)) {
        rawEndIndex = j;
        break;
      }
    }
  }

  // Apply padding around boundary (keep extra frame margin)
  let startIndex = Math.max(0, rawStartIndex - paddingFrames);
  let endIndex = Math.min(N - 1, rawEndIndex + paddingFrames);

  // Safety Guard: Ensure we retain at least minRetainedRatio (e.g. 60%) and minRequiredFrames
  const minAllowedFrames = Math.max(
    minRequiredFrames,
    Math.floor(N * minRetainedRatio)
  );

  let trimmedFrameCount = endIndex - startIndex + 1;

  if (trimmedFrameCount < minAllowedFrames || endIndex <= startIndex) {
    // If trimming was too aggressive, fallback to firstHandIndex..lastHandIndex or full sequence
    if (lastHandIndex - firstHandIndex + 1 >= minAllowedFrames) {
      startIndex = firstHandIndex;
      endIndex = lastHandIndex;
      trimmedFrameCount = endIndex - startIndex + 1;
    } else {
      startIndex = 0;
      endIndex = N - 1;
      trimmedFrameCount = N;
    }
  }

  const isTrimmed = startIndex > 0 || endIndex < N - 1;
  const trimRatio = Number((trimmedFrameCount / N).toFixed(3));

  return {
    startIndex,
    endIndex,
    originalFrameCount: N,
    trimmedFrameCount,
    isTrimmed,
    trimRatio,
    motionEnergies,
  };
}

/**
 * Trims dead-time / rest-pose lead-in and lead-out frames from a GestureFeatureSequence
 */
export function trimGestureSequence(
  sequence: GestureFeatureSequence,
  options: MotionTrimmingOptions = {}
): GestureFeatureSequence {
  if (!sequence || !sequence.frames || sequence.frames.length === 0) {
    return sequence;
  }

  const boundary = detectMotionBoundaries(sequence, options);

  if (!boundary.isTrimmed) {
    return sequence;
  }

  const trimmedFrames = sequence.frames.slice(
    boundary.startIndex,
    boundary.endIndex + 1
  );

  const firstTimestamp = trimmedFrames[0]?.timestampMs ?? 0;
  const lastTimestamp =
    trimmedFrames[trimmedFrames.length - 1]?.timestampMs ?? firstTimestamp;
  const durationMs = Math.max(100, lastTimestamp - firstTimestamp);

  return {
    ...sequence,
    durationMs,
    frameCount: trimmedFrames.length,
    frames: trimmedFrames,
  };
}
