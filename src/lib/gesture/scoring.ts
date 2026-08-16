import {
  GestureFeatureFrame,
  GestureFeatureSequence,
  SingleHandFeatures,
  TwoHandFeatures,
  HeadFeatures,
  BodyContextFeatures,
  FingerAngles,
  FingerCurls,
  ComponentScore,
  FeatureScoreBreakdown,
  FrameScore,
  GestureScore,
  ScoreFeedback,
  ScoreSeverity,
  ScoringWeightsConfig,
  ScoringOptions,
} from "@/types";
import { dist3D, vectorAngleDiff } from "./featureExtraction";
import { computeDTW } from "@/lib/dtw/dtw";

/* ==========================================================================
   1. DEFAULT CONFIGURATION & WEIGHTS
   ========================================================================== */

export const DEFAULT_SCORING_WEIGHTS: ScoringWeightsConfig = {
  handShape: 0.15,
  fingerAngle: 0.15,
  fingerCurl: 0.15,
  palmOrientation: 0.25,
  handPosition: 0.15,
  twoHand: 0.10,
  bodyContext: 0.05,
};

const FINGER_NAMES_THAI: Record<keyof FingerCurls, string> = {
  thumb: "นิ้วโป้ง",
  index: "นิ้วชี้",
  middle: "นิ้วกลาง",
  ring: "นิ้วนาง",
  pinky: "นิ้วก้อย",
};

/* ==========================================================================
   2. MATHEMATICAL DISTANCE-TO-SCORE UTILITIES
   ========================================================================== */

/**
 * Converts a continuous metric difference into a calibrated 0–100 score.
 * Differences within `tolerance` receive 100 points.
 * Differences beyond `tolerance` decay smoothly using exponential decay.
 */
export function diffToScore(
  diff: number,
  tolerance: number,
  falloff: number
): number {
  const absDiff = Math.abs(diff);
  if (absDiff <= tolerance) {
    return 100.0;
  }
  const excess = absDiff - tolerance;
  const score = 100.0 * Math.exp(-excess / Math.max(1e-5, falloff));
  return Math.max(0.0, Math.min(100.0, score));
}



/* ==========================================================================
   3. INDIVIDUAL FEATURE COMPARISON FUNCTIONS
   ========================================================================== */

/**
 * Compares 10 finger joint angles between reference and user hands
 */
export function compareFingerAngles(
  refAngles: FingerAngles,
  userAngles: FingerAngles,
  tolMul = 1.0
): { score: number; feedback: ScoreFeedback[] } {
  const feedback: ScoreFeedback[] = [];
  const keys = Object.keys(refAngles) as (keyof FingerAngles)[];
  let totalScore = 0;

  keys.forEach((k) => {
    const diff = Math.abs(refAngles[k] - userAngles[k]);
    const jointScore = diffToScore(diff, 10.0 * tolMul, 25.0);
    totalScore += jointScore;

    if (jointScore < 60) {
      const fingerName = k.toLowerCase().includes("thumb")
        ? "นิ้วโป้ง"
        : k.toLowerCase().includes("index")
        ? "นิ้วชี้"
        : k.toLowerCase().includes("middle")
        ? "นิ้วกลาง"
        : k.toLowerCase().includes("ring")
        ? "นิ้วนาง"
        : "นิ้วก้อย";

      const severity: ScoreSeverity = jointScore < 30 ? "error" : "warning";
      feedback.push({
        category: "fingerAngle",
        message: `มุมข้อนิ้ว${fingerName}ทำมุมต่างจากตัวอย่าง (${Math.round(diff)}°)`,
        severity,
        score: Math.round(jointScore),
        relatedFeature: k,
      });
    }
  });

  return {
    score: totalScore / keys.length,
    feedback,
  };
}

/**
 * Compares 5 finger curls between reference and user hands
 */
