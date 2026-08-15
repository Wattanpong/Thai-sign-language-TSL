import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import {
  getCategories,
  getCategoryById,
  addCategory,
  deleteCategory,
  canDeleteCategory,
  resetCategoriesToDefault,
} from "./categoryStorage";
import {
  getLessons,
  addLesson,
  deleteLesson,
  resetLessonsToDefault,
} from "./lessonStorage";
import {
  getReferencesByLessonId,
  getAllStoredReferences,
  addReference,
  clearReferences,
} from "./referenceStorage";
import {
  exportDataset,
  exportDatasetToJson,
} from "./datasetExportService";
import {
  validateDataset,
  importDatasetFromJson,
  executeImport,
} from "./datasetImportService";
import {
  createDatasetSnapshot,
  getDatasetSnapshots,
  clearDatasetSnapshots,
  restoreDatasetSnapshot,
  factoryResetDataset,
} from "./datasetBackupService";
import { ADMIN_NAV_ITEMS } from "@/components/admin/AdminSidebar";
import { INITIAL_CATEGORIES } from "@/data/seedCategories";
import { INITIAL_LESSONS } from "@/data/seedLessons";
import { createSyntheticGesture } from "@/lib/gesture/scoringCalibration";
import { TSLDatasetPackage, ReferenceGesture } from "@/types";


