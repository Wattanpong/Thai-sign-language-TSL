import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createDatasetSnapshot,
  getDatasetSnapshots,
  getDatasetSnapshotById,
  deleteDatasetSnapshot,
  clearDatasetSnapshots,
  cleanupOldSnapshots,
  restoreDatasetSnapshot,
  factoryResetDataset,
  createQuickBackup,
  downloadDatasetSnapshot,
} from "./datasetBackupService";
import {
  getCategories,
  addCategory,
  resetCategoriesToDefault,
} from "./categoryStorage";
import {
  getLessons,
  addLesson,
  resetLessonsToDefault,
} from "./lessonStorage";
import {
  getReferencesByLessonId,
  clearReferences,
} from "./referenceStorage";
import { INITIAL_CATEGORIES } from "@/data/seedCategories";
import { INITIAL_LESSONS } from "@/data/seedLessons";

describe("STEP 8B.6 — Dataset Backup / Restore Service Test Suite", () => {
  beforeEach(async () => {
    await resetCategoriesToDefault();
    await resetLessonsToDefault();
    await clearReferences();
    await clearDatasetSnapshots();
  });

  // A. Snapshot Creation
  test("1. createDatasetSnapshot creates valid snapshot", async () => {
    const snap = await createDatasetSnapshot();
    assert.ok(snap);
    assert.ok(snap.id);
    assert.ok(snap.dataset);
  });

  test("2. snapshot contains valid dataset", async () => {
    const snap = await createDatasetSnapshot({ includeSeeds: true });
    assert.strictEqual(snap.dataset.version, "1.0.0");
    assert.ok(snap.dataset.categories.length > 0);
    assert.ok(snap.dataset.lessons.length > 0);
  });

  test("3. snapshot has valid ISO timestamp", async () => {
    const snap = await createDatasetSnapshot();
    const date = new Date(snap.createdAt);
    assert.strictEqual(date.toISOString(), snap.createdAt);
  });

  test("4. snapshot has unique ID", async () => {
    const snap1 = await createDatasetSnapshot();
    const snap2 = await createDatasetSnapshot();
    assert.notStrictEqual(snap1.id, snap2.id);
  });

  test("5. custom name is preserved", async () => {
    const snap = await createDatasetSnapshot({ name: "Custom Backup Name" });
    assert.strictEqual(snap.name, "Custom Backup Name");
  });

  test("6. description is preserved", async () => {
    const snap = await createDatasetSnapshot({ description: "Backup before update" });
    assert.strictEqual(snap.description, "Backup before update");
  });

  test("7. isAutoBackup is preserved", async () => {
    const snap = await createDatasetSnapshot({ isAutoBackup: true });
    assert.strictEqual(snap.isAutoBackup, true);
  });

  // B. Snapshot Storage
  test("8. save and retrieve snapshot", async () => {
    await createDatasetSnapshot({ name: "Test Snapshot 1" });
    const all = await getDatasetSnapshots();
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].name, "Test Snapshot 1");
  });

  test("9. getSnapshotById returns correct snapshot", async () => {
    const created = await createDatasetSnapshot({ name: "Target Snapshot" });
    const fetched = await getDatasetSnapshotById(created.id);
    assert.ok(fetched);
    assert.strictEqual(fetched?.id, created.id);
    assert.strictEqual(fetched?.name, "Target Snapshot");
  });

  test("10. missing snapshot returns null", async () => {
    const result = await getDatasetSnapshotById("non_existent_snapshot_id");
    assert.strictEqual(result, null);
  });

  test("11. snapshots sorted newest first", async () => {
    const s1 = await createDatasetSnapshot({ name: "First" });
    // Slight delay to ensure distinct timestamp
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await createDatasetSnapshot({ name: "Second" });

    const all = await getDatasetSnapshots();
    assert.strictEqual(all.length, 2);
    assert.strictEqual(all[0].id, s2.id);
    assert.strictEqual(all[1].id, s1.id);
  });

  test("12. delete snapshot works", async () => {
    const snap = await createDatasetSnapshot();
    assert.strictEqual((await getDatasetSnapshots()).length, 1);

    await deleteDatasetSnapshot(snap.id);
    assert.strictEqual((await getDatasetSnapshots()).length, 0);
  });

  test("13. clear snapshots works", async () => {
    await createDatasetSnapshot();
    await createDatasetSnapshot();
    assert.strictEqual((await getDatasetSnapshots()).length, 2);

    await clearDatasetSnapshots();
    assert.strictEqual((await getDatasetSnapshots()).length, 0);
  });

  // C. Immutability
  test("14. modifying returned snapshot does not mutate storage", async () => {
    const created = await createDatasetSnapshot({ name: "Original Name" });
    created.name = "MUTATED";
    created.dataset.categories[0].name = "MUTATED CAT";

    const reFetched = await getDatasetSnapshotById(created.id);
    assert.strictEqual(reFetched?.name, "Original Name");
    assert.notStrictEqual(reFetched?.dataset.categories[0].name, "MUTATED CAT");
  });

  test("15. modifying source dataset does not mutate existing snapshot", async () => {
    const snap = await createDatasetSnapshot();
    const snapCatCount = snap.dataset.categories.length;

    await addCategory({ name: "หมวดหมู่ใหม่หลังจาก Snapshot" });

    const fetched = await getDatasetSnapshotById(snap.id);
    assert.strictEqual(fetched?.dataset.categories.length, snapCatCount);
  });

  // D. Restore
  test("16. restore valid snapshot successfully", async () => {
    const cat = await addCategory({ name: "หมวดหมู่เฉพาะก่อน Snapshot" });
    const snap = await createDatasetSnapshot();

    // Modify current storage
    await addCategory({ name: "หมวดหมู่อื่นหลังจาก Snapshot" });

    // Restore snapshot
    const summary = await restoreDatasetSnapshot(snap.id);
    assert.strictEqual(summary.success, true);

    const cats = await getCategories({ includeInactive: true });
    assert.ok(cats.some((c) => c.id === cat.id));
    assert.ok(!cats.some((c) => c.name === "หมวดหมู่อื่นหลังจาก Snapshot"));
  });

  test("17. restore uses replace mode by default", async () => {
    const snap = await createDatasetSnapshot();

    // Add new lesson
    await addLesson({
      word: "คำใหม่ที่จะถูกล้างด้วย Restore",
      categoryId: "greeting-basic",
      description: "",
    });

    await restoreDatasetSnapshot(snap.id);

    const lessons = await getLessons({ includeInactive: true });
    assert.ok(!lessons.some((l) => l.word === "คำใหม่ที่จะถูกล้างด้วย Restore"));
  });

  test("18. invalid snapshot is rejected", async () => {
    await createDatasetSnapshot();
    // Corrupt snapshot dataset in storage
    const all = await getDatasetSnapshots();
    (all[0].dataset as unknown as { version: string }).version = "9.9.9"; // Unsupported
    // Overwrite storage
    await clearDatasetSnapshots();
    for (const s of all) {
      await createDatasetSnapshot({ name: s.name });
    }

    await assert.rejects(
      async () => {
        await restoreDatasetSnapshot("invalid_target_id");
      },
      /ไม่พบ Snapshot ID/
    );
  });


  test("19. missing snapshot is rejected", async () => {
    await assert.rejects(
      async () => {
        await restoreDatasetSnapshot("ghost_id");
      },
      /ไม่พบ Snapshot ID/
    );
  });

  test("20. restore failure preserves original dataset", async () => {
    const initialCats = await getCategories({ includeInactive: true });

    await assert.rejects(
      async () => {
        await restoreDatasetSnapshot("non_existent_id");
      }
    );

    const afterCats = await getCategories({ includeInactive: true });
    assert.strictEqual(afterCats.length, initialCats.length);
  });

  test("21. safety backup is created before restore", async () => {
    const snap = await createDatasetSnapshot({ name: "Restore Point" });
    const snapshotsBefore = (await getDatasetSnapshots()).length;

    await restoreDatasetSnapshot(snap.id);

    const snapshotsAfter = (await getDatasetSnapshots()).length;
    assert.strictEqual(snapshotsAfter, snapshotsBefore + 1, "Quick backup must be created before restore");
  });

  // E. Factory Reset
  test("22. factory reset restores seed categories", async () => {
    await addCategory({ name: "หมวดหมู่แปลกปลอม" });
    await factoryResetDataset({ createBackup: false });

    const cats = await getCategories({ includeInactive: true });
    assert.strictEqual(cats.length, INITIAL_CATEGORIES.length);
    assert.strictEqual(cats[0].id, INITIAL_CATEGORIES[0].id);
  });

  test("23. factory reset restores seed lessons", async () => {
    await addLesson({
      word: "คำแปลกปลอม",
      categoryId: "greeting-basic",
      description: "",
    });

    await factoryResetDataset({ createBackup: false });

    const lessons = await getLessons({ includeInactive: true });
    assert.strictEqual(lessons.length, INITIAL_LESSONS.length);
  });

  test("24. factory reset restores seed references", async () => {
    await factoryResetDataset({ createBackup: false });
    const refs = await getReferencesByLessonId("hello");
    assert.ok(refs.length >= 1);
  });

  test("25. factory reset does not mutate seed data arrays", async () => {
    const initialCatJson = JSON.stringify(INITIAL_CATEGORIES);
    const initialLesJson = JSON.stringify(INITIAL_LESSONS);

    await factoryResetDataset({ createBackup: false });

    assert.strictEqual(JSON.stringify(INITIAL_CATEGORIES), initialCatJson);
    assert.strictEqual(JSON.stringify(INITIAL_LESSONS), initialLesJson);
  });

  test("26. factory reset creates backup when enabled", async () => {
    await clearDatasetSnapshots();
    await factoryResetDataset({ createBackup: true });

    const snapshots = await getDatasetSnapshots();
    assert.strictEqual(snapshots.length, 1);
    assert.strictEqual(snapshots[0].name, "Quick Backup");
  });

  test("27. factory reset with createBackup=false does not create backup snapshot", async () => {
    await clearDatasetSnapshots();
    await factoryResetDataset({ createBackup: false });

    const snapshots = await getDatasetSnapshots();
    assert.strictEqual(snapshots.length, 0);
  });

  // F. Snapshot Cleanup
  test("28. cleanupOldSnapshots respects maxSnapshots", async () => {
    for (let i = 0; i < 5; i++) {
      await createDatasetSnapshot({ name: `Snap ${i}` });
      await new Promise((r) => setTimeout(r, 5));
    }

    const removed = await cleanupOldSnapshots(3);
    assert.strictEqual(removed, 2);

    const remaining = await getDatasetSnapshots();
    assert.strictEqual(remaining.length, 3);
  });

  test("29. cleanupOldSnapshots deletes oldest snapshots and keeps newest", async () => {
    const s1 = await createDatasetSnapshot({ name: "Oldest" });
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await createDatasetSnapshot({ name: "Middle" });
    await new Promise((r) => setTimeout(r, 10));
    const s3 = await createDatasetSnapshot({ name: "Newest" });

    await cleanupOldSnapshots(2);

    const remaining = await getDatasetSnapshots();
    assert.strictEqual(remaining.length, 2);
    assert.strictEqual(remaining[0].id, s3.id);
    assert.strictEqual(remaining[1].id, s2.id);
    assert.ok(!remaining.some((s) => s.id === s1.id));
  });

  test("30. cleanupOldSnapshots validates maxSnapshots >= 1", async () => {
    await assert.rejects(
      async () => {
        await cleanupOldSnapshots(0);
      },
      /maxSnapshots ต้องเป็นจำนวนเต็มบวก/
    );

    await assert.rejects(
      async () => {
        await cleanupOldSnapshots(-1);
      },
      /maxSnapshots ต้องเป็นจำนวนเต็มบวก/
    );
  });

  // G. Quick Backup
  test("31. createQuickBackup creates correct metadata and isAutoBackup flag", async () => {
    const quick = await createQuickBackup();
    assert.strictEqual(quick.name, "Quick Backup");
    assert.strictEqual(quick.isAutoBackup, true);
    assert.ok(quick.id);
  });

  test("32. quick backup includes seed references", async () => {
    const quick = await createQuickBackup();
    assert.ok(quick.dataset.references.length >= 1);
  });

  // H. Download
  test("33. downloadDatasetSnapshot fails gracefully when snapshot not found", async () => {
    const res = await downloadDatasetSnapshot("missing_id");
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("ไม่พบ Snapshot ID"));
  });

  test("34. download works gracefully in Node/SSR environment", async () => {
    const snap = await createDatasetSnapshot();
    const res = await downloadDatasetSnapshot(snap.id);
    // In Node (non-browser), should return error gracefully without throwing uncaught exception
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("เบราว์เซอร์"));
  });

  test("35. SSR / Node environment does not crash during backup operations", async () => {
    const snap = await createDatasetSnapshot();
    assert.ok(snap);
    const summary = await restoreDatasetSnapshot(snap.id);
    assert.ok(summary);
  });
});