export function compareFingerCurls(
  refCurls: FingerCurls,
  userCurls: FingerCurls,
  tolMul = 1.0
): { score: number; feedback: ScoreFeedback[] } {
  const feedback: ScoreFeedback[] = [];
  const keys = Object.keys(refCurls) as (keyof FingerCurls)[];
  let totalScore = 0;

  keys.forEach((k) => {
    const diff = userCurls[k] - refCurls[k];
    const absDiff = Math.abs(diff);
    const curlScore = diffToScore(absDiff, 0.10 * tolMul, 0.24);
    totalScore += curlScore;

    if (curlScore < 65) {
      const fingerName = FINGER_NAMES_THAI[k] || k;
      const isTooCurled = diff > 0;
      const message = isTooCurled
        ? `${fingerName}งอมากเกินไป ควรกาง/เหยียดออกมากกว่านี้`
        : `${fingerName}เหยียดมากเกินไป ควรงอ/กำเข้ามากกว่านี้`;

      feedback.push({
        category: "fingerCurl",
        message,
        severity: curlScore < 30 ? "error" : "warning",
        score: Math.round(curlScore),
        relatedFeature: `curl_${k}`,
      });
    }
  });

  return {
    score: totalScore / keys.length,
    feedback,
  };
}

/**
 * Compares overall hand shape (hand spread + palm geometry)
 */
export function compareHandShape(
  refHand: SingleHandFeatures,
  userHand: SingleHandFeatures,
  tolMul = 1.0
): { score: number; feedback: ScoreFeedback[] } {
  const feedback: ScoreFeedback[] = [];
  const spreadDiff = Math.abs(refHand.handSpread - userHand.handSpread);
  const spreadScore = diffToScore(spreadDiff, 0.10 * tolMul, 0.20);

  if (spreadScore < 60) {
    const message =
      userHand.handSpread > refHand.handSpread
        ? "กางนิ้วมือกว้างเกินไป ควรกระชับนิ้วเข้าหากัน"
        : "หุบนิ้วมือชิดเกินไป ควรกางนิ้วออกตามตัวอย่าง";

    feedback.push({
      category: "handShape",
      message,
      severity: spreadScore < 30 ? "error" : "warning",
      score: Math.round(spreadScore),
      relatedFeature: "handSpread",
    });
  }

  return {
    score: spreadScore,
    feedback,
  };
}

/**
 * Compares 3D palm normal and hand facing vector orientation
 */
export function comparePalmOrientation(
  refHand: SingleHandFeatures,
  userHand: SingleHandFeatures,
  tolMul = 1.0
): { score: number; feedback: ScoreFeedback[] } {
  const feedback: ScoreFeedback[] = [];

  const normalAngle = vectorAngleDiff(refHand.palmNormal, userHand.palmNormal);
  const normalScore = diffToScore(normalAngle, 15.0 * tolMul, 30.0);

  const facingAngle = vectorAngleDiff(
    refHand.handFacingVector,
    userHand.handFacingVector
  );
  const facingScore = diffToScore(facingAngle, 15.0 * tolMul, 30.0);

  // Minimum penalty weighting to avoid masking completely wrong orientation
  const combinedScore = Math.min(normalScore, facingScore) * 0.6 + ((normalScore + facingScore) / 2) * 0.4;

  if (combinedScore < 65) {
    const isMajor = combinedScore < 35;
    feedback.push({
      category: "palmOrientation",
      message: `ทิศทางการหันของฝ่ามือหรือมุมชี้ของมือเบี่ยงเบนจากตัวอย่าง (${Math.round(Math.max(normalAngle, facingAngle))}°)`,
      severity: isMajor ? "error" : "warning",
      score: Math.round(combinedScore),
      relatedFeature: "palmOrientation",
    });
  }

  return {
    score: combinedScore,
    feedback,
  };
}

/**
 * Compares body-relative hand spatial positions (normalized by shoulder width)
 */
