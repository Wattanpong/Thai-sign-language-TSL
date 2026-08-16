import assert from "node:assert/strict";
import test from "node:test";
import {
  getReferenceStoragePath,
  uploadReferenceToSupabase,
  fetchReferencesFromSupabase,
  deleteReferenceFromSupabase,
  syncLessonReferences,
  reconcileReferencesWithCloud,
  SUPABASE_BUCKET_NAME,
} from "./supabaseReferenceStorage";
import { isSupabaseConfigured } from "./client";
import { ReferenceGesture } from "@/types";
import {
  getReferencesByLessonId,
  addReference,
  deleteReference,
  getReferenceGestureById,
} from "@/lib/storage/referenceStorage";

test("Supabase Reference Gesture Storage Integration Test Suite", async (t) => {
  await t.test("1. Bucket name and storage path formatting", () => {
    assert.equal(SUPABASE_BUCKET_NAME, "gesture-references");
    const path = getReferenceStoragePath("hello", "ref_123");
    assert.equal(path, "references/hello/ref_123.json");
  });

  await t.test("2. Unconfigured environment handles uploads gracefully without throwing", async () => {
    const mockGesture: ReferenceGesture = {
      id: "ref_test_unconf",
      lessonId: "hello",
      word: "สวัสดี",
      createdAt: new Date().toISOString(),
      durationMs: 1000,
      frameCount: 25,
      frames: [],
    };

    const isConfigured = isSupabaseConfigured();
    const result = await uploadReferenceToSupabase(mockGesture);

    if (!isConfigured) {
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("not configured"));
    }
  });

  await t.test("3. Unconfigured environment returns empty array on fetch without throwing", async () => {
    const isConfigured = isSupabaseConfigured();
    if (!isConfigured) {
      const results = await fetchReferencesFromSupabase("hello");
      assert.deepEqual(results, []);
    }
  });

  await t.test("4. Unconfigured delete returns false without throwing", async () => {
    const isConfigured = isSupabaseConfigured();
    if (!isConfigured) {
      const success = await deleteReferenceFromSupabase("hello", "ref_test");
      assert.equal(success, false);
    }
  });

  await t.test("5. syncLessonReferences preserves local references in offline/unconfigured mode", async () => {
    const mockLocal: ReferenceGesture[] = [
      {
        id: "ref_local_1",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1000,
        frameCount: 25,
        frames: [],
      },
    ];

    const result = await syncLessonReferences("hello", mockLocal);
    assert.equal(result.allReferences.length, 1);
    assert.equal(result.allReferences[0].id, "ref_local_1");
  });

  await t.test("6. getReferencesByLessonId seamlessly falls back to seeds when cloud/local is empty", async () => {
    const refs = await getReferencesByLessonId("hello");
    assert.ok(refs.length > 0, "Must return at least 1 seed reference for hello lesson");
    assert.equal(refs[0].lessonId, "hello");
  });

  await t.test("7. reconcileReferencesWithCloud identifies stale items to purge and new items to add", () => {
    const localRefs: ReferenceGesture[] = [
      {
        id: "ref_stale_1",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1000,
        frameCount: 25,
        frames: [],
      },
      {
        id: "ref_keep_2",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1200,
        frameCount: 30,
        frames: [],
      },
    ];

    const cloudRefs: ReferenceGesture[] = [
      {
        id: "ref_keep_2",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1200,
        frameCount: 30,
        frames: [],
      },
      {
        id: "ref_new_3",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1400,
        frameCount: 35,
        frames: [],
      },
    ];

    const { reconciled, purgedCount, downloadedCount } = reconcileReferencesWithCloud(
      localRefs,
      cloudRefs
    );

    assert.equal(purgedCount, 1, "Must detect 1 stale reference to purge (ref_stale_1)");
    assert.equal(downloadedCount, 1, "Must detect 1 new reference from cloud (ref_new_3)");
    assert.equal(reconciled.length, 2);
    assert.ok(!reconciled.some((r: ReferenceGesture) => r.id === "ref_stale_1"), "Purged reference must not be in reconciled set");
    assert.ok(reconciled.some((r: ReferenceGesture) => r.id === "ref_keep_2"));
    assert.ok(reconciled.some((r: ReferenceGesture) => r.id === "ref_new_3"));
  });

  await t.test("8. reconcileReferencesWithCloud with empty cloud list purges all custom local references", () => {
    const localRefs: ReferenceGesture[] = [
      {
        id: "ref_custom_1",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1000,
        frameCount: 25,
        frames: [],
      },
    ];

    const { reconciled, purgedCount } = reconcileReferencesWithCloud(localRefs, []);

    assert.equal(purgedCount, 1);
    assert.deepEqual(reconciled, []);
  });

  await t.test("9. deleteReference cleans local storage without error", async () => {
    const testRef: ReferenceGesture = {
      id: "ref_temp_delete_test",
      lessonId: "hello",
      word: "สวัสดี",
      createdAt: new Date().toISOString(),
      durationMs: 1000,
      frameCount: 25,
      frames: [],
    };

    await addReference(testRef, { syncCloud: false });
    const found = await getReferenceGestureById("ref_temp_delete_test");
    assert.ok(found, "Temporary reference should be added");

    await deleteReference("ref_temp_delete_test", { syncCloud: false });
    const deleted = await getReferenceGestureById("ref_temp_delete_test");
    assert.equal(deleted, null, "Temporary reference should be deleted from local storage");
  });
});
