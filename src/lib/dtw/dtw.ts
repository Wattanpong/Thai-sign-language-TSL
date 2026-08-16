import {
  GestureFeatureFrame,
  GestureFeatureSequence,
  SingleHandFeatures,
  TwoHandFeatures,
  HeadFeatures,
  FingerAngles,
  FingerCurls,
  ScoringWeightsConfig,
  DTWOptions,
  DTWResult,
  DTWMatch,
  DTWFramePair,
} from "@/types";
import { DEFAULT_SCORING_WEIGHTS } from "@/lib/gesture/scoring";
import { dist3D, vectorAngleDiff } from "@/lib/gesture/featureExtraction";

/* ==========================================================================
   1. FEATURE DISTANCE CALCULATION
   ========================================================================== */

/**
 * Calculates normalized distance [0..1] between finger angles of two hands
 */
function calculateAngleDistance(ref: FingerAngles, user: FingerAngles): number {
  const keys = Object.keys(ref) as (keyof FingerAngles)[];
  let totalDiff = 0;
  keys.forEach((k) => {
    totalDiff += Math.abs(ref[k] - user[k]);
  });
  return Math.min(1.0, totalDiff / (keys.length * 180.0));
}

/**
 * Calculates normalized distance [0..1] between finger curls of two hands
 */
function calculateCurlDistance(ref: FingerCurls, user: FingerCurls): number {
  const keys = Object.keys(ref) as (keyof FingerCurls)[];
  let totalDiff = 0;
  keys.forEach((k) => {
    totalDiff += Math.abs(ref[k] - user[k]);
  });
  return Math.min(1.0, totalDiff / keys.length);
}

/**
 * Calculates normalized distance [0..1] between hand orientation vectors
 */
function calculateOrientationDistance(ref: SingleHandFeatures, user: SingleHandFeatures): number {
  const normalDiff = vectorAngleDiff(ref.palmNormal, user.palmNormal) / 180.0;
  const facingDiff = vectorAngleDiff(ref.handFacingVector, user.handFacingVector) / 180.0;
  return (normalDiff * 0.5 + facingDiff * 0.5);
}

/**
 * Calculates normalized distance [0..1] between body-relative hand positions
 */
function calculatePositionDistance(ref: SingleHandFeatures, user: SingleHandFeatures): number {
  if (!ref.posRelShoulderCenter || !user.posRelShoulderCenter) {
    return 0.0;
  }
  const posDiff = dist3D(ref.posRelShoulderCenter, user.posRelShoulderCenter);
  return Math.min(1.0, posDiff / 2.2);
}

/**
 * Calculates distance between single hand features
 */
function calculateSingleHandDistance(
  ref: SingleHandFeatures | null,
  user: SingleHandFeatures | null,
  weights: ScoringWeightsConfig
): { distance: number; weight: number } {
  if (!ref?.detected && !user?.detected) {
    return { distance: 0.0, weight: 0.0 };
  }

  if (ref?.detected && !user?.detected) {
    // User is missing a hand that is present in reference
    return { distance: 1.0, weight: 1.0 };
  }

  if (!ref?.detected && user?.detected) {
    // User presented extra hand not in reference
    return { distance: 0.3, weight: 0.5 };
  }

  if (!ref || !user) {
    return { distance: 0.0, weight: 0.0 };
  }

  const shapeDist = Math.min(1.0, Math.abs(ref.handSpread - user.handSpread) / 2.0);
  const angleDist = calculateAngleDistance(ref.fingerAngles, user.fingerAngles);
  const curlDist = calculateCurlDistance(ref.fingerCurls, user.fingerCurls);
  const orientDist = calculateOrientationDistance(ref, user);
  const posDist = calculatePositionDistance(ref, user);

  const weightedDist =
    shapeDist * weights.handShape +
    angleDist * weights.fingerAngle +
    curlDist * weights.fingerCurl +
    orientDist * weights.palmOrientation +
    posDist * weights.handPosition;

  const totalHandWeight =
    weights.handShape +
    weights.fingerAngle +
    weights.fingerCurl +
    weights.palmOrientation +
    weights.handPosition;

  return {
    distance: totalHandWeight > 0 ? weightedDist / totalHandWeight : 0,
    weight: totalHandWeight,
  };
}

/**
 * Calculates distance between two-hand relationship features
 */
function calculateTwoHandDistance(
  ref: TwoHandFeatures | null,
  user: TwoHandFeatures | null,
  requiresBothHands = false
): number {
  const refNeedsBoth = requiresBothHands || (ref?.bothHandsDetected ?? false);
  const userHasBoth = user?.bothHandsDetected ?? false;

  if (refNeedsBoth && !userHasBoth) {
    return 1.0; // Heavy penalty for missing second hand
  }

  if (!refNeedsBoth && !userHasBoth) {
    return 0.0;
  }

  if (!ref || !user || ref.wristDistance === null || user.wristDistance === null) {
    return 0.0;
  }

  const wristDistDiff = Math.min(1.0, Math.abs(ref.wristDistance - user.wristDistance) / 1.5);
  const heightDiff = Math.min(1.0, Math.abs((ref.heightDifference ?? 0) - (user.heightDifference ?? 0)) / 1.0);
  const symDiff = Math.min(1.0, Math.abs((ref.symmetryScore ?? 1.0) - (user.symmetryScore ?? 1.0)));

  return wristDistDiff * 0.45 + heightDiff * 0.3 + symDiff * 0.25;
}