export function compareHandPosition(
  refHand: SingleHandFeatures,
  userHand: SingleHandFeatures,
  tolMul = 1.0
): { score: number; feedback: ScoreFeedback[] } {
  const feedback: ScoreFeedback[] = [];

  if (!refHand.posRelShoulderCenter || !userHand.posRelShoulderCenter) {
    return { score: 100.0, feedback: [] };
  }

  const posDiff = dist3D(
    refHand.posRelShoulderCenter,
    userHand.posRelShoulderCenter
  );
  const posScore = diffToScore(posDiff, 0.08 * tolMul, 0.22);

  const yDiff = userHand.posRelShoulderCenter.y - refHand.posRelShoulderCenter.y;
  const xDiff = userHand.posRelShoulderCenter.x - refHand.posRelShoulderCenter.x;

  if (posScore < 65) {
    let positionNote = "ตำแหน่งมือเบี่ยงเบนจากตัวอย่าง";
    if (yDiff < -0.2) {
      positionNote = "ตำแหน่งมืออยู่สูงกว่าตัวอย่าง";
    } else if (yDiff > 0.2) {
      positionNote = "ตำแหน่งมืออยู่ต่ำกว่าตัวอย่าง";
    } else if (Math.abs(xDiff) > 0.25) {
      positionNote = "ระยะมือในแนวนอนห่างจากกึ่งกลางลำตัวต่างจากตัวอย่าง";
    }

    feedback.push({
      category: "handPosition",
      message: positionNote,
      severity: posScore < 30 ? "error" : "warning",
      score: Math.round(posScore),
      relatedFeature: "posRelShoulderCenter",
    });
  }

  return {
    score: posScore,
    feedback,
  };
}

/**
 * Compares two-hand geometric relationship (distance between hands, symmetry, height offset)
 */
export function compareTwoHandRelationship(
  refTwoHand: TwoHandFeatures | null,
  userTwoHand: TwoHandFeatures | null,
  requiresBothHands = false,
  tolMul = 1.0
): { score: number; confidence: number; feedback: ScoreFeedback[] } {
  const feedback: ScoreFeedback[] = [];

  const refNeedsBoth = requiresBothHands || (refTwoHand?.bothHandsDetected ?? false);
  const userHasBoth = userTwoHand?.bothHandsDetected ?? false;

  if (refNeedsBoth && !userHasBoth) {
    feedback.push({
      category: "twoHand",
      message: "ท่าทางนี้ต้องใช้ 2 มือพร้อมกัน แต่ระบบตรวจพบเพียงมือเดียว",
      severity: "error",
      score: 0,
      relatedFeature: "bothHandsDetected",
    });
    return { score: 0.0, confidence: 0.3, feedback };
  }

  if (!refNeedsBoth && !userHasBoth) {
    // Single-hand sign, two-hand check not applicable
    return { score: 100.0, confidence: 1.0, feedback: [] };
  }

  if (!refTwoHand || !userTwoHand || refTwoHand.wristDistance === null || userTwoHand.wristDistance === null) {
    return { score: 100.0, confidence: 0.8, feedback: [] };
  }

  const wristDistDiff = Math.abs(refTwoHand.wristDistance - userTwoHand.wristDistance);
  const wristDistScore = diffToScore(wristDistDiff, 0.08 * tolMul, 0.22);

  const heightDiffDelta = Math.abs((refTwoHand.heightDifference ?? 0) - (userTwoHand.heightDifference ?? 0));
  const heightScore = diffToScore(heightDiffDelta, 0.08 * tolMul, 0.20);

  const symDelta = Math.abs((refTwoHand.symmetryScore ?? 1.0) - (userTwoHand.symmetryScore ?? 1.0));
  const symScore = diffToScore(symDelta, 0.08 * tolMul, 0.20);

  const combinedScore = wristDistScore * 0.45 + heightScore * 0.3 + symScore * 0.25;

  if (combinedScore < 65) {
    const isMajor = combinedScore < 40;
    if (wristDistDiff > 0.2) {
      feedback.push({
        category: "twoHand",
        message: "ระยะห่างระหว่างมือทั้งสองข้างไม่ตรงกับตัวอย่าง (มือชิดหรือห่างเกินไป)",
        severity: isMajor ? "error" : "warning",
        score: Math.round(wristDistScore),
        relatedFeature: "wristDistance",
      });
    } else if (symScore < 60) {
      feedback.push({
        category: "twoHand",
        message: "ตำแหน่งมือซ้ายและมือขวาไม่สมมาตรตามตัวอย่าง",
        severity: isMajor ? "error" : "warning",
        score: Math.round(symScore),
        relatedFeature: "symmetryScore",
      });
    }
  }

  return {
    score: combinedScore,
    confidence: 1.0,
    feedback,
  };
}

