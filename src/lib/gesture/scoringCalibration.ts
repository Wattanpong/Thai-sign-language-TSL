import {
  ReferenceGesture,
  ReferenceFrame,
  GestureScore,
} from "@/types";
import { extractGestureSequenceFeatures } from "./featureExtraction";
import { scoreGesture } from "./scoring";
import { computeDTW } from "@/lib/dtw/dtw";

export interface CalibrationScenarioResult {
  name: string;
  expectedRange: [number, number];
  overallScore: number;
  confidence: number;
  dtwDistance?: number;
  dtwPathLength?: number;
  componentScores: {
    handShape: number;
    fingerAngle: number;
    fingerCurl: number;
    palmOrientation: number;
    handPosition: number;
    twoHand: number;
    bodyContext: number;
  };
  feedbackCount: number;
  isPassed: boolean;
}

export interface CalibrationReport {
  timestamp: string;
  totalScenarios: number;
  passedScenarios: number;
  averageScore: number;
  averageConfidence: number;
  scenarios: CalibrationScenarioResult[];
}

/**
 * Creates synthetic reference and user sequences with programmatic variations
 */
export function createSyntheticGesture(
  frameCount = 25,
  durationMs = 1000,
  handType: "both" | "right-only" | "left-only" = "both",
  options: {
    scale?: number;
    noise?: number;
    angleOffsetDeg?: number;
    curlOffset?: number;
    posOffset?: { x: number; y: number; z: number };
    palmNormalAngleDeg?: number;
    temporalRate?: number; // e.g. 0.5 (fast), 2.0 (slow)
    pauseAtMiddle?: boolean;
    oppositeHand?: boolean;
  } = {}
): ReferenceGesture {
  const {
    scale = 1.0,
    noise = 0.0,
    angleOffsetDeg = 0,
    curlOffset = 0,
    posOffset = { x: 0, y: 0, z: 0 },
    palmNormalAngleDeg = 0,
    temporalRate = 1.0,
    pauseAtMiddle = false,
    oppositeHand = false,
  } = options;

  const actualFrameCount = Math.max(3, Math.round(frameCount * temporalRate));
  const actualDurationMs = Math.round(durationMs * temporalRate);
  const frames: ReferenceFrame[] = [];

  for (let i = 0; i < actualFrameCount; i++) {
    let progress = i / (actualFrameCount - 1 || 1);

    if (pauseAtMiddle && progress >= 0.4 && progress <= 0.7) {
      progress = 0.5; // Paused in the middle of gesture
    }

    const timestampMs = Math.round((i / (actualFrameCount - 1 || 1)) * actualDurationMs);

    const randomJitter = () => (Math.random() - 0.5) * 2 * noise;

    const baseHandY = 0.48 - Math.sin(progress * Math.PI) * 0.04;
    const baseRightX = 0.47 - (1 - progress) * 0.04;
    const baseLeftX = 0.53 + (1 - progress) * 0.04;

    const createHandLandmarks = (isRight: boolean) => {
      const centerX = isRight ? baseRightX : baseLeftX;
      const xDir = isRight ? 1 : -1;
      const rad = (angleOffsetDeg * Math.PI) / 180;
      const nRad = (palmNormalAngleDeg * Math.PI) / 180;

      const rotatePoint = (x: number, y: number, z: number) => {
        // 1. In-plane Z rotation (angleOffsetDeg)
        const x1 = x * Math.cos(rad) - y * Math.sin(rad);
        const y1 = x * Math.sin(rad) + y * Math.cos(rad);
        const z1 = z;

        // 2. Y-axis normal tilt (palmNormalAngleDeg)
        const x2 = x1 * Math.cos(nRad) + z1 * Math.sin(nRad);
        const y2 = y1;
        const z2 = -x1 * Math.sin(nRad) + z1 * Math.cos(nRad);

        return {
          x: (centerX + x2 + (isRight ? posOffset.x : -posOffset.x)) * scale + randomJitter(),
          y: (baseHandY + y2 + posOffset.y) * scale + randomJitter(),
          z: (z2 + posOffset.z) * scale + randomJitter(),
          visibility: 1.0,
        };
      };

      const pts = [];
      // 0: Wrist
      pts.push(rotatePoint(0, 0.08, 0));

      // 5 finger chains: Thumb(1-4), Index(5-8), Middle(9-12), Ring(13-16), Pinky(17-20)
      const spreadFactor = Math.max(0.2, 1 - curlOffset * 0.75);
      const fingerOffsets = [
        { x: -0.02 * xDir * spreadFactor, yBase: 0.05, len: 0.018 }, // Thumb
        { x: -0.01 * xDir * spreadFactor, yBase: 0.04, len: 0.022 }, // Index
        { x: 0.0, yBase: 0.04, len: 0.024 },                         // Middle
        { x: 0.01 * xDir * spreadFactor, yBase: 0.04, len: 0.022 },  // Ring
        { x: 0.02 * xDir * spreadFactor, yBase: 0.05, len: 0.018 },  // Pinky
      ];

      fingerOffsets.forEach((f) => {
        // MCP (base joint)
        pts.push(rotatePoint(f.x, f.yBase, 0));

        // Forward kinematics for finger curl: each joint curls by curlAngle radians
        const theta1 = curlOffset * 1.2; // MCP-PIP flexion (up to ~70 deg)
        const theta2 = curlOffset * 1.8; // PIP-DIP flexion (up to ~105 deg)
        const theta3 = curlOffset * 2.3; // DIP-TIP flexion (up to ~130 deg)

        // PIP
        const pipY = f.yBase - f.len * Math.cos(theta1);
        const pipZ = f.len * Math.sin(theta1);
        pts.push(rotatePoint(f.x, pipY, pipZ));

        // DIP
        const dipY = pipY - f.len * Math.cos(theta2);
        const dipZ = pipZ + f.len * Math.sin(theta2);
        pts.push(rotatePoint(f.x, dipY, dipZ));

        // TIP
        const tipY = dipY - f.len * Math.cos(theta3);
        const tipZ = dipZ + f.len * Math.sin(theta3);
        pts.push(rotatePoint(f.x, tipY, tipZ));
      });

      return pts;
    };

    const hands = [];

    if (handType === "both") {
      if (oppositeHand) {
        // User switched hands
        hands.push({ handedness: "Left" as const, landmarks: createHandLandmarks(true) });
        hands.push({ handedness: "Right" as const, landmarks: createHandLandmarks(false) });
      } else {
        hands.push({ handedness: "Right" as const, landmarks: createHandLandmarks(true) });
        hands.push({ handedness: "Left" as const, landmarks: createHandLandmarks(false) });
      }
    } else if (handType === "right-only") {
      if (oppositeHand) {
        hands.push({ handedness: "Left" as const, landmarks: createHandLandmarks(false) });
      } else {
        hands.push({ handedness: "Right" as const, landmarks: createHandLandmarks(true) });
      }
    } else if (handType === "left-only") {
      if (oppositeHand) {
        hands.push({ handedness: "Right" as const, landmarks: createHandLandmarks(true) });
      } else {
        hands.push({ handedness: "Left" as const, landmarks: createHandLandmarks(false) });
      }
    }

    const shoulderDist = 0.24 * scale;
    const pose = [
      { x: 0.5 * scale + randomJitter(), y: (0.25 + Math.sin(progress * Math.PI) * 0.02) * scale, z: 0, visibility: 1.0 }, // Nose
      ...Array.from({ length: 10 }, () => ({ x: 0.5 * scale, y: 0.25 * scale, z: 0, visibility: 1.0 })),
      { x: (0.5 + shoulderDist / 2) * scale, y: 0.45 * scale, z: 0, visibility: 1.0 }, // 11: Left shoulder
      { x: (0.5 - shoulderDist / 2) * scale, y: 0.45 * scale, z: 0, visibility: 1.0 }, // 12: Right shoulder
      ...Array.from({ length: 20 }, () => ({ x: 0.5 * scale, y: 0.65 * scale, z: 0, visibility: 0.9 })),
    ];

    frames.push({
      timestampMs,
      hands,
      pose,
    });
  }

  return {
    id: `synthetic_${Date.now()}`,
    lessonId: "hello",
    word: "สวัสดี",
    durationMs: actualDurationMs,
    frameCount: frames.length,
    frames,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Runs the full 10 calibration benchmark scenarios (A to J)
 */
export function runScoringCalibrationSuite(): CalibrationReport {
  const baseRef = createSyntheticGesture(25, 1000, "both");
  const refSeq = extractGestureSequenceFeatures(baseRef);

  const testDefinitions: {
    name: string;
    expectedRange: [number, number];
    userGesture: ReferenceGesture;
    requiresBothHands?: boolean;
  }[] = [
    {
      name: "A. Perfect Match (Reference = User)",
      expectedRange: [95, 100],
      userGesture: createSyntheticGesture(25, 1000, "both"),
      requiresBothHands: true,
    },
    {
      name: "B. Small Natural Variation (Minor Angle & Pos Jitter)",
      expectedRange: [80, 95],
      userGesture: createSyntheticGesture(25, 1000, "both", {
        angleOffsetDeg: 6,
        curlOffset: 0.12,
        posOffset: { x: 0.03, y: 0.03, z: 0 },
      }),
      requiresBothHands: true,
    },
    {
      name: "C. Moderate Error (Noticeable Curl & Angle Deviation)",
      expectedRange: [50, 79],
      userGesture: createSyntheticGesture(25, 1000, "both", {
        angleOffsetDeg: 25,
        curlOffset: 0.45,
        posOffset: { x: 0.08, y: 0.06, z: 0 },
      }),
      requiresBothHands: true,
    },
    {
      name: "D. Major Gesture Error (Wrong Orientation & Hand Shape)",
      expectedRange: [0, 49],
      userGesture: createSyntheticGesture(25, 1000, "both", {
        angleOffsetDeg: 75,
        palmNormalAngleDeg: 90,
        curlOffset: 0.9,
        posOffset: { x: 0.2, y: 0.2, z: 0.1 },
      }),
      requiresBothHands: true,
    },
    {
      name: "E. Wrong Hand (Used Left Hand instead of Right)",
      expectedRange: [0, 50],
      userGesture: createSyntheticGesture(25, 1000, "right-only", { oppositeHand: true }),
      requiresBothHands: false,
    },
    {
      name: "F. Missing Hand (1 Hand detected when 2 needed)",
      expectedRange: [0, 40],
      userGesture: createSyntheticGesture(25, 1000, "right-only"),
      requiresBothHands: true,
    },
    {
      name: "G. Temporal Variation (Slower Motion & Mid-pause with DTW Alignment)",
      expectedRange: [85, 100],
      userGesture: createSyntheticGesture(25, 1000, "both", {
        temporalRate: 1.5,
        pauseAtMiddle: true,
      }),
      requiresBothHands: true,
    },
    {
      name: "H. Camera Distance / Scale Invariance (0.7x vs 1.3x Distance)",
      expectedRange: [85, 100],
      userGesture: createSyntheticGesture(25, 1000, "both", { scale: 1.35 }),
      requiresBothHands: true,
    },
    {
      name: "I. Noise / Landmark Jitter Robustness",
      expectedRange: [85, 100],
      userGesture: createSyntheticGesture(25, 1000, "both", { noise: 0.002 }),
      requiresBothHands: true,
    },
    {
      name: "J. Completely Wrong Gesture",
      expectedRange: [0, 35],
      userGesture: createSyntheticGesture(25, 1000, "both", {
        angleOffsetDeg: 150,
        palmNormalAngleDeg: 180,
        curlOffset: 1.0,
        posOffset: { x: 0.5, y: -0.5, z: 0.3 },
      }),
      requiresBothHands: true,
    },
  ];

  const results: CalibrationScenarioResult[] = testDefinitions.map((def) => {
    const userSeq = extractGestureSequenceFeatures(def.userGesture);
    const dtwRes = computeDTW(refSeq, userSeq, { requiresBothHands: def.requiresBothHands });
    const score: GestureScore = scoreGesture(refSeq, userSeq, {
      gestureType: "dynamic",
      requiresBothHands: def.requiresBothHands,
    });

    const isPassed =
      score.overallScore >= def.expectedRange[0] &&
      score.overallScore <= def.expectedRange[1];

    return {
      name: def.name,
      expectedRange: def.expectedRange,
      overallScore: score.overallScore,
      confidence: Number((score.confidence * 100).toFixed(1)),
      dtwDistance: Number(dtwRes.normalizedDistance.toFixed(4)),
      dtwPathLength: dtwRes.path.length,
      componentScores: {
        handShape: score.handShapeScore,
        fingerAngle: score.fingerAngleScore,
        fingerCurl: score.fingerCurlScore,
        palmOrientation: score.palmOrientationScore,
        handPosition: score.handPositionScore,
        twoHand: score.twoHandScore,
        bodyContext: score.bodyContextScore,
      },
      feedbackCount: score.feedback.length,
      isPassed,
    };
  });

  const passedCount = results.filter((r) => r.isPassed).length;
  const avgScore = results.reduce((acc, r) => acc + r.overallScore, 0) / results.length;
  const avgConf = results.reduce((acc, r) => acc + r.confidence, 0) / results.length;

  return {
    timestamp: new Date().toISOString(),
    totalScenarios: results.length,
    passedScenarios: passedCount,
    averageScore: Number(avgScore.toFixed(1)),
    averageConfidence: Number(avgConf.toFixed(1)),
    scenarios: results,
  };
}
