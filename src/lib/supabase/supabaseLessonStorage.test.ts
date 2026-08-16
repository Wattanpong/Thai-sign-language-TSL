import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonToRow,
  rowToLesson,
  fetchLessonsFromSupabase,
  upsertLessonToSupabase,
  deleteLessonFromSupabase,
  reconcileLessonsWithCloud,
  syncLessonsWithCloud,
} from "./supabaseLessonStorage";
import { Lesson } from "@/types";
import { getLessons } from "@/lib/storage/lessonStorage";

test("Supabase Lesson Database Storage Integration Test Suite", async (t) => {
  await t.test("1. lessonToRow and rowToLesson serialization", () => {
    const lesson: Lesson = {
      id: "lesson_test",
      categoryId: "greetings",
      word: "สวัสดี",
      description: "คำทักทาย",
      gestureType: "dynamic",
      difficulty: "beginner",
      order: 1,
      example: "ยกมือไหว้",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const row = lessonToRow(lesson);
    assert.equal(row.id, "lesson_test");
    assert.equal(row.category_id, "greetings");
    assert.equal(row.word, "สวัสดี");
    assert.equal(row.gesture_type, "dynamic");
    assert.equal(row.is_active, true);

    const backToLesson = rowToLesson(row as unknown as Record<string, unknown>);
    assert.equal(backToLesson.id, lesson.id);
    assert.equal(backToLesson.categoryId, lesson.categoryId);
    assert.equal(backToLesson.word, lesson.word);
    assert.equal(backToLesson.gestureType, "dynamic");
    assert.equal(backToLesson.isActive, true);
  });

  await t.test("2. Unconfigured environment handles fetch, upsert, and delete gracefully", async () => {
    const mockLesson: Lesson = {
      id: "lesson_unconf",
      categoryId: "greetings",
      word: "ทดสอบ",
      description: "คำอธิบายทดสอบ",
      gestureType: "dynamic",
      order: 1,
      isActive: true,
    };

    const fetchRes = await fetchLessonsFromSupabase();
    assert.ok(Array.isArray(fetchRes));

    const upsertRes = await upsertLessonToSupabase(mockLesson);
    assert.ok(typeof upsertRes.success === "boolean");

    const deleteRes = await deleteLessonFromSupabase("lesson_unconf");
    assert.ok(typeof deleteRes.success === "boolean");
  });

  await t.test("3. reconcileLessonsWithCloud identifies purged and new lessons", () => {
    const localLessons: Lesson[] = [
      { id: "l1", categoryId: "greetings", word: "สวัสดี", description: "สวัสดี", gestureType: "dynamic", order: 1, isActive: true },
      { id: "l2_stale", categoryId: "greetings", word: "ขอบคุณ", description: "ขอบคุณ", gestureType: "dynamic", order: 2, isActive: true },
    ];

    const cloudLessons: Lesson[] = [
      { id: "l1", categoryId: "greetings", word: "สวัสดี", description: "สวัสดี", gestureType: "dynamic", order: 1, isActive: true },
      { id: "l3_new", categoryId: "greetings", word: "ขอโทษ", description: "ขอโทษ", gestureType: "dynamic", order: 3, isActive: true },
    ];

    const { reconciled, purgedCount, downloadedCount } = reconcileLessonsWithCloud(
      localLessons,
      cloudLessons
    );

    assert.equal(purgedCount, 1, "Must detect 1 stale lesson (l2_stale)");
    assert.equal(downloadedCount, 1, "Must detect 1 new lesson (l3_new)");
    assert.equal(reconciled.length, 2);
    assert.ok(!reconciled.some((l) => l.id === "l2_stale"));
    assert.ok(reconciled.some((l) => l.id === "l1"));
    assert.ok(reconciled.some((l) => l.id === "l3_new"));
  });

  await t.test("4. syncLessonsWithCloud returns local lessons when offline", async () => {
    const localLessons: Lesson[] = [
      { id: "l_local", categoryId: "greetings", word: "Local", description: "Local", gestureType: "dynamic", order: 1, isActive: true },
    ];

    const syncRes = await syncLessonsWithCloud(localLessons);
    assert.ok(syncRes.allLessons.length >= 1);
  });

  await t.test("5. getLessons falls back to initial seed lessons", async () => {
    const lessons = await getLessons();
    assert.ok(lessons.length > 0, "Must return initial lessons");
    assert.ok(lessons.some((l) => l.id === "hello"));
  });
});