/**
 * Compares head posture, tilt, and body context
 */
export function compareBodyContext(
  refHead: HeadFeatures | null,
  userHead: HeadFeatures | null,
  refBody: BodyContextFeatures | null,
  userBody: BodyContextFeatures | null,
  tolMul = 1.0
): { score: number; confidence: number; feedback: ScoreFeedback[] } {
  const feedback: ScoreFeedback[] = [];

  if (!refHead || !userHead || !refHead.detected || !userHead.detected) {
    // Missing pose fallback
    return { score: 100.0, confidence: 0.5, feedback: [] };
  }

  const tiltDiff = Math.abs(refHead.headTiltAngle - userHead.headTiltAngle);
  const tiltScore = diffToScore(tiltDiff, 15.0 * tolMul, 30.0);

  if (tiltScore < 60) {
    feedback.push({
      category: "bodyContext",
      message: "มุมเอียงของศีรษะเบี่ยงเบนจากตัวอย่าง",
      severity: "info",
      score: Math.round(tiltScore),
      relatedFeature: "headTiltAngle",
    });
  }

  return {
    score: tiltScore,
    confidence: 1.0,
    feedback,
  };
}

/* ==========================================================================
   4. SINGLE FRAME COMPARISON
   ========================================================================== */

/**
 * Compares a single reference frame with a user frame across all feature components
 */
