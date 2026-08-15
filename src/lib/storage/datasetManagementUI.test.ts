import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import {
  getCategories,
  resetCategoriesToDefault,
  addCategory,
} from "./categoryStorage";
import {
  getLessons,
  resetLessonsToDefault,
  addLesson,
} from "./lessonStorage";
import {
  getAllStoredReferences,
  clearReferences,
} from "./referenceStorage";
import {
  exportDataset,
  exportDatasetToJson,
  generateDatasetFilename,
} from "./datasetExportService";
import {
  validateDataset,
  createImportPlan,
  importDatasetFromJson,
} from "./datasetImportService";
import {
  createDatasetSnapshot,
  getDatasetSnapshots,
  deleteDatasetSnapshot,
  clearDatasetSnapshots,
  restoreDatasetSnapshot,
  factoryResetDataset,
  downloadDatasetSnapshot,
} from "./datasetBackupService";

import { TSLDatasetPackage } from "@/types";

describe("STEP 8B.7 — Dataset Management Operations & UI Workflow Test Suite", () => {
  beforeEach(async () => {
    await resetCategoriesToDefault();
    await resetLessonsToDefault();
    await clearReferences();
    await clearDatasetSnapshots();
  });

  // 1. Statistics Calculation
  test("1. Dataset statistics reflect live storage accurately", async () => {
    const cats = await getCategories({ includeInactive: true });
    const lessons = await getLessons({ includeInactive: true });
    const refs = await getAllStoredReferences({ includeSeeds: true });
    const snaps = await getDatasetSnapshots();

    assert.ok(cats.length > 0);
    assert.ok(lessons.length > 0);
    assert.ok(refs.length > 0);
    assert.strictEqual(snaps.length, 0);
  });

  // 2. Export Button & Output
  test("2. Export dataset produces valid JSON with metadata", async () => {
    const jsonStr = await exportDatasetToJson({ includeSeeds: true });
    const parsed = JSON.parse(jsonStr);

    assert.strictEqual(parsed.version, "1.0.0");
    assert.ok(parsed.categories.length > 0);
    assert.ok(parsed.lessons.length > 0);
    assert.ok(parsed.references.length > 0);

    const filename = generateDatasetFilename();
    assert.ok(filename.startsWith("tsl-dataset-"));
    assert.ok(filename.endsWith(".json"));
  });

  // 3. Import File Validation Error Display
  test("3. Validation rejects corrupted dataset and extracts specific error list", async () => {
    const invalidDataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [{ id: "cat_ok", name: "หมวดปกติ", order: 1 }],
      lessons: [
        {
          id: "les_bad",
          categoryId: "ghost_category", // Missing category FK
          word: "คำศัพท์ผิด",
          description: "",
          gestureType: "dynamic",
          order: 1,
        },
      ],
      references: [],
    };

    const val = await validateDataset(invalidDataset, { mode: "replace" });
    assert.strictEqual(val.isValid, false);
    assert.ok(val.errors.length > 0);
    assert.ok(val.errors.some((e) => e.type === "missing_category"));
  });

  // 4. Import Plan Preview
  test("4. Import plan preview computes exact create/update/skip/delete counts", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [
        { id: "greeting-basic", name: "ทักทาย (แก้ไข)", order: 1 }, // Existing -> Update / Skip
        { id: "cat_preview_new", name: "หมวดใหม่", order: 2 }, // New -> Create
      ],
      lessons: [],
      references: [],
    };

    const planOverwrite = await createImportPlan(dataset, {
      mode: "merge",
      duplicateStrategy: "overwrite",
    });
    assert.strictEqual(planOverwrite.summary.categoriesToCreate, 1);
    assert.strictEqual(planOverwrite.summary.categoriesToUpdate, 1);

    const planSkip = await createImportPlan(dataset, {
      mode: "merge",
      duplicateStrategy: "skip",
    });
    assert.strictEqual(planSkip.summary.categoriesToCreate, 1);
    assert.strictEqual(planSkip.summary.categoriesToSkip, 1);
  });

  // 5. Snapshot List Management
  test("5. Snapshot list creates, lists, and sorts newest snapshots first", async () => {
    await createDatasetSnapshot({ name: "Backup A" });
    await new Promise((r) => setTimeout(r, 10));
    await createDatasetSnapshot({ name: "Backup B" });

    const list = await getDatasetSnapshots();
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].name, "Backup B");
    assert.strictEqual(list[1].name, "Backup A");
  });

  // 6. Restore Confirmation & Workflow
  test("6. Restore snapshot completely replaces current dataset with snapshot contents", async () => {
    const customCat = await addCategory({ name: "หมวดพิเศษก่อนสำรอง" });
    const snap = await createDatasetSnapshot({ name: "Point A" });

    // Modify platform data
    await addCategory({ name: "หมวดใหม่หลังสำรองที่จะถูกแทนที่" });

    // Restore
    const summary = await restoreDatasetSnapshot(snap.id);
    assert.strictEqual(summary.success, true);

    const cats = await getCategories({ includeInactive: true });
    assert.ok(cats.some((c) => c.id === customCat.id));
    assert.ok(!cats.some((c) => c.name === "หมวดใหม่หลังสำรองที่จะถูกแทนที่"));
  });

  // 7. Delete Snapshot Workflow
  test("7. Delete snapshot removes target snapshot from list", async () => {
    const s1 = await createDatasetSnapshot({ name: "Snap 1" });
    const s2 = await createDatasetSnapshot({ name: "Snap 2" });

    await deleteDatasetSnapshot(s1.id);

    const list = await getDatasetSnapshots();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, s2.id);
  });

  // 8. Factory Reset Workflow
  test("8. Factory reset reverts categories, lessons, and references to default seed", async () => {
    await addCategory({ name: "หมวดหมู่ทดสอบล้างค่า" });
    await addLesson({
      word: "คำศัพท์ทดสอบล้างค่า",
      categoryId: "greeting-basic",
      description: "",
    });

    const resetSummary = await factoryResetDataset({ createBackup: true });
    assert.strictEqual(resetSummary.success, true);

    const cats = await getCategories({ includeInactive: true });
    assert.ok(!cats.some((c) => c.name === "หมวดหมู่ทดสอบล้างค่า"));

    const lessons = await getLessons({ includeInactive: true });
    assert.ok(!lessons.some((l) => l.word === "คำศัพท์ทดสอบล้างค่า"));

    // An auto backup must have been created
    const snaps = await getDatasetSnapshots();
    assert.strictEqual(snaps.length, 1);
    assert.strictEqual(snaps[0].name, "Quick Backup");
  });

  // 9. Download Snapshot Helper
  test("9. Download snapshot helper retrieves and serializes snapshot safely", async () => {
    const snap = await createDatasetSnapshot({ name: "Download Test" });
    const res = await downloadDatasetSnapshot(snap.id);
    // In Node (non-browser), fails gracefully without uncaught throw
    assert.strictEqual(typeof res.success, "boolean");
  });

  // 10. End-to-End Export -> Import Workflow
  test("10. Full cycle: Export dataset -> Modify -> Re-import Restore works end-to-end", async () => {
    const exportedPkg = await exportDataset({ includeSeeds: true });
    const exportedJson = JSON.stringify(exportedPkg);

    // Modify platform
    await addCategory({ name: "หมวดที่ถูกแทรก" });

    // Re-import with replace mode
    const importRes = await importDatasetFromJson(exportedJson, {
      mode: "replace",
      duplicateStrategy: "overwrite",
    });

    assert.strictEqual(importRes.validation.isValid, true);
    assert.strictEqual(importRes.summary?.success, true);

    const cats = await getCategories({ includeInactive: true });
    assert.ok(!cats.some((c) => c.name === "หมวดที่ถูกแทรก"));
  });

  // 11. Navigation Integration
  test("11. ADMIN_NAV_ITEMS includes dataset management route", async () => {
    const { ADMIN_NAV_ITEMS } = await import("@/components/admin/AdminSidebar");
    const datasetNav = ADMIN_NAV_ITEMS.find((item) => item.href === "/admin/dataset");
    assert.ok(datasetNav);
    assert.strictEqual(datasetNav?.label, "สำรองและถ่ายโอนข้อมูล");
  });
});

