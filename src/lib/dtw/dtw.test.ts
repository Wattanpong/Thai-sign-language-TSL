import assert from "node:assert/strict";
import test from "node:test";
import { computeDTW, calculateFrameDistance } from "./dtw";
import { scoreGesture } from "@/lib/gesture/scoring";
import {
  GestureFeatureFrame,
  GestureFeatureSequence,
  SingleHandFeatures,
  FingerAngles,
  FingerCurls,
  TwoHandFeatures,
  HeadFeatures,
  BodyContextFeatures,
} from "@/types";

/* ==========================================================================
   MOCK FACTORY HELPERS
   ========================================================================== */

function createMockFingerAngles(override?: Partial<FingerAngles>): FingerAngles {
  return {
    thumbMCP: 170,
    thumbIP: 170,
    indexMCP: 175,
    indexPIP: 175,
    middleMCP: 180,
    middlePIP: 180,
    ringMCP: 175,
    ringPIP: 175,
    pinkyMCP: 170,
    pinkyPIP: 170,
    ...override,
  };
}

function createMockFingerCurls(override?: Partial<FingerCurls>): FingerCurls {
  return {
    thumb: 0.1,
    index: 0.05,
    middle: 0.05,
    ring: 0.05,
    pinky: 0.1,
    ...override,
  };
}

function createMockHand(
  handedness: "Left" | "Right" = "Right",
  overrides?: Partial<SingleHandFeatures>
): SingleHandFeatures {
  return {
    detected: true,
    handedness,
    fingerAngles: createMockFingerAngles(),
    fingerCurls: createMockFingerCurls(),
    handSpread: 1.2,
    palmSize: 0.12,
    palmNormal: { x: 0, y: 0, z: 1 },
    handFacingVector: { x: 0, y: -1, z: 0 },
    wristPosition: { x: handedness === "Right" ? 0.4 : 0.6, y: 0.45, z: 0 },
    palmCenter: { x: handedness === "Right" ? 0.4 : 0.6, y: 0.4, z: 0 },
    posRelShoulderCenter: { x: handedness === "Right" ? -0.2 : 0.2, y: 0.1, z: 0 },
    posRelTorsoCenter: { x: handedness === "Right" ? -0.2 : 0.2, y: -0.1, z: 0 },
    distFromNose: 0.6,
    distFromChest: 0.3,
    ...overrides,
  };
}

function createMockHead(override?: Partial<HeadFeatures>): HeadFeatures {
  return {
    detected: true,
    nosePosition: { x: 0.5, y: 0.25, z: 0 },
    noseRelShoulderCenter: { x: 0, y: -0.6, z: 0 },
    headTiltAngle: 0,
    headVerticalDisplacement: 0.6,
    ...override,
  };
}

function createMockBody(override?: Partial<BodyContextFeatures>): BodyContextFeatures {
  return {
    detected: true,
    shoulderCenter: { x: 0.5, y: 0.5, z: 0 },
    shoulderWidth: 0.4,
    torsoCenter: { x: 0.5, y: 0.7, z: 0 },
    torsoHeight: 0.4,
    ...override,
  };
}

function createMockTwoHand(override?: Partial<TwoHandFeatures>): TwoHandFeatures {
  return {
    bothHandsDetected: true,
    wristDistance: 0.5,
    palmDistance: 0.5,
    heightDifference: 0.0,
    horizontalDifference: -0.4,
    depthDifference: 0.0,
    symmetryScore: 0.95,
    ...override,
  };
}

function createMockFrame(
  timestampMs = 100,
  overrides?: Partial<GestureFeatureFrame>
): GestureFeatureFrame {
  return {
    timestampMs,
    leftHand: createMockHand("Left"),
    rightHand: createMockHand("Right"),
    head: createMockHead(),
    body: createMockBody(),
    twoHand: createMockTwoHand(),
    ...overrides,
  };
}