describe("STEP 8B.9 — Dataset Management End-to-End Integration Suite", () => {
  beforeEach(async () => {
    await resetCategoriesToDefault();
    await resetLessonsToDefault();
    await clearReferences();
    await clearDatasetSnapshots();
  });

  // SCOPE 1: CATEGORY → LESSON → REFERENCE LIFECYCLE & INTEGRITY
  test("1. Full Lifecycle: Category ➔ Lesson ➔ Reference creation, FK relations, and cascade deletion", async () => {
    // 1.1 Create Category
    const category = await addCategory({
      name: "หมวดคำศัพท์ทดสอบ E2E",
      description: "คำอธิบายหมวดหมู่",
    });
    assert.ok(category.id);
    assert.strictEqual(category.name, "หมวดคำศัพท์ทดสอบ E2E");

    // 1.2 Create Lesson referencing Category
    const lesson = await addLesson({
      word: "คำทดสอบ E2E",
      categoryId: category.id,
      description: "คำอธิบายคำศัพท์",
      gestureType: "dynamic",
      difficulty: "intermediate",
    });
    assert.ok(lesson.id);
    assert.strictEqual(lesson.categoryId, category.id);

    // 1.3 Add Reference to Lesson
    const rawRef = createSyntheticGesture(20, 800, "both");
    const customRef: ReferenceGesture = {
      ...rawRef,
      id: "ref_e2e_01",
      lessonId: lesson.id,
      word: lesson.word,
      isPrimary: true,
      qualityScore: 92,
      qualityLevel: "good",
    };
    await addReference(customRef);

    // Verify Reference retrieval
    const storedRefs = await getReferencesByLessonId(lesson.id);
    assert.strictEqual(storedRefs.length, 1);
    assert.strictEqual(storedRefs[0].id, "ref_e2e_01");
    assert.strictEqual(storedRefs[0].isPrimary, true);

    // 1.4 Deletion Guard: Category with lessons cannot be deleted
    const guardCheck = await canDeleteCategory(category.id);
    assert.strictEqual(guardCheck.canDelete, false);
    assert.strictEqual(guardCheck.lessonCount, 1);

    const blockedDelete = await deleteCategory(category.id);
    assert.strictEqual(blockedDelete.success, false);
    assert.ok(blockedDelete.error && blockedDelete.error.includes("ไม่สามารถลบหมวดหมู่"));


    // 1.5 Cascade Reference Cleanup: Deleting Lesson removes its references automatically

    await deleteLesson(lesson.id);
    const remainingRefs = await getReferencesByLessonId(lesson.id);
    assert.strictEqual(remainingRefs.length, 0);

    // 1.6 After lesson deletion, Category is now empty and can be safely deleted
    const updatedGuard = await canDeleteCategory(category.id);
    assert.strictEqual(updatedGuard.canDelete, true);
    assert.strictEqual(updatedGuard.lessonCount, 0);

    await deleteCategory(category.id);
    const catCheck = await getCategoryById(category.id);
    assert.strictEqual(catCheck, null);
  });

  // SCOPE 2: DATASET EXPORT FLOW
  test("2. Export Flow: Exports clean dataset with exact metadata, schema, and immutability", async () => {
    // Add custom content
    const cat = await addCategory({ name: "หมวดสำหรับ Export E2E" });
    const les = await addLesson({ word: "คำสำหรับ Export E2E", categoryId: cat.id });
    const rawRef = createSyntheticGesture(15, 600, "both");
    await addReference({
      ...rawRef,
      id: "ref_export_e2e",
      lessonId: les.id,
      word: les.word,
      isPrimary: true,
    });

    const dataset = await exportDataset({ includeSeeds: true });

    // Validate Package structure
    assert.strictEqual(dataset.version, "1.0.0");
    assert.strictEqual(dataset.appName, "Thai Sign Language AI Platform");
    assert.ok(dataset.exportedAt);
    assert.strictEqual(dataset.metadata?.totalCategories, dataset.categories.length);
    assert.strictEqual(dataset.metadata?.totalLessons, dataset.lessons.length);
    assert.strictEqual(dataset.metadata?.totalReferences, dataset.references.length);

    // Check JSON serialization
    const jsonString = await exportDatasetToJson({ pretty: true });
    const parsed = JSON.parse(jsonString);
    assert.strictEqual(parsed.version, "1.0.0");
    assert.strictEqual(parsed.categories.length, dataset.categories.length);

    // Verify storage immutability: mutating exported object does not alter storage
    dataset.categories[0].name = "TAMPERED_NAME";
    const freshCat = await getCategoryById(cat.id);
    assert.notStrictEqual(freshCat?.name, "TAMPERED_NAME");
  });

  // SCOPE 3: DATASET IMPORT FLOW (MERGE, REPLACE, STRATEGIES, VALIDATION)
  test("3. Import Flow: Merge, Replace, Duplicate Strategies, and Structural/Relational Validation", async () => {
    // 3.1 Valid Merge with Skip duplicate strategy
    const mergeDataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [
        { id: "greeting-basic", name: "ทักทาย (ควรถูกข้าม)", order: 1 }, // Existing ID
        { id: "cat_e2e_import_new", name: "หมวดนำเข้าใหม่ E2E", order: 20 }, // New ID
      ],
      lessons: [],
      references: [],
    };

    const mergeRes = await importDatasetFromJson(mergeDataset, {
      mode: "merge",
      duplicateStrategy: "skip",
    });
    assert.strictEqual(mergeRes.validation.isValid, true);
    assert.strictEqual(mergeRes.summary?.importedCategories, 1);
    assert.strictEqual(mergeRes.summary?.skippedCategories, 1);

    // Verify existing category was preserved
    const greetingCat = await getCategoryById("greeting-basic");
    assert.notStrictEqual(greetingCat?.name, "ทักทาย (ควรถูกข้าม)");

    // 3.2 Overwrite Duplicate Strategy
    const overwriteDataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [{ id: "greeting-basic", name: "ทักทาย (แก้ไขผ่าน Overwrite)", order: 1 }],
      lessons: [],
      references: [],
    };

    const overwriteRes = await importDatasetFromJson(overwriteDataset, {
      mode: "merge",
      duplicateStrategy: "overwrite",
    });
    assert.strictEqual(overwriteRes.validation.isValid, true);
    const updatedGreetingCat = await getCategoryById("greeting-basic");
    assert.strictEqual(updatedGreetingCat?.name, "ทักทาย (แก้ไขผ่าน Overwrite)");

    // 3.3 Replace Mode
    const replaceDataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [{ id: "cat_replace_only", name: "หมวดเดียวในระบบ", order: 1 }],
      lessons: [
        {
          id: "les_replace_only",
          categoryId: "cat_replace_only",
          word: "คำเดียวในระบบ",
          description: "",
          gestureType: "dynamic",
          order: 1,
        },
      ],
      references: [],
    };

    const replaceRes = await importDatasetFromJson(replaceDataset, { mode: "replace" });
    assert.strictEqual(replaceRes.validation.isValid, true);

    const allCats = await getCategories({ includeInactive: true });
    assert.strictEqual(allCats.length, 1);
    assert.strictEqual(allCats[0].id, "cat_replace_only");

    // 3.4 Invalid Dataset Rejection (Missing FK) leaves storage untouched
    const badDataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [],
      lessons: [
        {
          id: "bad_les",
          categoryId: "missing_category_id",
          word: "เสีย",
          description: "",
          gestureType: "dynamic",
          order: 1,
        },
      ],
      references: [],
    };

    const badVal = await validateDataset(badDataset, { mode: "replace" });
    assert.strictEqual(badVal.isValid, false);
    assert.ok(badVal.errors.some((e) => e.type === "missing_category"));

    // Storage unchanged
    const catsAfterBad = await getCategories({ includeInactive: true });
    assert.strictEqual(catsAfterBad.length, 1);
  });

  // SCOPE 4: BACKUP & RESTORE FLOW
  test("4. Backup & Restore Flow: Creates snapshot, creates safety backup, and restores cleanly", async () => {
    // 4.1 Create initial custom state
    const cat = await addCategory({ name: "หมวดก่อน Snapshot" });
    const snap = await createDatasetSnapshot({
      name: "E2E Snapshot Point",
      description: "จุดสำรองก่อนการทดสอบ",
    });

    assert.ok(snap.id);
    assert.strictEqual(snap.name, "E2E Snapshot Point");

    // 4.2 Alter current platform state
    await addCategory({ name: "หมวดแปลกปลอมหลังจาก Snapshot" });

    // 4.3 Restore Snapshot
    const restoreSummary = await restoreDatasetSnapshot(snap.id);
    assert.strictEqual(restoreSummary.success, true);

    const cats = await getCategories({ includeInactive: true });
    assert.ok(cats.some((c) => c.id === cat.id));
    assert.ok(!cats.some((c) => c.name === "หมวดแปลกปลอมหลังจาก Snapshot"));

    // Verify auto safety backup was recorded during restore
    const allSnaps = await getDatasetSnapshots();
    assert.ok(allSnaps.some((s) => s.name === "Quick Backup" && s.isAutoBackup === true));
  });

  // SCOPE 5: FACTORY RESET FLOW
  test("5. Factory Reset Flow: Reverts to original seeds and protects seed constants from mutation", async () => {
    const initialSeedCatStr = JSON.stringify(INITIAL_CATEGORIES);
    const initialSeedLesStr = JSON.stringify(INITIAL_LESSONS);

    // Add custom content
    await addCategory({ name: "หมวดที่จะถูก Factory Reset" });
    await addLesson({ word: "คำที่จะถูก Factory Reset", categoryId: "greeting-basic" });

    // Execute Factory Reset
    const resetSummary = await factoryResetDataset({ createBackup: true });
    assert.strictEqual(resetSummary.success, true);

    // Verify restored state matches seed categories & lessons exactly
    const cats = await getCategories({ includeInactive: true });
    assert.strictEqual(cats.length, INITIAL_CATEGORIES.length);
    assert.strictEqual(cats[0].id, INITIAL_CATEGORIES[0].id);

    const lessons = await getLessons({ includeInactive: true });
    assert.strictEqual(lessons.length, INITIAL_LESSONS.length);

    // Verify source seed constants were not mutated
    assert.strictEqual(JSON.stringify(INITIAL_CATEGORIES), initialSeedCatStr);
    assert.strictEqual(JSON.stringify(INITIAL_LESSONS), initialSeedLesStr);
  });

  // SCOPE 6: SIDEBAR / NAVIGATION INTEGRATION
  test("6. Navigation Flow: AdminSidebar contains /admin/dataset with correct title and preserves existing nav items", () => {
    assert.strictEqual(ADMIN_NAV_ITEMS.length, 4);

    const dashboardNav = ADMIN_NAV_ITEMS.find((i) => i.href === "/admin");
    const categoriesNav = ADMIN_NAV_ITEMS.find((i) => i.href === "/admin/categories");
    const lessonsNav = ADMIN_NAV_ITEMS.find((i) => i.href === "/admin/lessons");
    const datasetNav = ADMIN_NAV_ITEMS.find((i) => i.href === "/admin/dataset");

    assert.ok(dashboardNav);
    assert.ok(categoriesNav);
    assert.ok(lessonsNav);
    assert.ok(datasetNav);

    assert.strictEqual(datasetNav?.label, "สำรองและถ่ายโอนข้อมูล");
    assert.strictEqual(datasetNav?.href, "/admin/dataset");
  });

  // SCOPE 7: DATA SAFETY & ATOMIC ROLLBACK ON EXECUTION FAILURE
  test("7. Data Safety: Mid-execution failure triggers Atomic Rollback with zero partial import", async () => {
    const initialCats = await getCategories({ includeInactive: true });
    const initialLessons = await getLessons({ includeInactive: true });
    const initialRefs = await getAllStoredReferences({ includeSeeds: false });

    // Mock faulty import plan where category creates fine, but subsequent lesson triggers execution exception
    const brokenPlan = {
      mode: "merge" as const,
      duplicateStrategy: "overwrite" as const,
      categories: [
        {
          action: "create" as const,
          item: { id: "cat_temp_fail_check", name: "หมวดทดสอบ Rollback", order: 99 },
        },
      ],
      lessons: [
        {
          action: "create" as const,
          item: {
            id: "les_trigger_failure",
            categoryId: "non_existent_ghost_cat_id", // Missing category -> addLesson will throw
            word: "พัง",
            description: "",
            gestureType: "dynamic" as const,
            order: 99,
          },
        },
      ],
      references: [],
      summary: {
        totalIncomingCategories: 1,
        totalIncomingLessons: 1,
        totalIncomingReferences: 0,
        categoriesToCreate: 1,
        categoriesToUpdate: 0,
        categoriesToSkip: 0,
        categoriesToDelete: 0,
        lessonsToCreate: 1,
        lessonsToUpdate: 0,
        lessonsToSkip: 0,
        lessonsToDelete: 0,
        referencesToCreate: 0,
        referencesToUpdate: 0,
        referencesToSkip: 0,
        referencesToDelete: 0,
      },
    };

    await assert.rejects(
      async () => {
        await executeImport(brokenPlan);
      },
      /การนำเข้าล้มเหลว และระบบได้ Rollback ข้อมูลเดิมเรียบร้อยแล้ว/
    );

    // Verify storage has returned to 100% of its initial state (Zero partial import)
    const catsAfter = await getCategories({ includeInactive: true });
    assert.strictEqual(catsAfter.length, initialCats.length);
    assert.ok(!catsAfter.some((c) => c.id === "cat_temp_fail_check"));

    const lessonsAfter = await getLessons({ includeInactive: true });
    assert.strictEqual(lessonsAfter.length, initialLessons.length);

    const refsAfter = await getAllStoredReferences({ includeSeeds: false });
    assert.strictEqual(refsAfter.length, initialRefs.length);
  });
});
