import {
  NormalizedLandmark,
  ReferenceFrame,
  ReferenceGesture,
  ReferenceHand,
  Vector3D,
  FingerAngles,
  FingerCurls,
  SingleHandFeatures,
  HeadFeatures,
  BodyContextFeatures,
  TwoHandFeatures,
  GestureFeatureFrame,
  GestureFeatureSequence,
} from "@/types";

/* ==========================================================================
   1. 3D VECTOR & GEOMETRIC HELPER UTILITIES
   ========================================================================== */

export function dist3D(a: Vector3D, b: Vector3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

export function sub3D(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: (a.z ?? 0) - (b.z ?? 0),
  };
}

export function add3D(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: (a.z ?? 0) + (b.z ?? 0),
  };
}

export function scale3D(v: Vector3D, scale: number): Vector3D {
  return {
    x: v.x * scale,
    y: v.y * scale,
    z: v.z * scale,
  };
}

export function dotProduct(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossProduct(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vectorLength(v: Vector3D): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalizeVector(v: Vector3D): Vector3D {
  const len = vectorLength(v);
  if (len < 1e-7) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len,
  };
}

/**
 * Computes angular difference between two 3D orientation vectors (in degrees 0..180)
 */
export function vectorAngleDiff(v1: Vector3D, v2: Vector3D): number {
  const len1 = vectorLength(v1);
  const len2 = vectorLength(v2);
  if (len1 < 1e-7 || len2 < 1e-7) {
    return 0.0;
  }
  const dot = dotProduct(v1, v2) / (len1 * len2);
  const clamped = Math.max(-1.0, Math.min(1.0, dot));
  return Math.acos(clamped) * (180.0 / Math.PI);
}

/**
 * Calculates the interior angle (in degrees 0..180) at vertex point `b`
 * formed by vectors `ba` and `bc`.
 */
export function calculateJointAngle(
  a: Vector3D,
  b: Vector3D,
  c: Vector3D
): number {
  const v1 = sub3D(a, b);
  const v2 = sub3D(c, b);

  const len1 = vectorLength(v1);
  const len2 = vectorLength(v2);

  if (len1 < 1e-7 || len2 < 1e-7) {
    return 180.0; // Default extended angle if points coincide
  }

  const cosine = dotProduct(v1, v2) / (len1 * len2);
  const clamped = Math.max(-1.0, Math.min(1.0, cosine));
  return Math.acos(clamped) * (180.0 / Math.PI);
}

/**
 * Computes a normalized curl factor in range [0, 1] for a finger
 * 0 = fully extended / straight, 1 = fully curled / closed into fist
 */
export function calculateFingerCurl(
  angleMCP: number,
  anglePIP: number
): number {
  // Straight finger has joint angles near 180 degrees.
  // Bent/curled joint has angles near 60..90 degrees.
  const flexionMCP = Math.max(0, 180 - angleMCP) / 100.0;
  const flexionPIP = Math.max(0, 180 - anglePIP) / 100.0;
  const combined = flexionMCP * 0.45 + flexionPIP * 0.55;
  return Math.max(0.0, Math.min(1.0, combined));
}

/* ==========================================================================
   2. BODY CONTEXT EXTRACTION (Scale Normalizer & Center of Reference)
   ========================================================================== */

/**
 * Extracts shoulder center, width, and torso center from 33 Pose landmarks
 */
export function extractBodyContext(
  poseLandmarks?: NormalizedLandmark[]
): BodyContextFeatures {
  if (!poseLandmarks || poseLandmarks.length < 25) {
    // Missing pose fallback
    const defaultCenter: Vector3D = { x: 0.5, y: 0.5, z: 0 };
    return {
      detected: false,
      shoulderCenter: defaultCenter,
      shoulderWidth: 0.35, // Typical nominal shoulder width in normalized coords
      torsoCenter: { x: 0.5, y: 0.7, z: 0 },
      torsoHeight: 0.4,
    };
  }

  const leftShoulder = poseLandmarks[11];
  const rightShoulder = poseLandmarks[12];
  const leftHip = poseLandmarks[23];
  const rightHip = poseLandmarks[24];

  const shoulderCenter: Vector3D = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: ((leftShoulder.z ?? 0) + (rightShoulder.z ?? 0)) / 2,
  };

  const rawShoulderWidth = dist3D(leftShoulder, rightShoulder);
  // Ensure non-zero shoulder width to prevent division by zero
  const shoulderWidth = Math.max(0.05, rawShoulderWidth);

  const hipCenter: Vector3D = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: ((leftHip.z ?? 0) + (rightHip.z ?? 0)) / 2,
  };

  const torsoCenter: Vector3D = {
    x: (shoulderCenter.x + hipCenter.x) / 2,
    y: (shoulderCenter.y + hipCenter.y) / 2,
    z: (shoulderCenter.z + hipCenter.z) / 2,
  };

  const torsoHeight = dist3D(shoulderCenter, hipCenter);

  return {
    detected: true,
    shoulderCenter,
    shoulderWidth,
    torsoCenter,
    torsoHeight,
  };
}

