import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import {
  validateDataset,
  createImportPlan,
  executeImport,
  importDatasetFromJson,
} from "./datasetImportService";
import {
  exportDataset,
} from "./datasetExportService";
import {
  getCategories,
  resetCategoriesToDefault,
} from "./categoryStorage";
import {
  getLessons,
  resetLessonsToDefault,
} from "./lessonStorage";
import {
  getReferencesByLessonId,
  clearReferences,
} from "./referenceStorage";
import { TSLDatasetPackage, ReferenceFrame } from "@/types";

describe("STEP 8B.5 — Dataset Import Service Test Suite", () => {
  beforeEach(async () => {
    await resetCategoriesToDefault();
    await resetLessonsToDefault();
    await clearReferences();
  });

  // STRUCTURAL VALIDATION TESTS
  test("1. Valid dataset passes validation", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test("2. Invalid JSON string is rejected", async () => {
    const result = await validateDataset("invalid-json-string{");
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors[0].type, "invalid_json");
  });

  test("3. Unsupported dataset version is rejected", async () => {
    const pkg = await exportDataset();
    (pkg as unknown as { version: string }).version = "2.0.0";
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors[0].type, "unsupported_version");
  });

  test("4. Missing or invalid categories array is rejected", async () => {
    const pkg = await exportDataset();
    (pkg as unknown as { categories: unknown }).categories = "not-an-array";
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.entity === "category"));
  });

  test("5. Missing or invalid lessons array is rejected", async () => {
    const pkg = await exportDataset();
    (pkg as unknown as { lessons: unknown }).lessons = null;
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.entity === "lesson"));
  });

  test("6. Missing or invalid references array is rejected", async () => {
    const pkg = await exportDataset();
    (pkg as unknown as { references: unknown }).references = 123;
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.entity === "reference"));
  });


  test("7. Duplicate category ID within dataset is rejected", async () => {
    const pkg = await exportDataset();
    pkg.categories.push({ id: pkg.categories[0].id, name: "Duplicate Cat", order: 99 });
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "duplicate_id" && e.entity === "category"));
  });

  test("8. Duplicate lesson ID within dataset is rejected", async () => {
    const pkg = await exportDataset();
    pkg.lessons.push({ ...pkg.lessons[0], word: "Duplicate Lesson" });
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "duplicate_id" && e.entity === "lesson"));
  });

  test("9. Duplicate reference ID within dataset is rejected", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    if (pkg.references.length > 0) {
      pkg.references.push({ ...pkg.references[0] });
      const result = await validateDataset(pkg);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((e) => e.type === "duplicate_id" && e.entity === "reference"));
    }
  });

  // RELATIONAL VALIDATION TESTS
  test("10. Missing category foreign key is rejected in replace mode", async () => {
    const pkg = await exportDataset();
    pkg.lessons.push({
      id: "les_invalid_cat",
      categoryId: "non_existent_category",
      word: "คำศัพท์",
      description: "...",
      gestureType: "dynamic",
      order: 1,
    });
    const result = await validateDataset(pkg, { mode: "replace" });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "missing_category"));
  });

  test("11. Missing lesson foreign key in reference is rejected", async () => {
    const pkg = await exportDataset();
    pkg.references.push({
      id: "ref_invalid_lesson",
      lessonId: "non_existent_lesson",
      word: "คำ 1",
      createdAt: new Date().toISOString(),
      durationMs: 1000,
      frameCount: 1,
      frames: [{ timestampMs: 0, hands: [], pose: [] }],
    });
    const result = await validateDataset(pkg, { mode: "replace" });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "orphan_reference"));
  });

  test("12. Orphan reference is rejected in merge mode when lesson missing from both dataset and storage", async () => {
    const pkg: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [],
      lessons: [],
      references: [
        {
          id: "orphan_ref",
          lessonId: "ghost_lesson",
          word: "ผี",
          createdAt: new Date().toISOString(),
          durationMs: 1000,
          frameCount: 1,
          frames: [{ timestampMs: 0, hands: [], pose: [] }],
        },
      ],
    };

    const result = await validateDataset(pkg, { mode: "merge" });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "orphan_reference"));
  });

  // LANDMARK VALIDATION TESTS
  test("13. Invalid frame structure is rejected", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    pkg.references = [
      {
        id: "ref_bad_frame",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1000,
        frameCount: 1,
        frames: ["not_a_frame_object" as unknown as ReferenceFrame],
      },
    ];
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "invalid_frames"));
  });

  test("14. NaN in landmark coordinates is rejected", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    pkg.references = [
      {
        id: "ref_nan_landmark",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1000,
        frameCount: 1,
        frames: [
          {
            timestampMs: 0,
            hands: [
              {
                handedness: "Right",
                landmarks: [{ x: NaN, y: 0.5, z: 0 }],
              },
            ],
            pose: [],
          },
        ],
      },
    ];
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "invalid_landmarks"));
  });

  test("15. Infinity in landmark coordinates is rejected", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    pkg.references = [
      {
        id: "ref_inf_landmark",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1000,
        frameCount: 1,
        frames: [
          {
            timestampMs: 0,
            hands: [],
            pose: [{ x: Infinity, y: 0.5, z: 0 }],
          },
        ],
      },
    ];
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "invalid_landmarks"));
  });

  test("16. Invalid frames non-array is rejected", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    pkg.references = [
      {
        id: "ref_bad_frames",
        lessonId: "hello",
        word: "สวัสดี",
        createdAt: new Date().toISOString(),
        durationMs: 1000,
        frameCount: 1,
        frames: null as unknown as ReferenceFrame[],
      },
    ];
    const result = await validateDataset(pkg);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.type === "invalid_frames"));
  });


  // MERGE MODE TESTS
  test("17. Merge new categories into storage", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [{ id: "cat_new_merged", name: "หมวดหมู่ใหม่ Merge", order: 50 }],
      lessons: [],
      references: [],
    };

    const res = await importDatasetFromJson(dataset, { mode: "merge" });
    assert.strictEqual(res.validation.isValid, true);
    assert.strictEqual(res.summary?.importedCategories, 1);

    const allCats = await getCategories({ includeInactive: true });
    assert.ok(allCats.some((c) => c.id === "cat_new_merged"));
  });

  test("18. Merge new lessons under existing category", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [],
      lessons: [
        {
          id: "les_new_merged",
          categoryId: "greeting-basic",
          word: "คำใหม่ Merge",
          description: "...",
          gestureType: "dynamic",
          order: 99,
        },
      ],
      references: [],
    };

    const res = await importDatasetFromJson(dataset, { mode: "merge" });
    assert.strictEqual(res.validation.isValid, true);
    assert.strictEqual(res.summary?.importedLessons, 1);

    const allLessons = await getLessons({ includeInactive: true });
    assert.ok(allLessons.some((l) => l.id === "les_new_merged"));
  });

  test("19. Merge new references under existing lesson", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [],
      lessons: [],
      references: [
        {
          id: "ref_merged_hello_custom",
          lessonId: "hello",
          word: "สวัสดี",
          createdAt: new Date().toISOString(),
          durationMs: 1000,
          frameCount: 1,
          frames: [{ timestampMs: 0, hands: [], pose: [] }],
        },
      ],
    };

    const res = await importDatasetFromJson(dataset, { mode: "merge" });
    assert.strictEqual(res.validation.isValid, true);
    assert.strictEqual(res.summary?.importedReferences, 1);

    const refs = await getReferencesByLessonId("hello");
    assert.ok(refs.some((r) => r.id === "ref_merged_hello_custom"));
  });

  test("20. Duplicate strategy = overwrite replaces existing item", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [
        {
          id: "greeting-basic",
          name: "ทักทาย (แก้ไขผ่าน Overwrite)",
          order: 1,
        },
      ],
      lessons: [],
      references: [],
    };

    const res = await importDatasetFromJson(dataset, {
      mode: "merge",
      duplicateStrategy: "overwrite",
    });
    assert.strictEqual(res.validation.isValid, true);

    const allCats = await getCategories({ includeInactive: true });
    const cat = allCats.find((c) => c.id === "greeting-basic");
    assert.strictEqual(cat?.name, "ทักทาย (แก้ไขผ่าน Overwrite)");
  });

  test("21. Duplicate strategy = skip ignores duplicate item", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [
        {
          id: "greeting-basic",
          name: "ชื่อที่ควรจะถูกข้าม",
          order: 1,
        },
      ],
      lessons: [],
      references: [],
    };

    const res = await importDatasetFromJson(dataset, {
      mode: "merge",
      duplicateStrategy: "skip",
    });
    assert.strictEqual(res.validation.isValid, true);
    assert.strictEqual(res.summary?.skippedCategories, 1);

    const allCats = await getCategories({ includeInactive: true });
    const cat = allCats.find((c) => c.id === "greeting-basic");
    assert.notStrictEqual(cat?.name, "ชื่อที่ควรจะถูกข้าม");
  });

  test("22. Duplicate strategy = error throws on collision", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [{ id: "greeting-basic", name: "ชน ID", order: 1 }],
      lessons: [],
      references: [],
    };

    await assert.rejects(
      async () => {
        await importDatasetFromJson(dataset, {
          mode: "merge",
          duplicateStrategy: "error",
        });
      },
      /พบ Category ID ซ้ำกันในระบบ/
    );
  });

  // REPLACE MODE TESTS
  test("23. Replace mode removes old items and replaces with new dataset", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [{ id: "cat_fresh", name: "หมวดหมู่ใหม่เอี่ยม", order: 1 }],
      lessons: [
        {
          id: "les_fresh",
          categoryId: "cat_fresh",
          word: "คำใหม่เอี่ยม",
          description: "...",
          gestureType: "static",
          order: 1,
        },
      ],
      references: [
        {
          id: "ref_fresh",
          lessonId: "les_fresh",
          word: "คำใหม่เอี่ยม",
          createdAt: new Date().toISOString(),
          durationMs: 1000,
          frameCount: 1,
          frames: [{ timestampMs: 0, hands: [], pose: [] }],
        },
      ],
    };

    const res = await importDatasetFromJson(dataset, { mode: "replace" });
    assert.strictEqual(res.validation.isValid, true);

    const cats = await getCategories({ includeInactive: true });
    assert.strictEqual(cats.length, 1);
    assert.strictEqual(cats[0].id, "cat_fresh");

    const lessons = await getLessons({ includeInactive: true });
    assert.strictEqual(lessons.length, 1);
    assert.strictEqual(lessons[0].id, "les_fresh");
  });

  // SAFETY & ATOMIC ROLLBACK TESTS
  test("24. Validation failure does not modify storage", async () => {
    const catsBefore = await getCategories({ includeInactive: true });

    const invalidDataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [{ id: "cat_will_fail", name: "ไม่ควรถูกเขียน", order: 1 }],
      lessons: [
        {
          id: "les_broken",
          categoryId: "non_existent_category", // Relational error
          word: "พัง",
          description: "...",
          gestureType: "dynamic",
          order: 1,
        },
      ],
      references: [],
    };

    const res = await importDatasetFromJson(invalidDataset, { mode: "replace" });
    assert.strictEqual(res.validation.isValid, false);

    const catsAfter = await getCategories({ includeInactive: true });
    assert.strictEqual(catsAfter.length, catsBefore.length);
    assert.ok(!catsAfter.some((c) => c.id === "cat_will_fail"));
  });

  test("25. CRITICAL DATA SAFETY: Execution error triggers Atomic Rollback without partial import", async () => {
    const initialCats = await getCategories({ includeInactive: true });
    const initialLessons = await getLessons({ includeInactive: true });

    // Mock an import plan where category is created, but subsequent lesson throws an error during execution
    const faultyPlan = {
      mode: "merge" as const,
      duplicateStrategy: "overwrite" as const,
      categories: [
        {
          action: "create" as const,
          item: { id: "cat_temp_safety", name: "หมวดทดสอบความปลอดภัย", order: 99 },
        },
      ],
      lessons: [
        {
          action: "create" as const,
          item: {
            id: "les_broken_execution",
            categoryId: "non_existent_category_ghost", // Will cause addLesson to throw!
            word: "คำทดสอบ",
            description: "...",
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
        await executeImport(faultyPlan);
      },
      /การนำเข้าล้มเหลว และระบบได้ Rollback/
    );

    // Verify storage has rolled back to original state completely
    const catsAfter = await getCategories({ includeInactive: true });
    assert.strictEqual(catsAfter.length, initialCats.length);
    assert.ok(!catsAfter.some((c) => c.id === "cat_temp_safety"));

    const lessonsAfter = await getLessons({ includeInactive: true });
    assert.strictEqual(lessonsAfter.length, initialLessons.length);
    assert.ok(!lessonsAfter.some((l) => l.id === "les_broken_execution"));
  });


  test("26. Input dataset is not mutated by validation or import", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    const originalJson = JSON.stringify(pkg);

    await validateDataset(pkg);
    await createImportPlan(pkg);

    assert.strictEqual(JSON.stringify(pkg), originalJson);
  });

  test("27. Import summary counts are accurate", async () => {
    const dataset: TSLDatasetPackage = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appName: "Thai Sign Language AI Platform",
      categories: [
        { id: "cat_sum_1", name: "Cat 1", order: 1 },
        { id: "cat_sum_2", name: "Cat 2", order: 2 },
      ],
      lessons: [
        {
          id: "les_sum_1",
          categoryId: "cat_sum_1",
          word: "W1",
          description: "",
          gestureType: "dynamic",
          order: 1,
        },
      ],
      references: [],
    };

    const res = await importDatasetFromJson(dataset, { mode: "merge" });
    assert.strictEqual(res.summary?.importedCategories, 2);
    assert.strictEqual(res.summary?.importedLessons, 1);
    assert.strictEqual(res.summary?.importedReferences, 0);
  });
});