export function compareSingleFrame(
  refFrame: GestureFeatureFrame,
  userFrame: GestureFeatureFrame,
  options: ScoringOptions = {}
): {
  score: number;
  confidence: number;
  breakdown: FeatureScoreBreakdown;
  feedback: ScoreFeedback[];
} {
  const weights: ScoringWeightsConfig = {
    ...DEFAULT_SCORING_WEIGHTS,
    ...options.weights,
  };
  const tolMul = options.toleranceMultiplier ?? 1.0;

  const allFeedback: ScoreFeedback[] = [];
  let availableFeatureWeight = 0;
  let weightedScoreSum = 0;
  let totalConfidenceSum = 0;
  let confidenceCount = 0;

  // Determine which hand(s) are present in the reference frame
  const refHandsToEvaluate: ("Left" | "Right")[] = [];
  if (refFrame.rightHand?.detected) refHandsToEvaluate.push("Right");
  if (refFrame.leftHand?.detected) refHandsToEvaluate.push("Left");
  if (refHandsToEvaluate.length === 0) refHandsToEvaluate.push("Right");

  // 1. Hand Shape Component
  let handShapeScoreSum = 0;
  let handShapeConfidence = 0;
  // 2. Finger Angles Component
  let fingerAngleScoreSum = 0;
  let fingerAngleConfidence = 0;
  // 3. Finger Curls Component
  let fingerCurlScoreSum = 0;
  let fingerCurlConfidence = 0;
  // 4. Palm Orientation Component
  let palmOrientationScoreSum = 0;
  let palmOrientationConfidence = 0;
  // 5. Hand Position Component
  let handPositionScoreSum = 0;
  let handPositionConfidence = 0;

  refHandsToEvaluate.forEach((handedness) => {
    const refHand = handedness === "Right" ? refFrame.rightHand : refFrame.leftHand;
    const userHand = handedness === "Right" ? userFrame.rightHand : userFrame.leftHand;
    const handLabel = handedness === "Right" ? "มือขวา" : "มือซ้าย";

    if (!userHand?.detected) {
      allFeedback.push({
        category: "coverage",
        message: `ไม่พบ${handLabel}ในเฟรมนี้`,
        severity: "error",
        score: 0,
        relatedFeature: `${handedness}HandDetected`,
      });
      return;
    }

    if (refHand?.detected) {
      // Shape
      const shapeRes = compareHandShape(refHand, userHand, tolMul);
      handShapeScoreSum += shapeRes.score;
      handShapeConfidence += 1.0;
      allFeedback.push(...shapeRes.feedback);

      // Angles
      const angleRes = compareFingerAngles(refHand.fingerAngles, userHand.fingerAngles, tolMul);
      fingerAngleScoreSum += angleRes.score;
      fingerAngleConfidence += 1.0;
      allFeedback.push(...angleRes.feedback);

      // Curls
      const curlRes = compareFingerCurls(refHand.fingerCurls, userHand.fingerCurls, tolMul);
      fingerCurlScoreSum += curlRes.score;
      fingerCurlConfidence += 1.0;
      allFeedback.push(...curlRes.feedback);

      // Orientation
      const orientRes = comparePalmOrientation(refHand, userHand, tolMul);
      palmOrientationScoreSum += orientRes.score;
      palmOrientationConfidence += 1.0;
      allFeedback.push(...orientRes.feedback);

      // Position
      const posRes = compareHandPosition(refHand, userHand, tolMul);
      handPositionScoreSum += posRes.score;
      handPositionConfidence += 1.0;
      allFeedback.push(...posRes.feedback);
    }
  });

  const numHands = Math.max(1, refHandsToEvaluate.length);

  const handShapeComponent: ComponentScore = {
    score: handShapeScoreSum / numHands,
    weight: weights.handShape,
    confidence: handShapeConfidence / numHands,
  };
  const fingerAngleComponent: ComponentScore = {
    score: fingerAngleScoreSum / numHands,
    weight: weights.fingerAngle,
    confidence: fingerAngleConfidence / numHands,
  };
  const fingerCurlComponent: ComponentScore = {
    score: fingerCurlScoreSum / numHands,
    weight: weights.fingerCurl,
    confidence: fingerCurlConfidence / numHands,
  };
  const palmOrientationComponent: ComponentScore = {
    score: palmOrientationScoreSum / numHands,
    weight: weights.palmOrientation,
    confidence: palmOrientationConfidence / numHands,
  };
  const handPositionComponent: ComponentScore = {
    score: handPositionScoreSum / numHands,
    weight: weights.handPosition,
    confidence: handPositionConfidence / numHands,
  };

  // 6. Two-Hand Component
  const twoHandRes = compareTwoHandRelationship(
    refFrame.twoHand,
    userFrame.twoHand,
    options.requiresBothHands,
    tolMul
  );
  const twoHandComponent: ComponentScore = {
    score: twoHandRes.score,
    weight: weights.twoHand,
    confidence: twoHandRes.confidence,
  };
  allFeedback.push(...twoHandRes.feedback);

  // 7. Body Context Component
  const bodyRes = compareBodyContext(
    refFrame.head,
    userFrame.head,
    refFrame.body,
    userFrame.body,
    tolMul
  );
  const bodyContextComponent: ComponentScore = {
    score: bodyRes.score,
    weight: weights.bodyContext,
    confidence: bodyRes.confidence,
  };
  allFeedback.push(...bodyRes.feedback);

  const breakdown: FeatureScoreBreakdown = {
    handShape: handShapeComponent,
    fingerAngle: fingerAngleComponent,
    fingerCurl: fingerCurlComponent,
    palmOrientation: palmOrientationComponent,
    handPosition: handPositionComponent,
    twoHand: twoHandComponent,
    bodyContext: bodyContextComponent,
  };

  // Weighted calculation
  Object.values(breakdown).forEach((comp) => {
    weightedScoreSum += comp.score * comp.weight;
    availableFeatureWeight += comp.weight;
    totalConfidenceSum += comp.confidence;
    confidenceCount++;
  });

  const frameScore =
    availableFeatureWeight > 0 ? weightedScoreSum / availableFeatureWeight : 0;
  const frameConfidence =
    confidenceCount > 0 ? totalConfidenceSum / confidenceCount : 0;

  return {
    score: Math.max(0, Math.min(100, frameScore)),
    confidence: Math.max(0, Math.min(1, frameConfidence)),
    breakdown,
    feedback: allFeedback,
  };
}