/* ==========================================================================
   3. SINGLE HAND FEATURE EXTRACTION
   ========================================================================== */

/**
 * Extracts scale-invariant finger angles, curls, orientation, and body-relative position
 */
export function extractSingleHandFeatures(
  landmarks: NormalizedLandmark[],
  handedness: "Left" | "Right",
  bodyContext: BodyContextFeatures,
  poseLandmarks?: NormalizedLandmark[]
): SingleHandFeatures {
  if (!landmarks || landmarks.length < 21) {
    return {
      detected: false,
      handedness,
      fingerAngles: {
        thumbMCP: 180,
        thumbIP: 180,
        indexMCP: 180,
        indexPIP: 180,
        middleMCP: 180,
        middlePIP: 180,
        ringMCP: 180,
        ringPIP: 180,
        pinkyMCP: 180,
        pinkyPIP: 180,
      },
      fingerCurls: {
        thumb: 0,
        index: 0,
        middle: 0,
        ring: 0,
        pinky: 0,
      },
      handSpread: 0,
      palmSize: 0,
      palmNormal: { x: 0, y: 0, z: 1 },
      handFacingVector: { x: 0, y: -1, z: 0 },
      wristPosition: { x: 0, y: 0, z: 0 },
      palmCenter: { x: 0, y: 0, z: 0 },
      posRelShoulderCenter: null,
      posRelTorsoCenter: null,
      distFromNose: null,
      distFromChest: null,
    };
  }

  const wrist = landmarks[0];
  const thumbCMC = landmarks[1];
  const thumbMCP = landmarks[2];
  const thumbIP = landmarks[3];
  const thumbTip = landmarks[4];

  const indexMCP = landmarks[5];
  const indexPIP = landmarks[6];
  const indexDIP = landmarks[7];
  const indexTip = landmarks[8];

  const middleMCP = landmarks[9];
  const middlePIP = landmarks[10];
  const middleDIP = landmarks[11];
  const middleTip = landmarks[12];

  const ringMCP = landmarks[13];
  const ringPIP = landmarks[14];
  const ringDIP = landmarks[15];
  const ringTip = landmarks[16];

  const pinkyMCP = landmarks[17];
  const pinkyPIP = landmarks[18];
  const pinkyDIP = landmarks[19];
  const pinkyTip = landmarks[20];

  // 1. Finger Joint Angles
  const fingerAngles: FingerAngles = {
    thumbMCP: calculateJointAngle(thumbCMC, thumbMCP, thumbIP),
    thumbIP: calculateJointAngle(thumbMCP, thumbIP, thumbTip),
    indexMCP: calculateJointAngle(wrist, indexMCP, indexPIP),
    indexPIP: calculateJointAngle(indexMCP, indexPIP, indexDIP),
    middleMCP: calculateJointAngle(wrist, middleMCP, middlePIP),
    middlePIP: calculateJointAngle(middleMCP, middlePIP, middleDIP),
    ringMCP: calculateJointAngle(wrist, ringMCP, ringPIP),
    ringPIP: calculateJointAngle(ringMCP, ringPIP, ringDIP),
    pinkyMCP: calculateJointAngle(wrist, pinkyMCP, pinkyPIP),
    pinkyPIP: calculateJointAngle(pinkyMCP, pinkyPIP, pinkyDIP),
  };

  // 2. Finger Curls
  const fingerCurls: FingerCurls = {
    thumb: calculateFingerCurl(fingerAngles.thumbMCP, fingerAngles.thumbIP),
    index: calculateFingerCurl(fingerAngles.indexMCP, fingerAngles.indexPIP),
    middle: calculateFingerCurl(fingerAngles.middleMCP, fingerAngles.middlePIP),
    ring: calculateFingerCurl(fingerAngles.ringMCP, fingerAngles.ringPIP),
    pinky: calculateFingerCurl(fingerAngles.pinkyMCP, fingerAngles.pinkyPIP),
  };

  // 3. Palm Size & Centers
  const rawPalmSize = dist3D(wrist, middleMCP);
  const palmSize = Math.max(0.01, rawPalmSize);

  const palmCenter: Vector3D = {
    x: (wrist.x + indexMCP.x + middleMCP.x + ringMCP.x + pinkyMCP.x) / 5,
    y: (wrist.y + indexMCP.y + middleMCP.y + ringMCP.y + pinkyMCP.y) / 5,
    z:
      ((wrist.z ?? 0) +
        (indexMCP.z ?? 0) +
        (middleMCP.z ?? 0) +
        (ringMCP.z ?? 0) +
        (pinkyMCP.z ?? 0)) /
      5,
  };

  // 4. Hand Orientation Vectors
  const wristToIndex = sub3D(indexMCP, wrist);
  const wristToPinky = sub3D(pinkyMCP, wrist);
  const palmNormal = normalizeVector(crossProduct(wristToIndex, wristToPinky));
  const handFacingVector = normalizeVector(sub3D(middleMCP, wrist));

  // 5. Hand Spread (Normalized by palmSize)
  const spread1 = dist3D(thumbTip, indexTip);
  const spread2 = dist3D(indexTip, middleTip);
  const spread3 = dist3D(middleTip, ringTip);
  const spread4 = dist3D(ringTip, pinkyTip);
  const handSpread = (spread1 + spread2 + spread3 + spread4) / (4 * palmSize);

  // 6. Body-Relative Position (Normalized by shoulderWidth)
  const scale = 1.0 / bodyContext.shoulderWidth;

  const posRelShoulderCenter: Vector3D = {
    x: (wrist.x - bodyContext.shoulderCenter.x) * scale,
    y: (wrist.y - bodyContext.shoulderCenter.y) * scale,
    z: ((wrist.z ?? 0) - bodyContext.shoulderCenter.z) * scale,
  };

  const posRelTorsoCenter: Vector3D = {
    x: (wrist.x - bodyContext.torsoCenter.x) * scale,
    y: (wrist.y - bodyContext.torsoCenter.y) * scale,
    z: ((wrist.z ?? 0) - bodyContext.torsoCenter.z) * scale,
  };

  const distFromChest = dist3D(wrist, bodyContext.shoulderCenter) * scale;

  let distFromNose: number | null = null;
  if (poseLandmarks && poseLandmarks[0]) {
    distFromNose = dist3D(wrist, poseLandmarks[0]) * scale;
  }

  return {
    detected: true,
    handedness,
    fingerAngles,
    fingerCurls,
    handSpread,
    palmSize,
    palmNormal,
    handFacingVector,
    wristPosition: { x: wrist.x, y: wrist.y, z: wrist.z ?? 0 },
    palmCenter,
    posRelShoulderCenter,
    posRelTorsoCenter,
    distFromNose,
    distFromChest,
  };
}

