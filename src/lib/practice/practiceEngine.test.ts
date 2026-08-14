import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePracticeFrames } from "./practiceEngine";
import { Lesson, ReferenceGesture, ReferenceFrame } from "@/types";

/* ==========================================================================
   MOCK GENERATOR HELPERS
   ========================================================================== */

const mockLesson: Lesson = {
  id: "hello",
  categoryId: "greeting-basic",
  word: "สวัสดี",
  description: "พนมมือระดับอกแล้วก้มศีรษะลงเล็กน้อย",
  gestureType: "dynamic",
  order: 1,
  difficulty: "beginner",
  isActive: true,
};

function createMockReferenceFrame(timestampMs = 100): ReferenceFrame {
  return {
    timestampMs,
    hands: [
      {
        handedness: "Right",
        landmarks: Array.from({ length: 21 }, (_, i) => ({
          x: 0.45 + (i % 5) * 0.01,
          y: 0.45 + Math.floor(i / 5) * 0.02,
          z: 0,
          visibility: 1.0,
        })),
      },
      {
        handedness: "Left",
        landmarks: Array.from({ length: 21 }, (_, i) => ({
          x: 0.55 - (i % 5) * 0.01,
          y: 0.45 + Math.floor(i / 5) * 0.02,
          z: 0,
          visibility: 1.0,
        })),
      },
    ],
    pose: Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 1.0,
    })),
  };
}

function createMockReferenceGesture(frameCount = 8, durationMs = 1000): ReferenceGesture {
  const frames: ReferenceFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const timestampMs = Math.round((i / (frameCount - 1 || 1)) * durationMs);
    frames.push(createMockReferenceFrame(timestampMs));
  }

  return {
    id: "ref_hello_test",
    lessonId: "hello",
    word: "สวัสดี",
    durationMs,
    frameCount: frames.length,
    frames,
    createdAt: new Date().toISOString(),
  };
}

/* ==========================================================================
   PRACTICE ENGINE UNIT TESTS
   ========================================================================== */

test("Practice Engine Integration Tests", async (t) => {
  await t.test("1. Successfully Evaluates Normal Practice Session with High Score", () => {
    const ref = createMockReferenceGesture(6, 1000);
    const userFrames = ref.frames.map((f) => ({ ...f }));

    const result = evaluatePracticeFrames(mockLesson, ref, userFrames);
    assert.ok(result.score);
    assert.ok(result.score.overallScore >= 90, `Got ${result.score.overallScore}`);
    assert.ok(result.score.confidence >= 0.8);
    assert.ok(result.userSequence.frameCount === 6);
    assert.ok(result.referenceSequence.frameCount === 6);
  });

  await t.test("2. Throws Descriptive Error When User Frames Count < 3", () => {
    const ref = createMockReferenceGesture(6, 1000);
    const shortUserFrames = [createMockReferenceFrame(0)];

    assert.throws(
      () => evaluatePracticeFrames(mockLesson, ref, shortUserFrames),
      /จำนวนเฟรมที่บันทึกได้น้อยเกินไป/
    );
  });

  await t.test("3. Throws Error When Reference Gesture is Empty", () => {
    const emptyRef: ReferenceGesture = {
      id: "empty",
      lessonId: "hello",
      word: "สวัสดี",
      durationMs: 0,
      frameCount: 0,
      frames: [],
      createdAt: new Date().toISOString(),
    };

    assert.throws(
      () => evaluatePracticeFrames(mockLesson, emptyRef, [createMockReferenceFrame(0), createMockReferenceFrame(100), createMockReferenceFrame(200)]),
      /ไม่พบข้อมูล Reference Gesture/
    );
  });

  await t.test("4. Integrates DTW for Dynamic Sign with Different Frame Lengths", () => {
    const ref = createMockReferenceGesture(6, 1000);
    // User does motion slower with 12 frames
    const userFrames: ReferenceFrame[] = [];
    for (let i = 0; i < 12; i++) {
      userFrames.push(createMockReferenceFrame(i * 150));
    }

    const result = evaluatePracticeFrames(mockLesson, ref, userFrames);
    assert.ok(result.score.overallScore >= 80);
    assert.ok(result.score.matchedFrames >= 6);
  });
});