/* ==========================================================================
   5. MAIN GESTURE SCORING ENTRYPOINT (WITH DTW ALIGNMENT)
   ========================================================================== */

/**
 * Evaluates and scores a User gesture sequence against a Reference gesture sequence.
 * Uses Dynamic Time Warping (DTW) for dynamic sequences and representative keyframe comparison for static gestures.
 */
export function scoreGesture(
  reference: GestureFeatureSequence,
  user: GestureFeatureSequence,
  options: ScoringOptions = {}
): GestureScore {
  const isStatic = options.gestureType === "static";

  // Guard against empty inputs
  if (
    !reference ||
    !reference.frames ||
    reference.frames.length === 0 ||
    !user ||
    !user.frames ||
    user.frames.length === 0
  ) {
    const zeroBreakdown: FeatureScoreBreakdown = {
      handShape: { score: 0, weight: 0.2, confidence: 0 },
      fingerAngle: { score: 0, weight: 0.15, confidence: 0 },
      fingerCurl: { score: 0, weight: 0.15, confidence: 0 },
      palmOrientation: { score: 0, weight: 0.15, confidence: 0 },
      handPosition: { score: 0, weight: 0.15, confidence: 0 },
      twoHand: { score: 0, weight: 0.15, confidence: 0 },
      bodyContext: { score: 0, weight: 0.05, confidence: 0 },
    };

    return {
      overallScore: 0,
      handShapeScore: 0,
      fingerAngleScore: 0,
      fingerCurlScore: 0,
      palmOrientationScore: 0,
      handPositionScore: 0,
      twoHandScore: 0,
      bodyContextScore: 0,
      confidence: 0,
      feedback: [
        {
          category: "coverage",
          message: "ไม่พบข้อมูลเฟรมสำหรับเปรียบเทียบท่าทาง",
          severity: "error",
          score: 0,
        },
      ],
      breakdown: zeroBreakdown,
      matchedFrames: 0,
      totalFrames: reference?.frames?.length || 0,
    };
  }

  const perFrameScores: FrameScore[] = [];
  const rawFeedback: ScoreFeedback[] = [];

  let sumHandShape = 0;
  let sumFingerAngle = 0;
  let sumFingerCurl = 0;
  let sumPalmOrient = 0;
  let sumHandPos = 0;
  let sumTwoHand = 0;
  let sumBody = 0;
  let sumConfidence = 0;
  let sumOverallScore = 0;
  let numEvaluated = 0;

  if (isStatic) {
    // Static Gesture: Compare against representative keyframe using Sliding Window Stability
    const refKeyframe =
      reference.frames[Math.floor(reference.frames.length / 2)] || reference.frames[0];

    const frameEvaluations = user.frames.map((uFrame) =>
      compareSingleFrame(refKeyframe, uFrame, options)
    );

    const N = frameEvaluations.length;
    const targetHoldFrames = 12;
    const windowSize = Math.max(1, Math.min(targetHoldFrames, N));

    let bestWindowScore = -1;
    let bestWindowStart = 0;
    let bestWindowEnd = windowSize - 1;

    for (let i = 0; i <= N - windowSize; i++) {
      const windowEvals = frameEvaluations.slice(i, i + windowSize);
      const meanScore =
        windowEvals.reduce((sum, e) => sum + e.score, 0) / windowSize;

      // Variance calculation for stability
      const variance =
        windowEvals.reduce((sum, e) => sum + Math.pow(e.score - meanScore, 2), 0) / windowSize;
      const stdDev = Math.sqrt(variance);
      // Stability bonus/penalty
      const stabilityBonus = Math.max(0.7, 1.0 - stdDev / 100.0);

      const effectiveWindowScore = meanScore * stabilityBonus;

      if (effectiveWindowScore > bestWindowScore) {
        bestWindowScore = effectiveWindowScore;
        bestWindowStart = i;
        bestWindowEnd = i + windowSize - 1;
      }
    }

    // Selected sustained window frames
    const sustainedEvaluations = frameEvaluations.slice(
      bestWindowStart,
      bestWindowEnd + 1
    );

    // If total user sequence is too short or flick (< 8 frames), apply hold duration penalty
    const holdCoverageFactor = N < 8 ? Math.max(0.3, N / targetHoldFrames) : 1.0;

    numEvaluated = sustainedEvaluations.length;
    sustainedEvaluations.forEach((cmp, idx) => {
      sumOverallScore += cmp.score * holdCoverageFactor;
      sumConfidence += cmp.confidence;
      sumHandShape += cmp.breakdown.handShape.score;
      sumFingerAngle += cmp.breakdown.fingerAngle.score;
      sumFingerCurl += cmp.breakdown.fingerCurl.score;
      sumPalmOrient += cmp.breakdown.palmOrientation.score;
      sumHandPos += cmp.breakdown.handPosition.score;
      sumTwoHand += cmp.breakdown.twoHand.score;
      sumBody += cmp.breakdown.bodyContext.score;
      rawFeedback.push(...cmp.feedback);

      if (options.includePerFrameScores) {
        perFrameScores.push({
          frameIndex: bestWindowStart + idx,
          timestampMs: user.frames[bestWindowStart + idx]?.timestampMs ?? 0,
          score: Math.round(cmp.score),
          breakdown: cmp.breakdown,
        });
      }
    });

    if (N < 8) {
      rawFeedback.push({
        category: "coverage",
        message: "ระยะเวลาในการค้างท่านิ่งสั้นเกินไป ควรค้างท่าไว้อย่างน้อย 0.5–1 วินาที",
        severity: "warning",
        score: Math.round(holdCoverageFactor * 100),
      });
    }
  } else {
    // Dynamic Gesture: Apply DTW Alignment (STEP 6C)
    const dtwResult = computeDTW(reference, user, {
      weights: options.weights,
      requiresBothHands: options.requiresBothHands,
    });

    // Add DTW temporal diagnostics feedback
    if (dtwResult.temporalFeedback && dtwResult.temporalFeedback.length > 0) {
      dtwResult.temporalFeedback.forEach((msg) => {
        rawFeedback.push({
          category: "coverage",
          message: msg,
          severity: "warning",
          score: Math.round(dtwResult.confidence * 100),
        });
      });
    }

    const alignedPairs = dtwResult.alignedPairs;
    numEvaluated = Math.max(1, alignedPairs.length);

    alignedPairs.forEach((pair, pIdx) => {
      const comparison = compareSingleFrame(pair.refFrame, pair.userFrame, options);

      sumOverallScore += comparison.score;
      sumConfidence += comparison.confidence;
      sumHandShape += comparison.breakdown.handShape.score;
      sumFingerAngle += comparison.breakdown.fingerAngle.score;
      sumFingerCurl += comparison.breakdown.fingerCurl.score;
      sumPalmOrient += comparison.breakdown.palmOrientation.score;
      sumHandPos += comparison.breakdown.handPosition.score;
      sumTwoHand += comparison.breakdown.twoHand.score;
      sumBody += comparison.breakdown.bodyContext.score;
      rawFeedback.push(...comparison.feedback);

      if (options.includePerFrameScores) {
        perFrameScores.push({
          frameIndex: pIdx,
          timestampMs: pair.refFrame.timestampMs,
          score: Math.round(comparison.score),
          breakdown: comparison.breakdown,
        });
      }
    });
  }

  const finalBreakdown: FeatureScoreBreakdown = {
    handShape: {
      score: Math.round(sumHandShape / numEvaluated),
      weight: options.weights?.handShape ?? DEFAULT_SCORING_WEIGHTS.handShape,
      confidence: Number((sumConfidence / numEvaluated).toFixed(2)),
    },
    fingerAngle: {
      score: Math.round(sumFingerAngle / numEvaluated),
      weight: options.weights?.fingerAngle ?? DEFAULT_SCORING_WEIGHTS.fingerAngle,
      confidence: Number((sumConfidence / numEvaluated).toFixed(2)),
    },
    fingerCurl: {
      score: Math.round(sumFingerCurl / numEvaluated),
      weight: options.weights?.fingerCurl ?? DEFAULT_SCORING_WEIGHTS.fingerCurl,
      confidence: Number((sumConfidence / numEvaluated).toFixed(2)),
    },
    palmOrientation: {
      score: Math.round(sumPalmOrient / numEvaluated),
      weight: options.weights?.palmOrientation ?? DEFAULT_SCORING_WEIGHTS.palmOrientation,
      confidence: Number((sumConfidence / numEvaluated).toFixed(2)),
    },
    handPosition: {
      score: Math.round(sumHandPos / numEvaluated),
      weight: options.weights?.handPosition ?? DEFAULT_SCORING_WEIGHTS.handPosition,
      confidence: Number((sumConfidence / numEvaluated).toFixed(2)),
    },
    twoHand: {
      score: Math.round(sumTwoHand / numEvaluated),
      weight: options.weights?.twoHand ?? DEFAULT_SCORING_WEIGHTS.twoHand,
      confidence: Number((sumConfidence / numEvaluated).toFixed(2)),
    },
    bodyContext: {
      score: Math.round(sumBody / numEvaluated),
      weight: options.weights?.bodyContext ?? DEFAULT_SCORING_WEIGHTS.bodyContext,
      confidence: Number((sumConfidence / numEvaluated).toFixed(2)),
    },
  };

  // Prioritize, de-duplicate and limit feedback messages
  const seenMessages = new Set<string>();
  const prioritizedFeedback: ScoreFeedback[] = [];

  const severityOrder: Record<ScoreSeverity, number> = {
    error: 1,
    warning: 2,
    info: 3,
  };

  rawFeedback
    .sort((a, b) => {
      const orderDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (orderDiff !== 0) return orderDiff;
      return a.score - b.score;
    })
    .forEach((item) => {
      if (!seenMessages.has(item.message) && prioritizedFeedback.length < 6) {
        seenMessages.add(item.message);
        prioritizedFeedback.push(item);
      }
    });

  // Check if sign requires 2 hands but user mostly provided 1 hand
  const bothHandsCount = user.frames.filter(
    (f) => f.leftHand?.detected && f.rightHand?.detected
  ).length;
  const userHasBothHands = bothHandsCount >= Math.ceil(user.frames.length * 0.4);

  let finalOverallScore = Math.round(sumOverallScore / numEvaluated);
  let finalConfidence = Number((sumConfidence / numEvaluated).toFixed(2));

  // Critical Error Clamping 1: Wrong Palm Orientation (< 40)
  if (finalBreakdown.palmOrientation.score < 40) {
    finalOverallScore = Math.min(finalOverallScore, 50);
    prioritizedFeedback.unshift({
      category: "palmOrientation",
      message: "ทิศทางการหันของฝ่ามือหรือมุมชี้ของมือผิดทิศทางอย่างมาก (คะแนนถูกจำกัดไม่เกิน 50 คะแนน)",
      severity: "error",
      score: finalBreakdown.palmOrientation.score,
    });
  }

  // Critical Error Clamping 2: Missing Required Hand
  if (options.requiresBothHands && !userHasBothHands) {
    // Missing required second hand reduces score and confidence
    finalOverallScore = Math.min(38, Math.round(finalOverallScore * 0.70));
    finalConfidence = Math.min(finalConfidence, 0.40);
  }

  return {
    overallScore: Math.max(0, Math.min(100, finalOverallScore)),
    handShapeScore: finalBreakdown.handShape.score,
    fingerAngleScore: finalBreakdown.fingerAngle.score,
    fingerCurlScore: finalBreakdown.fingerCurl.score,
    palmOrientationScore: finalBreakdown.palmOrientation.score,
    handPositionScore: finalBreakdown.handPosition.score,
    twoHandScore: finalBreakdown.twoHand.score,
    bodyContextScore: finalBreakdown.bodyContext.score,
    confidence: Math.max(0, Math.min(1, finalConfidence)),
    feedback: prioritizedFeedback,
    breakdown: finalBreakdown,
    matchedFrames: numEvaluated,
    totalFrames: reference.frames.length,
    ...(options.includePerFrameScores ? { perFrameScores } : {}),
  };
}
