import assert from "node:assert/strict";
import test from "node:test";
import {
  scoreGesture,
  compareSingleFrame,
  compareFingerAngles,
  compareFingerCurls,
  comparePalmOrientation,
  compareHandPosition,
  compareTwoHandRelationship,
} from "./scoring";
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

function createMockSequence(
  frameCount = 5,
  durationMs = 1000,
  frameModifier?: (index: number) => Partial<GestureFeatureFrame>
): GestureFeatureSequence {
  const frames: GestureFeatureFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const timestampMs = Math.round((i / (frameCount - 1 || 1)) * durationMs);
    const mod = frameModifier ? frameModifier(i) : {};
    frames.push(createMockFrame(timestampMs, mod));
  }
  return {
    durationMs,
    frameCount: frames.length,
    frames,
  };
}

/* ==========================================================================
   SCORING ENGINE UNIT TESTS
   ========================================================================== */

test("Gesture Scoring Engine Unit Tests", async (t) => {
  await t.test("1. Reference = User (Identical Gestures) -> Score >= 95", () => {
    const ref = createMockSequence(5, 1000);
    const user = createMockSequence(5, 1000);

    const result = scoreGesture(ref, user);
    assert.ok(result.overallScore >= 95, `Expected >= 95, got ${result.overallScore}`);
    assert.ok(result.confidence >= 0.9);
    assert.equal(result.feedback.filter((f) => f.severity === "error").length, 0);
  });

  await t.test("2. Small Deviations -> High Score (80-95)", () => {
    const ref = createMockSequence(5, 1000);
    // User hand slightly shifted (small deviations across angle, curl, and position)
    const user = createMockSequence(5, 1000, () => ({
      rightHand: createMockHand("Right", {
        fingerAngles: createMockFingerAngles({ indexPIP: 140, middlePIP: 140 }),
        fingerCurls: createMockFingerCurls({ index: 0.35, middle: 0.35 }),
        posRelShoulderCenter: { x: -0.2, y: 0.35, z: 0 },
      }),
    }));

    const result = scoreGesture(ref, user);
    assert.ok(result.overallScore >= 80 && result.overallScore <= 95, `Got ${result.overallScore}`);
  });

  await t.test("3. Large Deviations -> Low Score (< 50)", () => {
    const ref = createMockSequence(5, 1000);
    // User completely different in both hands, palm orientation, and position
    const user = createMockSequence(5, 1000, () => ({
      rightHand: createMockHand("Right", {
        fingerAngles: createMockFingerAngles({
          thumbMCP: 60,
          indexMCP: 60,
          indexPIP: 60,
          middleMCP: 60,
          middlePIP: 60,
          ringMCP: 60,
          ringPIP: 60,
          pinkyMCP: 60,
          pinkyPIP: 60,
        }),
        fingerCurls: { thumb: 1.0, index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 },
        palmNormal: { x: 0, y: 1, z: 0 },
        handFacingVector: { x: 0, y: 1, z: 0 },
        posRelShoulderCenter: { x: 2.0, y: -2.0, z: 0 },
      }),
      leftHand: createMockHand("Left", {
        fingerCurls: { thumb: 1.0, index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 },
        posRelShoulderCenter: { x: -2.0, y: 2.0, z: 0 },
      }),
      twoHand: createMockTwoHand({ wristDistance: 2.5, symmetryScore: 0.1 }),
    }));

    const result = scoreGesture(ref, user);
    assert.ok(result.overallScore < 50, `Expected < 50, got ${result.overallScore}`);
    assert.ok(result.feedback.length > 0);
  });

  await t.test("4. Finger Curl Differences -> Curl Score Drops & Feedback Generated", () => {
    const refCurls = { thumb: 0.0, index: 0.0, middle: 0.0, ring: 0.0, pinky: 0.0 };
    const userCurls = { thumb: 0.9, index: 0.95, middle: 0.95, ring: 0.95, pinky: 0.95 }; // Full fist vs flat hand

    const res = compareFingerCurls(refCurls, userCurls);
    assert.ok(res.score < 20);
    assert.ok(res.feedback.some((f) => f.message.includes("งอมากเกินไป")));
  });

  await t.test("5. Finger Angle Differences -> Angle Score Drops & Feedback Generated", () => {
    const refAngles = createMockFingerAngles({
      indexMCP: 180,
      indexPIP: 180,
      middleMCP: 180,
      middlePIP: 180,
      ringMCP: 180,
      ringPIP: 180,
    });
    const userAngles = createMockFingerAngles({
      indexMCP: 80,
      indexPIP: 80,
      middleMCP: 80,
      middlePIP: 80,
      ringMCP: 80,
      ringPIP: 80,
    });

    const res = compareFingerAngles(refAngles, userAngles);
    assert.ok(res.score < 50);
    assert.ok(res.feedback.some((f) => f.category === "fingerAngle"));
  });

  await t.test("6. Palm Orientation Differences -> Orientation Score Drops & Feedback", () => {
    const refHand = createMockHand("Right", {
      palmNormal: { x: 0, y: 0, z: 1 },
      handFacingVector: { x: 0, y: -1, z: 0 },
    });
    const userHand = createMockHand("Right", {
      palmNormal: { x: 0, y: 0, z: -1 }, // 180 deg opposite normal
      handFacingVector: { x: 0, y: 1, z: 0 }, // 180 deg opposite facing
    });

    const res = comparePalmOrientation(refHand, userHand);
    assert.ok(res.score < 20);
    assert.ok(res.feedback.some((f) => f.category === "palmOrientation"));
  });

  await t.test("7. Hand Position Differences -> Position Score Drops & Feedback", () => {
    const refHand = createMockHand("Right", {
      posRelShoulderCenter: { x: 0, y: 0.2, z: 0 },
    });
    const userHand = createMockHand("Right", {
      posRelShoulderCenter: { x: 0, y: -0.6, z: 0 }, // Hand held much too high
    });

    const res = compareHandPosition(refHand, userHand);
    assert.ok(res.score < 50);
    assert.ok(res.feedback.some((f) => f.message.includes("สูงกว่าตัวอย่าง")));
  });

  await t.test("8. Two-Hand Relationship Differences -> Score Drops & Symmetry Feedback", () => {
    const refTwoHand = createMockTwoHand({ wristDistance: 0.3, symmetryScore: 0.95 });
    const userTwoHand = createMockTwoHand({ wristDistance: 1.2, symmetryScore: 0.2 });

    const res = compareTwoHandRelationship(refTwoHand, userTwoHand);
    assert.ok(res.score < 50);
    assert.ok(res.feedback.some((f) => f.category === "twoHand"));
  });

  await t.test("9. Missing Left Hand when Reference Has 2 Hands -> Error & Score Drop", () => {
    const refFrame = createMockFrame(100, {
      leftHand: createMockHand("Left"),
      rightHand: createMockHand("Right"),
      twoHand: createMockTwoHand({ bothHandsDetected: true }),
    });
    const userFrame = createMockFrame(100, {
      leftHand: null, // Left hand not detected
      rightHand: createMockHand("Right"),
      twoHand: { bothHandsDetected: false, wristDistance: null, palmDistance: null, heightDifference: null, horizontalDifference: null, depthDifference: null, symmetryScore: null },
    });

    const res = compareSingleFrame(refFrame, userFrame, { requiresBothHands: true });
    assert.ok(res.breakdown.twoHand.score === 0);
    assert.ok(res.feedback.some((f) => f.message.includes("ต้องใช้ 2 มือ")));
  });

  await t.test("10. Missing Right Hand -> Coverage Feedback Generated", () => {
    const refFrame = createMockFrame(100);
    const userFrame = createMockFrame(100, { rightHand: null });

    const res = compareSingleFrame(refFrame, userFrame);
    assert.ok(res.feedback.some((f) => f.category === "coverage"));
  });

  await t.test("11. Missing Pose -> Graceful Fallback Without Crashing", () => {
    const ref = createMockSequence(3, 500);
    const user = createMockSequence(3, 500, () => ({
      head: null,
      body: null,
    }));

    const result = scoreGesture(ref, user);
    assert.ok(result.overallScore > 0);
    assert.ok(result.bodyContextScore === 100); // fallback gives neutral score
    assert.ok(result.confidence < 1.0); // confidence reflects missing body context
  });

  await t.test("12. Dynamic Sequence Scoring -> Aggregates Frames & Respects Resampling", () => {
    const ref = createMockSequence(10, 2000);
    const user = createMockSequence(5, 1000); // user has fewer frames (resampling tested)

    const result = scoreGesture(ref, user, { gestureType: "dynamic", includePerFrameScores: true });
    assert.equal(result.matchedFrames, 10);
    assert.ok(result.perFrameScores && result.perFrameScores.length === 10);
    assert.ok(result.overallScore >= 90);
  });

  await t.test("13. Confidence Decreases when Data is Missing", () => {
    const ref = createMockSequence(5, 1000);
    const fullUser = createMockSequence(5, 1000);
    const partialUser = createMockSequence(5, 1000, () => ({
      leftHand: null,
      head: null,
    }));

    const fullResult = scoreGesture(ref, fullUser);
    const partialResult = scoreGesture(ref, partialUser);

    assert.ok(
      partialResult.confidence < fullResult.confidence,
      `Partial: ${partialResult.confidence}, Full: ${fullResult.confidence}`
    );
  });

  await t.test("14. Feedback Identifies Exact Faulty Features", () => {
    const ref = createMockSequence(3, 500);
    const user = createMockSequence(3, 500, () => ({
      rightHand: createMockHand("Right", {
        fingerCurls: createMockFingerCurls({ pinky: 0.95 }), // only pinky curled
      }),
    }));

    const result = scoreGesture(ref, user);
    assert.ok(result.feedback.some((f) => f.message.includes("นิ้วก้อย")));
    assert.ok(!result.feedback.some((f) => f.message.includes("นิ้วโป้ง")));
  });
});
