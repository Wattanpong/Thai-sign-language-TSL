import assert from "node:assert/strict";
import test from "node:test";
import {
  addReference,
  getReferencesByLessonId,
  getBestReferenceByLessonId,
  deleteReference,
  setPrimaryReference,
  clearReferences,
  countReferences,
} from "@/lib/storage/referenceStorage";
import { rankReferences, filterUsableReferences } from "./referenceRanking";
import { evaluatePracticeFrames } from "@/lib/practice/practiceEngine";
import { createSyntheticGesture } from "@/lib/gesture/scoringCalibration";
import { ReferenceGesture, Lesson } from "@/types";

const mockLesson: Lesson = {
  id: "test_multi_ref",
  categoryId: "test-cat",
  word: "ทดสอบ",
  description: "ท่าทางสำหรับทดสอบ Multi-Reference",
  gestureType: "dynamic",
  order: 99,
};

test("STEP 7D — Multi-Reference Dataset & Storage Tests", async (t) => {
  // Clear any existing test data
  await clearReferences("test_multi_ref");

  await t.test("A. Add Reference -> Stores and sets first reference as primary", async () => {
    const rawRef = createSyntheticGesture(25, 1000, "both");
    const ref1: ReferenceGesture = {
      ...rawRef,
      id: "ref_test_01",
      lessonId: "test_multi_ref",
      word: "ทดสอบ",
      qualityScore: 95,
      qualityLevel: "good",
      metadata: { source: "recorded", label: "ตัวอย่างที่ 1" },
    };

    await addReference(ref1);
    const count = await countReferences("test_multi_ref");
    assert.strictEqual(count, 1);

    const best = await getBestReferenceByLessonId("test_multi_ref");
    assert.ok(best);
    assert.strictEqual(best.id, "ref_test_01");
    assert.strictEqual(best.isPrimary, true);
  });

  await t.test("B. Get References -> Retrieves full ranked set", async () => {
    const rawRef2 = createSyntheticGesture(25, 1000, "both");
    const ref2: ReferenceGesture = {
      ...rawRef2,
      id: "ref_test_02",
      lessonId: "test_multi_ref",
      word: "ทดสอบ",
      qualityScore: 88,
      qualityLevel: "good",
      metadata: { source: "recorded", label: "ตัวอย่างที่ 2" },
    };

    await addReference(ref2);
    const allRefs = await getReferencesByLessonId("test_multi_ref");
    assert.strictEqual(allRefs.length, 2);
    // Primary ref should be ranked first
    assert.strictEqual(allRefs[0].id, "ref_test_01");
  });

  await t.test("C. Set Primary Reference & Ranking updates", async () => {
    await setPrimaryReference("test_multi_ref", "ref_test_02");
    const best = await getBestReferenceByLessonId("test_multi_ref");
    assert.ok(best);
    assert.strictEqual(best.id, "ref_test_02");
    assert.strictEqual(best.isPrimary, true);
  });

  await t.test("D. Delete Reference -> Removes reference and auto-promotes remaining", async () => {
    await deleteReference("ref_test_02");
    const count = await countReferences("test_multi_ref");
    assert.strictEqual(count, 1);

    const remaining = await getBestReferenceByLessonId("test_multi_ref");
    assert.ok(remaining);
    assert.strictEqual(remaining.id, "ref_test_01");
    assert.strictEqual(remaining.isPrimary, true);
  });

  await t.test("E. Reference Ranking Logic Unit Test", () => {
    const refs: ReferenceGesture[] = [
      {
        id: "r1",
        lessonId: "mock",
        word: "word",
        createdAt: "2026-01-01T00:00:00Z",
        durationMs: 1000,
        frameCount: 20,
        frames: [],
        qualityScore: 70,
        isPrimary: false,
      },
      {
        id: "r2",
        lessonId: "mock",
        word: "word",
        createdAt: "2026-01-02T00:00:00Z",
        durationMs: 1000,
        frameCount: 20,
        frames: [],
        qualityScore: 92,
        isPrimary: false,
      },
      {
        id: "r3",
        lessonId: "mock",
        word: "word",
        createdAt: "2026-01-01T00:00:00Z",
        durationMs: 1000,
        frameCount: 20,
        frames: [],
        qualityScore: 80,
        isPrimary: true,
      },
    ];

    const ranked = rankReferences(refs);
    // r3 is primary -> must be first
    assert.strictEqual(ranked[0].id, "r3");
    // r2 has higher quality score (92 > 70) -> must be second
    assert.strictEqual(ranked[1].id, "r2");
    assert.strictEqual(ranked[2].id, "r1");
  });

  await t.test("F. Quality Filtering Logic (filters score < 40)", () => {
    const refs: ReferenceGesture[] = [
      {
        id: "good",
        lessonId: "mock",
        word: "word",
        createdAt: "2026-01-01T00:00:00Z",
        durationMs: 1000,
        frameCount: 20,
        frames: [],
        qualityScore: 90,
      },
      {
        id: "poor",
        lessonId: "mock",
        word: "word",
        createdAt: "2026-01-01T00:00:00Z",
        durationMs: 1000,
        frameCount: 20,
        frames: [],
        qualityScore: 25,
      },
    ];

    const usable = filterUsableReferences(refs, 40);
    assert.strictEqual(usable.length, 1);
    assert.strictEqual(usable[0].id, "good");
  });

  await t.test("G. Multi-Reference Practice Evaluation Workflow", () => {
    const rawRefA = createSyntheticGesture(25, 1000, "both", { angleOffsetDeg: 0 });
    const refA: ReferenceGesture = {
      ...rawRefA,
      id: "ref_A",
      lessonId: mockLesson.id,
      qualityScore: 95,
      isPrimary: true,
    };

    const rawRefB = createSyntheticGesture(25, 1000, "both", { angleOffsetDeg: 15 });
    const refB: ReferenceGesture = {
      ...rawRefB,
      id: "ref_B",
      lessonId: mockLesson.id,
      qualityScore: 90,
      isPrimary: false,
    };

    // User performed gesture closer to Ref B
    const userGesture = createSyntheticGesture(25, 1000, "both", { angleOffsetDeg: 14 });

    const result = evaluatePracticeFrames(mockLesson, [refA, refB], userGesture.frames);
    assert.ok(result.score.overallScore >= 85);
    assert.strictEqual(result.totalReferencesEvaluated, 2);
    assert.ok(result.candidateEvaluations && result.candidateEvaluations.length === 2);
    assert.ok(result.matchedReference);
  });

  await t.test("H. Single Reference Compatibility (Backward Compatible)", () => {
    const singleRef = createSyntheticGesture(25, 1000, "both");
    const userGesture = createSyntheticGesture(25, 1000, "both");

    const result = evaluatePracticeFrames(mockLesson, singleRef, userGesture.frames);
    assert.ok(result.score.overallScore >= 95);
    assert.strictEqual(result.totalReferencesEvaluated, 1);
  });

  await t.test("I. Missing Reference / Empty frames error handling", () => {
    const emptyRef: ReferenceGesture = {
      id: "empty",
      lessonId: "mock",
      word: "test",
      durationMs: 0,
      frameCount: 0,
      frames: [],
      createdAt: new Date().toISOString(),
    };

    assert.throws(() => {
      evaluatePracticeFrames(mockLesson, emptyRef, []);
    });
  });

  // Clean up
  await clearReferences("test_multi_ref");
});
