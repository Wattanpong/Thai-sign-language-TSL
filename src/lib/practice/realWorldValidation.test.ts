import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePracticeFrames } from "@/lib/practice/practiceEngine";
import { detectScoreAnomalies } from "@/lib/practice/scoreAnomalyDetector";
import { createSyntheticGesture } from "@/lib/gesture/scoringCalibration";
import { getReferenceGestureByLessonId } from "@/lib/storage/referenceStorage";
import { getLessonById } from "@/data/lessons";
import { ReferenceGesture, Lesson } from "@/types";

test("STEP 7E — Real-World User Testing & Score Validation Suite", async (t) => {
  const lesson = (await getLessonById("hello")) as Lesson;
  const canonicalRef = (await getReferenceGestureByLessonId("hello")) as ReferenceGesture;
  assert.ok(lesson, "Hello lesson must exist");
  assert.ok(canonicalRef, "Canonical hello reference gesture must exist");

  await t.test("Scenario A: Correct Gesture (Normal Thai Wai / สวัสดี)", () => {
    // Exact canonical gesture with natural minor variation
    const userGesture = createSyntheticGesture(25, 1000, "both", {
      angleOffsetDeg: 2,
      curlOffset: 0.02,
      posOffset: { x: 0.01, y: 0.01, z: 0 },
    });

    const result = evaluatePracticeFrames(lesson, canonicalRef, userGesture.frames);
    const anomaly = detectScoreAnomalies(result, "correct");

    assert.ok(result.score.overallScore >= 85, `Expected score >= 85, got ${result.score.overallScore}`);
    assert.ok(result.score.confidence >= 0.8, `Expected confidence >= 0.8, got ${result.score.confidence}`);
    assert.strictEqual(anomaly.verdict, "VALID", "Correct gesture should have VALID verdict");
    assert.strictEqual(anomaly.criticalCount, 0, "Correct gesture must have 0 critical anomalies");
  });

  await t.test("Scenario B: Slower Gesture (Extended Wai / User performs slower)", () => {
    // 35 frames (1400ms) vs 25 frames reference
    const userGesture = createSyntheticGesture(35, 1400, "both", {
      angleOffsetDeg: 3,
      curlOffset: 0.03,
    });

    const result = evaluatePracticeFrames(lesson, canonicalRef, userGesture.frames);
    const anomaly = detectScoreAnomalies(result);

    assert.ok(result.score.overallScore >= 80, `Expected score >= 80 for slower gesture, got ${result.score.overallScore}`);
    assert.ok(result.score.matchedFrames >= 20, "DTW should align majority of slower frames");
    assert.strictEqual(anomaly.verdict, "VALID");
  });

  await t.test("Scenario C: Faster Gesture (Rapid motion / User finishes quickly)", () => {
    // 16 frames (640ms) vs 25 frames reference
    const userGesture = createSyntheticGesture(16, 640, "both", {
      angleOffsetDeg: 3,
      curlOffset: 0.03,
    });

    const result = evaluatePracticeFrames(lesson, canonicalRef, userGesture.frames);
    const anomaly = detectScoreAnomalies(result);

    assert.ok(result.score.overallScore >= 75, `Expected score >= 75 for faster gesture, got ${result.score.overallScore}`);
    assert.ok(result.score.matchedFrames >= 14, "DTW should compress sequence alignment");
    assert.strictEqual(anomaly.verdict, "VALID");
  });

  await t.test("Scenario D: Wrong Hand Position (Hands too low near waist)", () => {
    const userGesture = createSyntheticGesture(25, 1000, "both", {
      posOffset: { x: 0, y: 0.25, z: 0 }, // 0.25 lower (waist level)
    });

    const result = evaluatePracticeFrames(lesson, canonicalRef, userGesture.frames);
    assert.ok(result.score.handPositionScore < 60, `Position score should drop, got ${result.score.handPositionScore}`);
    assert.ok(result.score.overallScore <= 85, `Overall score should be penalized for position error, got ${result.score.overallScore}`);
    assert.ok(result.score.feedback.some((f) => (typeof f === "string" ? f : f.message).includes("ระดับ") || (typeof f === "string" ? f : f.category) === "handPosition"));
  });

  await t.test("Scenario E: Wrong Hand Shape (Fingers curled into fist)", () => {
    const userGesture = createSyntheticGesture(25, 1000, "both", {
      curlOffset: 0.9, // Fingers heavily curled into fist
    });

    const result = evaluatePracticeFrames(lesson, canonicalRef, userGesture.frames);
    assert.ok(result.score.fingerCurlScore < 50, `Curl score should be low for fist, got ${result.score.fingerCurlScore}`);
    assert.ok(result.score.overallScore <= 85, `Overall score should drop for fist shape, got ${result.score.overallScore}`);
    assert.ok(result.score.feedback.some((f) => (typeof f === "string" ? f : f.message).includes("งอนิ้ว") || (typeof f === "string" ? f : f.category) === "fingerCurl"));
  });

  await t.test("Scenario F: Wrong Palm Orientation (Palms facing sideways)", () => {
    const userGesture = createSyntheticGesture(25, 1000, "both", {
      angleOffsetDeg: 45, // Palm rotation error
    });

    const result = evaluatePracticeFrames(lesson, canonicalRef, userGesture.frames);
    assert.ok(result.score.palmOrientationScore < 60, `Orientation score should drop, got ${result.score.palmOrientationScore}`);
    assert.ok(result.score.feedback.some((f) => (typeof f === "string" ? f : f.message).includes("ทิศทาง") || (typeof f === "string" ? f : f.category) === "palmOrientation"));
  });

  await t.test("Scenario G: Missing Hand (Only Right hand detected for 2-hand sign)", () => {
    const userGesture = createSyntheticGesture(25, 1000, "right-only"); // Only 1 hand

    const result = evaluatePracticeFrames(lesson, canonicalRef, userGesture.frames);
    const anomaly = detectScoreAnomalies(result);

    assert.ok(result.score.twoHandScore < 30, `Two hand score should be minimal, got ${result.score.twoHandScore}`);
    assert.ok(result.score.overallScore < 50, `Overall score must fail for missing hand, got ${result.score.overallScore}`);
    assert.ok(result.score.feedback.some((f) => (typeof f === "string" ? f : f.message).includes("ไม่พบมือ") || (typeof f === "string" ? f : f.category) === "coverage" || (typeof f === "string" ? f : f.category) === "twoHand"));
    assert.strictEqual(anomaly.criticalCount, 0, "Expected missing hand penalty to be properly applied");
  });

  await t.test("Scenario H: Completely Wrong Gesture (Arms flailing / Random motion)", () => {
    const userGesture = createSyntheticGesture(25, 1000, "left-only", {
      angleOffsetDeg: 80,
      curlOffset: 0.9,
      posOffset: { x: 0.3, y: 0.3, z: 0.2 },
    });

    const result = evaluatePracticeFrames(lesson, canonicalRef, userGesture.frames);
    const anomaly = detectScoreAnomalies(result, "wrong_gesture");

    assert.ok(result.score.overallScore <= 40, `Wrong gesture score must be <= 40, got ${result.score.overallScore}`);
    assert.strictEqual(anomaly.criticalCount, 0, "Should not produce false positive anomaly");
  });

  await t.test("Score Anomaly Detector: Catches False Positive Anomaly", () => {
    const singleHandUser = createSyntheticGesture(25, 1000, "right-only");
    const evaluated = evaluatePracticeFrames(lesson, canonicalRef, singleHandUser.frames);

    // Artificially elevate overallScore to simulate a corrupted engine
    const fraudulentResult = {
      ...evaluated,
      score: {
        ...evaluated.score,
        overallScore: 92,
      },
    };

    const anomaly = detectScoreAnomalies(fraudulentResult);
    assert.ok(anomaly.hasAnomaly);
    assert.strictEqual(anomaly.verdict, "INVALID");
    assert.ok(anomaly.anomalies.some((a) => a.code === "FALSE_POSITIVE_MISSING_HAND"));
  });
});