/**
 * Calculates distance between head and posture context
 */
function calculateBodyDistance(refHead: HeadFeatures | null, userHead: HeadFeatures | null): number {
  if (!refHead?.detected || !userHead?.detected) {
    return 0.0;
  }
  const tiltDiff = Math.abs(refHead.headTiltAngle - userHead.headTiltAngle);
  return Math.min(1.0, tiltDiff / 90.0);
}

/**
 * Computes a unified geometric frame distance metric between two GestureFeatureFrames.
 * Output is in range [0..1] where 0 represents identical frames.
 */
export function calculateFrameDistance(
  refFrame: GestureFeatureFrame,
  userFrame: GestureFeatureFrame,
  weightsConfig?: Partial<ScoringWeightsConfig>,
  requiresBothHands = false
): number {
  const weights: ScoringWeightsConfig = {
    ...DEFAULT_SCORING_WEIGHTS,
    ...weightsConfig,
  };

  const rightHandRes = calculateSingleHandDistance(refFrame.rightHand, userFrame.rightHand, weights);
  const leftHandRes = calculateSingleHandDistance(refFrame.leftHand, userFrame.leftHand, weights);
  const twoHandDist = calculateTwoHandDistance(refFrame.twoHand, userFrame.twoHand, requiresBothHands);
  const bodyDist = calculateBodyDistance(refFrame.head, userFrame.head);

  let totalAccumulatedDist = 0;
  let totalAccumulatedWeight = 0;

  if (rightHandRes.weight > 0) {
    totalAccumulatedDist += rightHandRes.distance * rightHandRes.weight;
    totalAccumulatedWeight += rightHandRes.weight;
  }

  if (leftHandRes.weight > 0) {
    totalAccumulatedDist += leftHandRes.distance * leftHandRes.weight;
    totalAccumulatedWeight += leftHandRes.weight;
  }

  totalAccumulatedDist += twoHandDist * weights.twoHand;
  totalAccumulatedWeight += weights.twoHand;

  totalAccumulatedDist += bodyDist * weights.bodyContext;
  totalAccumulatedWeight += weights.bodyContext;

  return totalAccumulatedWeight > 0 ? totalAccumulatedDist / totalAccumulatedWeight : 0;
}

/* ==========================================================================
   2. DYNAMIC TIME WARPING (DTW) ALGORITHM
   ========================================================================== */

/**
 * Performs Dynamic Time Warping (DTW) alignment between Reference and User gesture feature sequences.
 */