/* ==========================================================================
   4. HEAD & FACE CONTEXT EXTRACTION
   ========================================================================== */

export function extractHeadFeatures(
  poseLandmarks?: NormalizedLandmark[],
  bodyContext?: BodyContextFeatures
): HeadFeatures {
  if (!poseLandmarks || poseLandmarks.length < 9) {
    return {
      detected: false,
      nosePosition: { x: 0.5, y: 0.2, z: 0 },
      noseRelShoulderCenter: null,
      headTiltAngle: 0,
      headVerticalDisplacement: null,
    };
  }

  const nose = poseLandmarks[0];
  const leftEar = poseLandmarks[7];
  const rightEar = poseLandmarks[8];

  const nosePos: Vector3D = {
    x: nose.x,
    y: nose.y,
    z: nose.z ?? 0,
  };

  let headTiltAngle = 0;
  if (leftEar && rightEar) {
    const dx = leftEar.x - rightEar.x;
    const dy = leftEar.y - rightEar.y;
    headTiltAngle = Math.atan2(dy, dx) * (180.0 / Math.PI);
  }

  let noseRelShoulderCenter: Vector3D | null = null;
  let headVerticalDisplacement: number | null = null;

  if (bodyContext && bodyContext.detected) {
    const scale = 1.0 / bodyContext.shoulderWidth;
    noseRelShoulderCenter = {
      x: (nosePos.x - bodyContext.shoulderCenter.x) * scale,
      y: (nosePos.y - bodyContext.shoulderCenter.y) * scale,
      z: (nosePos.z - bodyContext.shoulderCenter.z) * scale,
    };
    headVerticalDisplacement = (bodyContext.shoulderCenter.y - nosePos.y) * scale;
  }

  return {
    detected: true,
    nosePosition: nosePos,
    noseRelShoulderCenter,
    headTiltAngle,
    headVerticalDisplacement,
  };
}