function createMockDynamicSequence(
  frameCount = 10,
  durationMs = 1000,
  movementDeltaY = 0.5
): GestureFeatureSequence {
  const frames: GestureFeatureFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const progress = frameCount > 1 ? i / (frameCount - 1) : 0;
    const timestampMs = Math.round(progress * durationMs);
    const handY = 0.6 - progress * movementDeltaY;

    frames.push(
      createMockFrame(timestampMs, {
        rightHand: createMockHand("Right", {
          posRelShoulderCenter: { x: -0.2, y: handY, z: 0 },
          wristPosition: { x: 0.4, y: handY, z: 0 },
        }),
      })
    );
  }
  return {
    durationMs,
    frameCount: frames.length,
    frames,
  };
}

/* ==========================================================================
   DTW UNIT TESTS
   ========================================================================== */

test("Dynamic Time Warping (DTW) Engine Tests", async (t) => {
  await t.test("1. Identical Sequences -> Distance = 0, Perfect Diagonal Path", () => {
    const ref = createMockDynamicSequence(10, 1000);
    const user = createMockDynamicSequence(10, 1000);

    const result = computeDTW(ref, user);
    assert.equal(result.distance, 0);
    assert.equal(result.normalizedDistance, 0);
    assert.equal(result.coverage, 1.0);
    assert.ok(result.confidence >= 0.95);

    // Path should be diagonal [0,0], [1,1], ..., [9,9]
    assert.equal(result.path.length, 10);
    for (let i = 0; i < 10; i++) {
      assert.equal(result.path[i][0], i);
      assert.equal(result.path[i][1], i);
    }
  });

  await t.test("2. Equal Length Sequences with Slight Offset", () => {
    const ref = createMockDynamicSequence(8, 1000, 0.4);
    const user = createMockDynamicSequence(8, 1000, 0.45);

    const result = computeDTW(ref, user);
    assert.equal(result.referenceLength, 8);
    assert.equal(result.userLength, 8);
    assert.ok(result.normalizedDistance < 0.1);
  });

  await t.test("3. Slower User Gesture (Temporal Stretching / User has more frames)", () => {
    const ref = createMockDynamicSequence(6, 1000);
    const user = createMockDynamicSequence(12, 2000); // 2x frames

    const result = computeDTW(ref, user);
    assert.equal(result.referenceLength, 6);
    assert.equal(result.userLength, 12);
    assert.ok(result.normalizedDistance < 0.05, `Got ${result.normalizedDistance}`);
    assert.equal(result.coverage, 1.0);
    assert.ok(result.temporalFeedback.some((f) => f.includes("ช้ากว่า")));
  });

  await t.test("4. Faster User Gesture (Temporal Compression / User has fewer frames)", () => {
    const ref = createMockDynamicSequence(12, 2000);
    const user = createMockDynamicSequence(6, 800); // half frames and fast duration

    const result = computeDTW(ref, user);
    assert.equal(result.referenceLength, 12);
    assert.equal(result.userLength, 6);
    assert.ok(result.normalizedDistance < 0.05);
    assert.ok(result.temporalFeedback.some((f) => f.includes("เร็วกว่า")));
  });

  await t.test("5. Temporal Stretching in the Middle (User paused mid-gesture)", () => {
    const ref = createMockDynamicSequence(8, 1000);
    // User duplicates frame 3 multiple times
    const userFrames: GestureFeatureFrame[] = [
      ...ref.frames.slice(0, 4),
      ref.frames[3],
      ref.frames[3],
      ref.frames[3],
      ...ref.frames.slice(4),
    ];
    const user: GestureFeatureSequence = {
      durationMs: 1500,
      frameCount: userFrames.length,
      frames: userFrames,
    };

    const result = computeDTW(ref, user);
    assert.ok(result.normalizedDistance < 0.05);
    assert.equal(result.coverage, 1.0);
  });

  await t.test("6. Temporal Compression in the Middle (User accelerated mid-gesture)", () => {
    const ref = createMockDynamicSequence(10, 1000);
    // User skipped some middle frames
    const userFrames: GestureFeatureFrame[] = [
      ref.frames[0],
      ref.frames[1],
      ref.frames[4],
      ref.frames[7],
      ref.frames[9],
    ];
    const user: GestureFeatureSequence = {
      durationMs: 700,
      frameCount: userFrames.length,
      frames: userFrames,
    };

    const result = computeDTW(ref, user);
    assert.ok(result.normalizedDistance < 0.15);
  });

  await t.test("7. Sequence with Missing Frames", () => {
    const ref = createMockDynamicSequence(10, 1000);
    const user: GestureFeatureSequence = {
      durationMs: 800,
      frameCount: 7,
      frames: [ref.frames[0], ref.frames[2], ref.frames[4], ref.frames[6], ref.frames[8], ref.frames[9]],
    };

    const result = computeDTW(ref, user);
    assert.ok(result.normalizedDistance < 0.1);
    assert.ok(result.coverage >= 0.6);
  });

  await t.test("8. Sequence with Inserted / Extra Duplicate Frames", () => {
    const ref = createMockDynamicSequence(5, 500);
    const userFrames = [
      ref.frames[0],
      ref.frames[0],
      ref.frames[1],
      ref.frames[2],
      ref.frames[2],
      ref.frames[3],
      ref.frames[4],
      ref.frames[4],
    ];
    const user: GestureFeatureSequence = {
      durationMs: 800,
      frameCount: userFrames.length,
      frames: userFrames,
    };

    const result = computeDTW(ref, user);
    assert.equal(result.distance, 0);
    assert.equal(result.normalizedDistance, 0);
  });

  await t.test("9. Small Feature Deviation -> Low Normalized Distance", () => {
    const ref = createMockDynamicSequence(6, 600);
    const user = createMockDynamicSequence(6, 600);
    // Small deviation in joint angle
    user.frames[2].rightHand!.fingerAngles.indexPIP = 160;

    const result = computeDTW(ref, user);
    assert.ok(result.normalizedDistance > 0 && result.normalizedDistance < 0.05);
  });

  await t.test("10. Large Feature Deviation -> High Normalized Distance", () => {
    const ref = createMockDynamicSequence(6, 600);
    const user = createMockDynamicSequence(6, 600);
    // Completely wrong hand shape, angles, curls, orientation, and position in user
    user.frames.forEach((f) => {
      f.rightHand!.fingerAngles = {
        thumbMCP: 60,
        thumbIP: 60,
        indexMCP: 60,
        indexPIP: 60,
        middleMCP: 60,
        middlePIP: 60,
        ringMCP: 60,
        ringPIP: 60,
        pinkyMCP: 60,
        pinkyPIP: 60,
      };
      f.rightHand!.fingerCurls = { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1 };
      f.rightHand!.palmNormal = { x: 0, y: 0, z: -1 };
      f.rightHand!.handFacingVector = { x: 0, y: 1, z: 0 };
      f.rightHand!.posRelShoulderCenter = { x: 1.5, y: -1.5, z: 0 };
    });

    const result = computeDTW(ref, user);
    assert.ok(result.normalizedDistance > 0.25, `Got ${result.normalizedDistance}`);
  });

  await t.test("11. Empty Sequence Handling -> Graceful Zero Distance", () => {
    const emptySeq: GestureFeatureSequence = { durationMs: 0, frameCount: 0, frames: [] };
    const ref = createMockDynamicSequence(5, 500);

    const result1 = computeDTW(ref, emptySeq);
    assert.equal(result1.distance, 0);
    assert.equal(result1.coverage, 0);

    const result2 = computeDTW(emptySeq, emptySeq);
    assert.equal(result2.distance, 0);
  });

  await t.test("12. Single-Frame Sequence -> Exact Matching", () => {
    const singleRef: GestureFeatureSequence = { durationMs: 100, frameCount: 1, frames: [createMockFrame(0)] };
    const singleUser: GestureFeatureSequence = { durationMs: 100, frameCount: 1, frames: [createMockFrame(0)] };

    const result = computeDTW(singleRef, singleUser);
    assert.equal(result.distance, 0);
    assert.equal(result.normalizedDistance, 0);
    assert.equal(result.alignedPairs.length, 1);
  });

  await t.test("13. Sakoe-Chiba Band Window Constraint Limits Search Space", () => {
    const ref = createMockDynamicSequence(15, 1500);
    const user = createMockDynamicSequence(15, 1500);

    // Narrow window ratio = 0.2
    const result = computeDTW(ref, user, { windowRatio: 0.2 });
    assert.equal(result.distance, 0);
    assert.equal(result.path.length, 15);
  });

  await t.test("14. Path Monotonicity and Boundary Verification", () => {
    const ref = createMockDynamicSequence(7, 700);
    const user = createMockDynamicSequence(11, 1100);

    const result = computeDTW(ref, user);
    const path = result.path;

    // Boundary 1: Starts at (0, 0)
    assert.deepEqual(path[0], [0, 0]);
    // Boundary 2: Ends at (N-1, M-1)
    assert.deepEqual(path[path.length - 1], [6, 10]);

    // Monotonicity: for all steps, i_k >= i_{k-1} and j_k >= j_{k-1}
    for (let k = 1; k < path.length; k++) {
      assert.ok(path[k][0] >= path[k - 1][0], `i decreased at step ${k}`);
      assert.ok(path[k][1] >= path[k - 1][1], `j decreased at step ${k}`);
      // Continuity: max step size is 1
      assert.ok(path[k][0] - path[k - 1][0] <= 1);
      assert.ok(path[k][1] - path[k - 1][1] <= 1);
    }
  });

  await t.test("15. Normalized Distance Consistency", () => {
    const frameA = createMockFrame(0);
    const frameB = createMockFrame(0, {
      rightHand: createMockHand("Right", {
        fingerAngles: createMockFingerAngles({ indexMCP: 140 }),
      }),
    });

    const distDirect = calculateFrameDistance(frameA, frameB);

    // Repeat 5 times
    const seqA: GestureFeatureSequence = { durationMs: 500, frameCount: 5, frames: Array(5).fill(frameA) };
    const seqB: GestureFeatureSequence = { durationMs: 500, frameCount: 5, frames: Array(5).fill(frameB) };

    const result = computeDTW(seqA, seqB);
    assert.ok(Math.abs(result.normalizedDistance - distDirect) < 1e-4);
  });

  /* ==========================================================================
     INTEGRATION TESTS (Reference -> DTW -> Scoring)
     ========================================================================== */

  await t.test("16. Integration: Reference -> DTW -> scoreGesture (Identical Dynamic Gesture)", () => {
    const ref = createMockDynamicSequence(8, 1200);
    const user = createMockDynamicSequence(8, 1200);

    const scoreResult = scoreGesture(ref, user, { gestureType: "dynamic", includePerFrameScores: true });

    assert.ok(scoreResult.overallScore >= 95, `Expected >= 95, got ${scoreResult.overallScore}`);
    assert.ok(scoreResult.confidence >= 0.9);
    assert.ok(scoreResult.perFrameScores && scoreResult.perFrameScores.length === 8);
    assert.equal(scoreResult.feedback.filter((f) => f.severity === "error").length, 0);
  });

  await t.test("17. Integration: Reference -> DTW -> scoreGesture (Temporally Warped Dynamic Gesture)", () => {
    const ref = createMockDynamicSequence(6, 1000);
    // User does the exact same motion but stretched over 12 frames at slower pace
    const user = createMockDynamicSequence(12, 2200);

    const scoreResult = scoreGesture(ref, user, { gestureType: "dynamic", includePerFrameScores: true });

    // Despite 2x duration & different frame counts, DTW aligns the trajectory accurately:
    assert.ok(scoreResult.overallScore >= 90, `Expected >= 90, got ${scoreResult.overallScore}`);
    assert.ok(scoreResult.feedback.some((f) => f.message.includes("ช้ากว่า")));
  });
});