export function computeDTW(
  reference: GestureFeatureSequence,
  user: GestureFeatureSequence,
  options: DTWOptions = {}
): DTWResult {
  const {
    windowRatio = 0.4,
    weights,
    requiresBothHands = false,
  } = options;

  const refFrames = reference?.frames || [];
  const userFrames = user?.frames || [];
  const N = refFrames.length;
  const M = userFrames.length;

  // 1. Guard against empty sequences
  if (N === 0 || M === 0) {
    return {
      distance: 0,
      normalizedDistance: 0,
      path: [],
      matches: [],
      alignedPairs: [],
      referenceLength: N,
      userLength: M,
      coverage: 0,
      confidence: 0,
      temporalFeedback: ["ไม่พบข้อมูลเฟรมสำหรับประมวลผล DTW Alignment"],
    };
  }

  // 2. Single-frame edge case
  if (N === 1 && M === 1) {
    const dist = calculateFrameDistance(refFrames[0], userFrames[0], weights, requiresBothHands);
    const path: [number, number][] = [[0, 0]];
    const matches: DTWMatch[] = [{ refIndex: 0, userIndex: 0, distance: dist }];
    const alignedPairs: DTWFramePair[] = [
      {
        refIndex: 0,
        userIndex: 0,
        refFrame: refFrames[0],
        userFrame: userFrames[0],
        distance: dist,
      },
    ];

    return {
      distance: dist,
      normalizedDistance: dist,
      path,
      matches,
      alignedPairs,
      referenceLength: 1,
      userLength: 1,
      coverage: 1.0,
      confidence: Math.max(0, 1.0 - dist),
      temporalFeedback: [],
    };
  }

  // 3. Sakoe-Chiba Band Window Constraint Setup
  const maxWindowOffset = Math.max(2, Math.ceil(Math.max(N, M) * windowRatio));

  // 4. Initialize (N+1) x (M+1) Cost Matrix with Infinity
  // Using 1D Float64Array for maximum cache locality and performance
  const cols = M + 1;
  const costMatrix = new Float64Array((N + 1) * cols);
  costMatrix.fill(Infinity);
  costMatrix[0] = 0; // D[0][0] = 0

  // 5. Forward Pass: Compute Accumulated Cost Matrix
  for (let i = 1; i <= N; i++) {
    const idealJ = Math.round((i / N) * M);
    const jStart = Math.max(1, idealJ - maxWindowOffset);
    const jEnd = Math.min(M, idealJ + maxWindowOffset);

    const refFrame = refFrames[i - 1];

    for (let j = jStart; j <= jEnd; j++) {
      const userFrame = userFrames[j - 1];
      const d = calculateFrameDistance(refFrame, userFrame, weights, requiresBothHands);

      const diag = costMatrix[(i - 1) * cols + (j - 1)];
      const up = costMatrix[(i - 1) * cols + j];
      const left = costMatrix[i * cols + (j - 1)];

      const minPrev = Math.min(diag, up, left);
      costMatrix[i * cols + j] = d + minPrev;
    }
  }

  // 6. Backtracking: Find Optimal Warping Path from (N, M) down to (1, 1)
  const path: [number, number][] = [];
  let currI = N;
  let currJ = M;

  while (currI > 0 || currJ > 0) {
    path.push([currI - 1, currJ - 1]);

    if (currI === 1 && currJ === 1) {
      break;
    }

    if (currI === 1) {
      currJ--;
    } else if (currJ === 1) {
      currI--;
    } else {
      const diag = costMatrix[(currI - 1) * cols + (currJ - 1)];
      const up = costMatrix[(currI - 1) * cols + currJ];
      const left = costMatrix[currI * cols + (currJ - 1)];

      if (diag <= up && diag <= left) {
        currI--;
        currJ--;
      } else if (up <= left) {
        currI--;
      } else {
        currJ--;
      }
    }
  }

  // 7. Reverse path to guarantee chronological order from (0, 0) to (N-1, M-1)
  path.reverse();

  // 8. Build Aligned Matches and Frame Pairs
  const matches: DTWMatch[] = [];
  const alignedPairs: DTWFramePair[] = [];
  const matchedRefIndices = new Set<number>();

  let totalRawDistance = 0;

  for (const [rIdx, uIdx] of path) {
    const safeRIdx = Math.max(0, Math.min(N - 1, rIdx));
    const safeUIdx = Math.max(0, Math.min(M - 1, uIdx));

    matchedRefIndices.add(safeRIdx);

    const pairDist = calculateFrameDistance(
      refFrames[safeRIdx],
      userFrames[safeUIdx],
      weights,
      requiresBothHands
    );

    totalRawDistance += pairDist;

    matches.push({
      refIndex: safeRIdx,
      userIndex: safeUIdx,
      distance: pairDist,
    });

    alignedPairs.push({
      refIndex: safeRIdx,
      userIndex: safeUIdx,
      refFrame: refFrames[safeRIdx],
      userFrame: userFrames[safeUIdx],
      distance: pairDist,
    });
  }

  const pathLength = Math.max(1, path.length);
  const normalizedDistance = totalRawDistance / pathLength;
  const coverage = matchedRefIndices.size / N;

  // 9. Temporal Diagnostics & Feedback Analysis
  const temporalFeedback: string[] = [];

  const refDuration = reference.durationMs || 1000;
  const userDuration = user.durationMs || 1000;
  const durationRatio = userDuration / Math.max(1, refDuration);

  if (durationRatio < 0.5) {
    temporalFeedback.push("ทำท่าทางเร็วกว่าปกติ ควรชะลอจังหวะการเคลื่อนไหวให้ตรงกับตัวอย่าง");
  } else if (durationRatio > 1.8) {
    temporalFeedback.push("ทำท่าทางช้ากว่าปกติ ควรเพิ่มความคล่องแคล่วในการทำท่าทาง");
  }

  // Check if start of gesture is delayed
  let startLag = 0;
  for (let k = 0; k < Math.min(5, path.length); k++) {
    if (path[k][1] === 0 && path[k][0] > 0) {
      startLag++;
    }
  }
  if (startLag >= 4) {
    temporalFeedback.push("เริ่มต้นเคลื่อนไหวช้ากว่าจังหวะของตัวอย่าง");
  }

  // 10. Confidence Estimation
  const lengthRatio = Math.min(N, M) / Math.max(N, M);
  const distConfidence = Math.max(0.0, 1.0 - normalizedDistance * 1.3);
  const confidence = Number((coverage * 0.4 + distConfidence * 0.4 + lengthRatio * 0.2).toFixed(2));

  return {
    distance: Number(totalRawDistance.toFixed(4)),
    normalizedDistance: Number(normalizedDistance.toFixed(4)),
    path,
    matches,
    alignedPairs,
    referenceLength: N,
    userLength: M,
    coverage: Number(coverage.toFixed(2)),
    confidence,
    temporalFeedback,
  };
}