/* ==========================================================================
   5. TWO-HAND RELATIONSHIP EXTRACTION
   ========================================================================== */

export function extractTwoHandFeatures(
  leftHand: SingleHandFeatures | null,
  rightHand: SingleHandFeatures | null,
  bodyContext: BodyContextFeatures
): TwoHandFeatures {
  if (!leftHand?.detected || !rightHand?.detected) {
    return {
      bothHandsDetected: false,
      wristDistance: null,
      palmDistance: null,
      heightDifference: null,
      horizontalDifference: null,
      depthDifference: null,
      symmetryScore: null,
    };
  }

  const scale = 1.0 / bodyContext.shoulderWidth;

  const wristDistance = dist3D(leftHand.wristPosition, rightHand.wristPosition) * scale;
  const palmDistance = dist3D(leftHand.palmCenter, rightHand.palmCenter) * scale;

  const heightDifference = (leftHand.wristPosition.y - rightHand.wristPosition.y) * scale;
  const horizontalDifference = (leftHand.wristPosition.x - rightHand.wristPosition.x) * scale;
  const depthDifference = (leftHand.wristPosition.z - rightHand.wristPosition.z) * scale;

  // Symmetry Score (1.0 = perfect bilateral symmetry across torso X center line)
  const leftOffsetFromMidline = Math.abs(leftHand.wristPosition.x - bodyContext.torsoCenter.x);
  const rightOffsetFromMidline = Math.abs(rightHand.wristPosition.x - bodyContext.torsoCenter.x);
  const offsetDiff = Math.abs(leftOffsetFromMidline - rightOffsetFromMidline) * scale;
  const yDiff = Math.abs(heightDifference);
  const asymmetry = offsetDiff * 0.5 + yDiff * 0.5;
  const symmetryScore = Math.max(0.0, Math.min(1.0, 1.0 - asymmetry));

  return {
    bothHandsDetected: true,
    wristDistance,
    palmDistance,
    heightDifference,
    horizontalDifference,
    depthDifference,
    symmetryScore,
  };
}

export interface AssignedHands {
  leftHand: ReferenceHand | null;
  rightHand: ReferenceHand | null;
}

/**
 * Robust Hand Assignment with Spatial Fallback:
 * Resolves left and right hands from raw detected hands by:
 * 1. Using MediaPipe handedness classification as primary signal
 * 2. Cross-verifying with spatial X coordinates relative to body midline
 * 3. Disambiguating duplicate labels (e.g. both labeled "Right") using horizontal ordering
 * In camera coordinate space (0..1 where 0 is image-left, 1 is image-right):
 * - User's anatomical Right Hand is on the image-left (smaller X)
 * - User's anatomical Left Hand is on the image-right (larger X)
 */
