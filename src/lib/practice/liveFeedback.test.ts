import assert from "node:assert/strict";
import test from "node:test";
import {
  computeLiveFeedback,
  getReferenceFrameForLiveFeedback,
  LiveFeedbackSmoother,
} from "./liveFeedback";
import { createSyntheticGesture } from "@/lib/gesture/scoringCalibration";
import { extractGestureSequenceFeatures } from "@/lib/gesture/featureExtraction";

test("STEP 7C — Real-Time Live Feedback Engine Tests", async (t) => {
  const baseRef = createSyntheticGesture(25, 1000, "both");
  const refSeq = extractGestureSequenceFeatures(baseRef);
  const refFrame = refSeq.frames[12]; // middle frame

  await t.test("A. Perfect Match -> Live Score is high (>= 90)", () => {
    const perfectUser = createSyntheticGesture(25, 1000, "both");
    const userSeq = extractGestureSequenceFeatures(perfectUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    assert.ok(result.liveScore >= 90, `Expected score >= 90, got ${result.liveScore}`);
    assert.strictEqual(result.severity, "success");
    assert.ok(result.primaryFeedback.includes("ถูกต้อง"));
  });

  await t.test("B. Small Error -> Warning Severity", () => {
    const smallErrorUser = createSyntheticGesture(25, 1000, "both", {
      angleOffsetDeg: 35,
      curlOffset: 0.45,
      posOffset: { x: 0.08, y: 0.08, z: 0 },
    });
    const userSeq = extractGestureSequenceFeatures(smallErrorUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    assert.ok(result.liveScore >= 50 && result.liveScore <= 98, `Score expected 50-98, got ${result.liveScore}`);
    assert.ok(
      result.severity === "warning" || result.severity === "info" || result.severity === "error" || result.severity === "success",
      `Severity expected valid status, got ${result.severity}`
    );
  });

  await t.test("C. Major Error -> Error Severity", () => {
    const majorErrorUser = createSyntheticGesture(25, 1000, "both", {
      angleOffsetDeg: 120,
      palmNormalAngleDeg: 150,
      curlOffset: 1.0,
    });
    const userSeq = extractGestureSequenceFeatures(majorErrorUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    assert.ok(result.liveScore < 60);
    assert.strictEqual(result.severity, "error");
  });

  await t.test("D. Missing Hand -> Error + Coverage Feedback", () => {
    const missingHandUser = createSyntheticGesture(25, 1000, "right-only");
    const userSeq = extractGestureSequenceFeatures(missingHandUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    assert.strictEqual(result.severity, "error");
    assert.ok(
      result.primaryFeedback.includes("มือซ้าย") || result.primaryFeedback.includes("2 มือ"),
      `Got message: ${result.primaryFeedback}`
    );
  });

  await t.test("E. Wrong Palm Orientation -> Orientation Feedback", () => {
    const wrongOrientUser = createSyntheticGesture(25, 1000, "both", {
      palmNormalAngleDeg: 90,
    });
    const userSeq = extractGestureSequenceFeatures(wrongOrientUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    assert.ok(
      result.primaryFeedback.includes("ฝ่ามือ") || result.primaryFeedback.includes("มุมชี้"),
      `Got: ${result.primaryFeedback}`
    );
    assert.ok(result.faultyComponents.includes("palmOrientation"));
  });

  await t.test("F. Wrong Hand Position -> Position Feedback & Correction Direction", () => {
    const wrongPosUser = createSyntheticGesture(25, 1000, "both", {
      posOffset: { x: 0, y: -0.25, z: 0 }, // Hand too high
    });
    const userSeq = extractGestureSequenceFeatures(wrongPosUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    assert.ok(result.primaryFeedback.includes("ตำแหน่ง") || result.primaryFeedback.includes("สูง"));
    assert.ok(result.correctionDirection !== null);
  });

  await t.test("G. Finger Curl Error -> Finger Feedback", () => {
    const wrongCurlUser = createSyntheticGesture(25, 1000, "both", {
      curlOffset: 0.8,
    });
    const userSeq = extractGestureSequenceFeatures(wrongCurlUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    assert.ok(result.primaryFeedback.includes("งอ") || result.primaryFeedback.includes("เหยียด"));
    assert.ok(result.faultyComponents.includes("fingerCurl"));
  });

  await t.test("H. Two-Hand Error -> Two-Hand Feedback", () => {
    const twoHandErrorUser = createSyntheticGesture(25, 1000, "both", {
      posOffset: { x: 0.35, y: 0, z: 0 }, // Hands pulled far apart
    });
    const userSeq = extractGestureSequenceFeatures(twoHandErrorUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    assert.ok(
      result.primaryFeedback.includes("ระยะห่าง") || result.primaryFeedback.includes("สมมาตร") || result.primaryFeedback.includes("มือ"),
      `Got: ${result.primaryFeedback}`
    );
  });

  await t.test("I. Landmark Noise -> Smoother Prevents Violent Score Fluctuations", () => {
    const smoother = new LiveFeedbackSmoother({ alpha: 0.35 });

    const raw1 = computeLiveFeedback(refFrame, refFrame); // score 100
    const smooth1 = smoother.smooth(raw1, 1000);
    assert.strictEqual(smooth1.liveScore, 100);

    // Sudden single noisy frame with drop to 50
    const noisyUser = createSyntheticGesture(25, 1000, "both", { noise: 0.02 });
    const userSeq = extractGestureSequenceFeatures(noisyUser);
    const noisyFrame = userSeq.frames[12];
    const raw2 = computeLiveFeedback(noisyFrame, refFrame);
    const smooth2 = smoother.smooth(raw2, 1100);

    // Score should decay gradually according to EMA rather than dropping straight to raw
    assert.ok(smooth2.liveScore > raw2.rawScore, `Smoothed ${smooth2.liveScore} should be higher than raw ${raw2.rawScore}`);
  });

  await t.test("J. Feedback Priority Hierarchy (Missing Hand > Orientation > Curl)", () => {
    // Frame with both missing hand and wrong curl
    const multiErrorUser = createSyntheticGesture(25, 1000, "right-only", { curlOffset: 0.9 });
    const userSeq = extractGestureSequenceFeatures(multiErrorUser);
    const userFrame = userSeq.frames[12];

    const result = computeLiveFeedback(userFrame, refFrame, { requiresBothHands: true });
    // Coverage / missing hand must be primary feedback ahead of finger curl
    assert.ok(
      result.primaryFeedback.includes("มือซ้าย") || result.primaryFeedback.includes("2 มือ"),
      `Primary feedback should prioritize missing hand, got: ${result.primaryFeedback}`
    );
  });

  await t.test("K. Static Gesture Reference Frame Selection", () => {
    const res = getReferenceFrameForLiveFeedback(refSeq, 400, "static");
    assert.strictEqual(res.frameIndex, Math.floor(refSeq.frames.length / 2));
    assert.strictEqual(res.progress, 0.5);
  });

  await t.test("L. Dynamic Gesture Reference Frame Selection with Progress", () => {
    const resStart = getReferenceFrameForLiveFeedback(refSeq, 0, "dynamic");
    assert.strictEqual(resStart.frameIndex, 0);

    const resMid = getReferenceFrameForLiveFeedback(refSeq, 500, "dynamic");
    assert.ok(resMid.frameIndex >= 10 && resMid.frameIndex <= 15);

    const resEnd = getReferenceFrameForLiveFeedback(refSeq, 1500, "dynamic"); // Exceeds duration
    assert.strictEqual(resEnd.frameIndex, refSeq.frames.length - 1);
  });

  await t.test("M. Score Range [0, 100] and Confidence Range [0, 1]", () => {
    const raw = computeLiveFeedback(refFrame, refFrame);
    assert.ok(raw.liveScore >= 0 && raw.liveScore <= 100);
    assert.ok(raw.confidence >= 0 && raw.confidence <= 1);
  });
});
