import assert from "node:assert/strict";
import test from "node:test";
import { getLessons, getLessonById } from "@/data/lessons";
import { getReferenceGestureByLessonId } from "@/lib/storage/referenceStorage";
import { evaluatePracticeFrames } from "@/lib/practice/practiceEngine";
import { extractGestureSequenceFeatures } from "@/lib/gesture/featureExtraction";
import { computeDTW } from "@/lib/dtw/dtw";
import { scoreGesture } from "@/lib/gesture/scoring";
import { ReferenceFrame } from "@/types";

function createSimulatedUserFramesFromRef(
  ref: { frames: ReferenceFrame[] },
  count: number,
  durationMs: number,
  offsetScale = 0
): ReferenceFrame[] {
  const frames: ReferenceFrame[] = [];
  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1 || 1);
    const timestampMs = Math.round(progress * durationMs);

    const refIndex = Math.min(
      ref.frames.length - 1,
      Math.floor(progress * (ref.frames.length - 1))
    );
    const baseFrame = ref.frames[refIndex];

    frames.push({
      timestampMs,
      hands: baseFrame.hands.map((h) => ({
        handedness: h.handedness,
        landmarks: h.landmarks.map((l) => ({
          x: l.x + offsetScale * 0.005,
          y: l.y + offsetScale * 0.005,
          z: l.z,
          visibility: l.visibility,
        })),
      })),
      pose: baseFrame.pose.map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z,
        visibility: p.visibility,
      })),
    });
  }

  return frames;
}