export function resolveHandAssignment(
  hands: ReferenceHand[] | undefined,
  bodyContext: BodyContextFeatures
): AssignedHands {
  if (!hands || hands.length === 0) {
    return { leftHand: null, rightHand: null };
  }

  // Helper to calculate hand center (average of wrist + MCPs)
  const getHandX = (hand: ReferenceHand): number => {
    if (!hand.landmarks || hand.landmarks.length === 0) return 0.5;
    const wrist = hand.landmarks[0];
    const indexMCP = hand.landmarks[5];
    const pinkyMCP = hand.landmarks[17];
    if (wrist && indexMCP && pinkyMCP) {
      return (wrist.x + indexMCP.x + pinkyMCP.x) / 3;
    }
    return wrist ? wrist.x : 0.5;
  };

  const bodyMidlineX = bodyContext.detected
    ? bodyContext.shoulderCenter.x
    : 0.5;
  const shoulderHalfWidth = bodyContext.detected
    ? bodyContext.shoulderWidth / 2
    : 0.175;

  // Case 1: Two Hands in Frame
  if (hands.length >= 2) {
    const handA = hands[0];
    const handB = hands[1];
    const xA = getHandX(handA);
    const xB = getHandX(handB);

    // If handednesses are distinct (one Left, one Right)
    if (handA.handedness !== handB.handedness) {
      const leftCandidate = handA.handedness === "Left" ? handA : handB;
      const rightCandidate = handA.handedness === "Right" ? handA : handB;
      const xLeft = getHandX(leftCandidate);
      const xRight = getHandX(rightCandidate);

      // Check for extreme spatial contradiction:
      // If the labeled Left hand is on the far image-left side (xLeft < bodyMidlineX - margin)
      // AND labeled Right hand is on the far image-right side (xRight > bodyMidlineX + margin)
      // AND xRight > xLeft, then handedness labels are completely inverted!
      const margin = Math.max(0.04, shoulderHalfWidth * 0.25);
      const isCompletelyInverted =
        xLeft < bodyMidlineX - margin &&
        xRight > bodyMidlineX + margin &&
        xRight > xLeft;

      if (isCompletelyInverted) {
        // Swap to correct inverted handedness
        return {
          leftHand: { ...rightCandidate, handedness: "Left" },
          rightHand: { ...leftCandidate, handedness: "Right" },
        };
      }

      // Normal consistent case: trust distinct labels
      return {
        leftHand: leftCandidate,
        rightHand: rightCandidate,
      };
    }

    // Handedness collision: Both labeled "Left" or both labeled "Right"
    // In camera space: Smaller X is image-left (User's Right Hand), Larger X is image-right (User's Left Hand)
    if (xA <= xB) {
      return {
        rightHand: { ...handA, handedness: "Right" },
        leftHand: { ...handB, handedness: "Left" },
      };
    } else {
      return {
        rightHand: { ...handB, handedness: "Right" },
        leftHand: { ...handA, handedness: "Left" },
      };
    }
  }

  // Case 2: Exactly One Hand in Frame
  const singleHand = hands[0];
  const handX = getHandX(singleHand);
  const labeledHandedness = singleHand.handedness;

  // Spatial clearance: Is the hand significantly on one side of the body?
  const margin = Math.max(0.04, shoulderHalfWidth * 0.4);

  // If labeled "Left", but clearly located deep in the Right-hand zone (image-left: handX < bodyMidlineX - margin)
  if (labeledHandedness === "Left" && handX < bodyMidlineX - margin) {
    return {
      leftHand: null,
      rightHand: { ...singleHand, handedness: "Right" },
    };
  }

  // If labeled "Right", but clearly located deep in the Left-hand zone (image-right: handX > bodyMidlineX + margin)
  if (labeledHandedness === "Right" && handX > bodyMidlineX + margin) {
    return {
      leftHand: { ...singleHand, handedness: "Left" },
      rightHand: null,
    };
  }

  // Otherwise, trust primary MediaPipe handedness (especially for centered hands near chest)
  if (labeledHandedness === "Left") {
    return { leftHand: singleHand, rightHand: null };
  } else {
    return { leftHand: null, rightHand: singleHand };
  }
}

/**
 * Extracts complete, normalized gesture features for a single recorded frame
 */
export function extractFrameFeatures(
  rawFrame: ReferenceFrame
): GestureFeatureFrame {
  const bodyContext = extractBodyContext(rawFrame.pose);
  const headFeatures = extractHeadFeatures(rawFrame.pose, bodyContext);

  const assigned = resolveHandAssignment(rawFrame.hands, bodyContext);

  const leftHandData: SingleHandFeatures | null = assigned.leftHand
    ? extractSingleHandFeatures(
        assigned.leftHand.landmarks,
        "Left",
        bodyContext,
        rawFrame.pose
      )
    : null;

  const rightHandData: SingleHandFeatures | null = assigned.rightHand
    ? extractSingleHandFeatures(
        assigned.rightHand.landmarks,
        "Right",
        bodyContext,
        rawFrame.pose
      )
    : null;

  const twoHandFeatures = extractTwoHandFeatures(
    leftHandData,
    rightHandData,
    bodyContext
  );

  return {
    timestampMs: rawFrame.timestampMs,
    leftHand: leftHandData,
    rightHand: rightHandData,
    head: headFeatures.detected ? headFeatures : null,
    body: bodyContext.detected ? bodyContext : null,
    twoHand: twoHandFeatures,
  };
}

/**
 * Extracts complete, normalized gesture features for an entire ReferenceGesture sequence
 */
export function extractGestureSequenceFeatures(
  gesture: ReferenceGesture
): GestureFeatureSequence {
  const frames: GestureFeatureFrame[] = (gesture.frames || []).map((frame) =>
    extractFrameFeatures(frame)
  );

  return {
    id: gesture.id,
    lessonId: gesture.lessonId,
    durationMs: gesture.durationMs,
    frameCount: frames.length,
    frames,
  };
}