test("STEP 7A — End-to-End Practice System Validation", async (t) => {
  await t.test("1. Lessons are loaded properly with real data", async () => {
    const lessons = await getLessons();
    assert.ok(lessons.length > 0, "Lessons array must not be empty");

    const helloLesson = await getLessonById("hello");
    assert.ok(helloLesson, "Hello lesson must exist");
    assert.strictEqual(helloLesson.word, "สวัสดี");
    assert.strictEqual(helloLesson.gestureType, "dynamic");
  });

  await t.test("2. Reference Gesture is retrieved from storage / seed fallback", async () => {
    const ref = await getReferenceGestureByLessonId("hello");
    assert.ok(ref, "Reference Gesture for 'hello' must not be null");
    assert.strictEqual(ref.lessonId, "hello");
    assert.strictEqual(ref.word, "สวัสดี");
    assert.ok(ref.frames.length > 0, "Reference frames must not be empty");
    assert.ok(ref.durationMs > 0, "Duration must be positive");

    // Check monotonic timestamps in reference
    for (let i = 1; i < ref.frames.length; i++) {
      assert.ok(
        ref.frames[i].timestampMs >= ref.frames[i - 1].timestampMs,
        `Reference frame ${i} timestamp (${ref.frames[i].timestampMs}) must be >= previous frame (${ref.frames[i - 1].timestampMs})`
      );
    }
  });

  await t.test("3. Feature Extraction on Reference and User Sequences", async () => {
    const ref = await getReferenceGestureByLessonId("hello");
    assert.ok(ref);

    const refSeq = extractGestureSequenceFeatures(ref);
    assert.ok(refSeq.frames.length > 0);
    assert.strictEqual(refSeq.lessonId, "hello");

    const userFrames = createSimulatedUserFramesFromRef(ref, 20, 1000);
    const userGesture = {
      id: "user_test_e2e",
      lessonId: "hello",
      word: "สวัสดี",
      durationMs: 1000,
      frameCount: userFrames.length,
      frames: userFrames,
      createdAt: new Date().toISOString(),
    };

    const userSeq = extractGestureSequenceFeatures(userGesture);
    assert.strictEqual(userSeq.frameCount, 20);
    assert.ok(userSeq.frames.every((f) => Number.isFinite(f.timestampMs)));
  });

  await t.test("4. DTW Sequence Alignment Validation (No NaN, No Infinity)", async () => {
    const ref = await getReferenceGestureByLessonId("hello");
    assert.ok(ref);

    const refSeq = extractGestureSequenceFeatures(ref);
    const userFrames = createSimulatedUserFramesFromRef(ref, 18, 900, 1);
    const userGesture = {
      id: "user_dtw_test",
      lessonId: "hello",
      word: "สวัสดี",
      durationMs: 900,
      frameCount: userFrames.length,
      frames: userFrames,
      createdAt: new Date().toISOString(),
    };
    const userSeq = extractGestureSequenceFeatures(userGesture);

    const dtwResult = computeDTW(refSeq, userSeq);
    assert.ok(Number.isFinite(dtwResult.distance), `DTW distance must be finite, got ${dtwResult.distance}`);
    assert.ok(Number.isFinite(dtwResult.normalizedDistance), `Normalized distance must be finite`);
    assert.ok(!Number.isNaN(dtwResult.normalizedDistance), `Normalized distance must not be NaN`);
    assert.ok(dtwResult.path.length > 0, `DTW path must not be empty`);
    assert.ok(dtwResult.matches.length > 0, `DTW matches must not be empty`);
  });

  await t.test("5. Gesture Scoring Engine Validation (0-100 Score, 0-1 Confidence, Feedback)", async () => {
    const ref = await getReferenceGestureByLessonId("hello");
    assert.ok(ref);
    const lesson = (await getLessonById("hello"))!;

    const refSeq = extractGestureSequenceFeatures(ref);
    const userFrames = createSimulatedUserFramesFromRef(ref, 25, 1000);
    const userGesture = {
      id: "user_score_test",
      lessonId: "hello",
      word: "สวัสดี",
      durationMs: 1000,
      frameCount: userFrames.length,
      frames: userFrames,
      createdAt: new Date().toISOString(),
    };
    const userSeq = extractGestureSequenceFeatures(userGesture);

    const score = scoreGesture(refSeq, userSeq, {
      gestureType: lesson.gestureType,
      requiresBothHands: true,
    });

    assert.ok(score.overallScore >= 0 && score.overallScore <= 100, `Score out of range: ${score.overallScore}`);
    assert.ok(score.confidence >= 0 && score.confidence <= 1, `Confidence out of range: ${score.confidence}`);
    assert.ok(score.handShapeScore >= 0 && score.handShapeScore <= 100);
    assert.ok(score.fingerAngleScore >= 0 && score.fingerAngleScore <= 100);
    assert.ok(score.fingerCurlScore >= 0 && score.fingerCurlScore <= 100);
    assert.ok(score.palmOrientationScore >= 0 && score.palmOrientationScore <= 100);
    assert.ok(score.handPositionScore >= 0 && score.handPositionScore <= 100);
    assert.ok(score.twoHandScore >= 0 && score.twoHandScore <= 100);
    assert.ok(score.bodyContextScore >= 0 && score.bodyContextScore <= 100);
    assert.ok(Array.isArray(score.feedback));
  });

  await t.test("6. Full Practice Engine Evaluation Workflow (E2E Integration)", async () => {
    const lesson = (await getLessonById("hello"))!;
    const ref = (await getReferenceGestureByLessonId("hello"))!;
    const userFrames = createSimulatedUserFramesFromRef(ref, 30, 1200);

    const evaluation = evaluatePracticeFrames(lesson, ref, userFrames);
    assert.ok(evaluation.score);
    assert.strictEqual(evaluation.userSequence.frameCount, 30);
    assert.ok(evaluation.score.overallScore >= 85, `Overall score should be high for good gesture: ${evaluation.score.overallScore}`);
    assert.ok(evaluation.score.matchedFrames >= 20);
  });

  await t.test("7. Real-Time Live Feedback Stream alongside Final DTW Evaluation (STEP 7C)", async () => {
    const ref = await getReferenceGestureByLessonId("hello");
    assert.ok(ref);
    const lesson = (await getLessonById("hello"))!;

    const refSeq = extractGestureSequenceFeatures(ref);
    const userFrames = createSimulatedUserFramesFromRef(ref, 25, 1000, 1);

    // Simulate real-time live feedback loop during practice
    const liveResults = [];
    const smoother = new (await import("./liveFeedback")).LiveFeedbackSmoother({ alpha: 0.35 });

    for (let i = 0; i < userFrames.length; i++) {
      const uFrame = userFrames[i];
      const userFeatureFrame = (await import("@/lib/gesture/featureExtraction")).extractFrameFeatures(uFrame);

      const target = (await import("./liveFeedback")).getReferenceFrameForLiveFeedback(
        refSeq,
        uFrame.timestampMs,
        lesson.gestureType
      );

      const rawLive = (await import("./liveFeedback")).computeLiveFeedback(
        userFeatureFrame,
        target.refFrame,
        {
          gestureType: lesson.gestureType,
          requiresBothHands: refSeq.frames.some((f) => f.leftHand?.detected && f.rightHand?.detected),
          targetRefFrameIndex: target.frameIndex,
          gestureProgress: target.progress,
        }
      );

      const smoothed = smoother.smooth(rawLive, uFrame.timestampMs);
      liveResults.push(smoothed);

      assert.ok(smoothed.liveScore >= 0 && smoothed.liveScore <= 100);
      assert.ok(smoothed.confidence >= 0 && smoothed.confidence <= 1);
      assert.ok(typeof smoothed.primaryFeedback === "string" && smoothed.primaryFeedback.length > 0);
    }

    assert.strictEqual(liveResults.length, 25);

    // Stop and evaluate with DTW
    const finalResult = evaluatePracticeFrames(lesson, ref, userFrames);
    assert.ok(finalResult.score.overallScore >= 80, `Final score was ${finalResult.score.overallScore}`);
    assert.ok(finalResult.score.matchedFrames >= 20);
  });
});
