import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import {
  exportDataset,
  exportDatasetToJson,
  generateDatasetFilename,
  validateExportConsistency,
  sortDatasetItems,
  DATASET_VERSION,
  APP_NAME,
} from "./datasetExportService";
import {
  addCategory,
  resetCategoriesToDefault,
} from "./categoryStorage";
import {
  addLesson,
  resetLessonsToDefault,
} from "./lessonStorage";
import {
  addReference,
  clearReferences,
} from "./referenceStorage";
import { Category, Lesson, ReferenceGesture } from "@/types";

describe("STEP 8B.4 — Dataset Export Service Test Suite", () => {
  beforeEach(async () => {
    await resetCategoriesToDefault();
    await resetLessonsToDefault();
    await clearReferences();
  });

  test("1. exportDataset returns valid TSLDatasetPackage with correct schema & appName", async () => {
    const pkg = await exportDataset();

    assert.ok(pkg, "Package must exist");
    assert.strictEqual(pkg.version, DATASET_VERSION);
    assert.strictEqual(pkg.appName, APP_NAME);
    assert.ok(pkg.$schema, "Schema URL must exist");
    assert.ok(Array.isArray(pkg.categories), "Categories must be an array");
    assert.ok(Array.isArray(pkg.lessons), "Lessons must be an array");
    assert.ok(Array.isArray(pkg.references), "References must be an array");
    assert.ok(pkg.metadata, "Metadata must exist");
  });

  test("2. Categories exported correctly with all attributes", async () => {
    const pkg = await exportDataset();
    assert.ok(pkg.categories.length > 0);

    const firstCat = pkg.categories[0];
    assert.ok(firstCat.id);
    assert.ok(firstCat.name);
    assert.strictEqual(typeof firstCat.order, "number");
  });

  test("3. Lessons exported correctly preserving categoryId and gestureType", async () => {
    const pkg = await exportDataset();
    assert.ok(pkg.lessons.length > 0);

    const hello = pkg.lessons.find((l) => l.id === "hello");
    assert.ok(hello);
    assert.strictEqual(hello?.word, "สวัสดี");
    assert.strictEqual(hello?.categoryId, "greeting-basic");
    assert.strictEqual(hello?.gestureType, "dynamic");
    assert.strictEqual(hello?.difficulty, "beginner");
  });

  test("4. References exported correctly with frames and landmarks", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    assert.ok(pkg.references.length > 0);

    const ref = pkg.references[0];
    assert.ok(ref.id);
    assert.ok(ref.lessonId);
    assert.ok(Array.isArray(ref.frames));
  });

  test("5. includeSeeds=true includes seed references", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    assert.ok(pkg.references.length >= 1, "Must contain seed reference");
    const seedRef = pkg.references.find((r) => r.id === "ref_seed_hello_primary");
    assert.ok(seedRef, "Seed hello reference must exist");
  });

  test("6. includeSeeds=false excludes seeds when no custom recording exists", async () => {
    const pkg = await exportDataset({ includeSeeds: false });
    assert.strictEqual(pkg.references.length, 0, "No custom reference recorded yet");
  });

  test("7. Metadata counts match actual array lengths accurately", async () => {
    const pkg = await exportDataset({ includeSeeds: true });
    assert.strictEqual(pkg.metadata?.totalCategories, pkg.categories.length);
    assert.strictEqual(pkg.metadata?.totalLessons, pkg.lessons.length);
    assert.strictEqual(pkg.metadata?.totalReferences, pkg.references.length);
  });

  test("8. Dataset version is strictly 1.0.0", async () => {
    const pkg = await exportDataset();
    assert.strictEqual(pkg.version, "1.0.0");
  });

  test("9. exportedAt is a valid ISO 8601 timestamp", async () => {
    const pkg = await exportDataset();
    assert.ok(pkg.exportedAt);
    const date = new Date(pkg.exportedAt);
    assert.strictEqual(date.toISOString(), pkg.exportedAt);
  });

  test("10. JSON serialization: exportDatasetToJson produces valid parseable JSON", async () => {
    const jsonStr = await exportDatasetToJson({ pretty: true, notes: "Export Test" });
    assert.strictEqual(typeof jsonStr, "string");

    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(parsed.version, "1.0.0");
    assert.strictEqual(parsed.metadata.notes, "Export Test");
    assert.ok(parsed.categories.length > 0);
  });

  test("11. Duplicate ID validation throws clear error", () => {
    const duplicateCats: Category[] = [
      { id: "dup-id", name: "หมวด 1", order: 1 },
      { id: "dup-id", name: "หมวด 2", order: 2 },
    ];

    assert.throws(
      () => {
        validateExportConsistency(duplicateCats, [], []);
      },
      /พบ Category ID ซ้ำกันในระบบ/
    );
  });

  test("12. Foreign key inconsistency throws clear error", () => {
    const cats: Category[] = [{ id: "cat-1", name: "หมวด 1", order: 1 }];
    const invalidLessons: Lesson[] = [
      {
        id: "l-1",
        categoryId: "non-existent-category",
        word: "คำทดสอบ",
        description: "...",
        gestureType: "dynamic",
        order: 1,
      },
    ];

    assert.throws(
      () => {
        validateExportConsistency(cats, invalidLessons, []);
      },
      /อ้างอิง Category ID "non-existent-category" ที่ไม่มีอยู่จริง/
    );

    const validLessons: Lesson[] = [
      {
        id: "l-1",
        categoryId: "cat-1",
        word: "คำ 1",
        description: "...",
        gestureType: "dynamic",
        order: 1,
      },
    ];
    const invalidRefs: ReferenceGesture[] = [
      {
        id: "r-1",
        lessonId: "non-existent-lesson",
        word: "คำ 1",
        createdAt: "2026-01-01T00:00:00Z",
        durationMs: 1000,
        frameCount: 1,
        frames: [],
      },
    ];

    assert.throws(
      () => {
        validateExportConsistency(cats, validLessons, invalidRefs);
      },
      /อ้างอิง Lesson ID "non-existent-lesson" ที่ไม่มีอยู่จริง/
    );
  });

  test("13. Export does not mutate source data", async () => {
    const newCat = await addCategory({ name: "หมวดหมู่ทดสอบ Immutability" });
    const newLesson = await addLesson({
      word: "คำศัพท์ทดสอบ Immutability",
      categoryId: newCat.id,
      description: "...",
    });

    const customRef: ReferenceGesture = {
      id: "ref_immutability_test",
      lessonId: newLesson.id,
      word: newLesson.word,
      createdAt: new Date().toISOString(),
      durationMs: 1000,
      frameCount: 1,
      frames: [{ timestampMs: 0, hands: [], pose: [] }],
      isPrimary: true,
      qualityScore: 90,
      qualityLevel: "good",
    };
    await addReference(customRef);

    const refJsonBefore = JSON.stringify(customRef);

    const pkg = await exportDataset({ includeSeeds: false });

    // Mutate exported object
    pkg.categories[0].name = "CHANGED";
    pkg.lessons[0].word = "CHANGED";
    pkg.references[0].word = "CHANGED";

    // Verify source is intact
    assert.strictEqual(JSON.stringify(customRef), refJsonBefore);
  });

  test("14. Deterministic ordering: Exporting data produces sorted consistent output", () => {
    const rawCategories: Category[] = [
      { id: "cat-z", name: "Z", order: 2 },
      { id: "cat-a", name: "A", order: 1 },
      { id: "cat-b", name: "B", order: 1 },
    ];

    const rawLessons: Lesson[] = [
      { id: "les-2", categoryId: "cat-z", word: "Z2", description: "", gestureType: "dynamic", order: 1 },
      { id: "les-1", categoryId: "cat-a", word: "A1", description: "", gestureType: "dynamic", order: 2 },
      { id: "les-0", categoryId: "cat-a", word: "A0", description: "", gestureType: "dynamic", order: 1 },
    ];

    const rawReferences: ReferenceGesture[] = [
      { id: "r-2", lessonId: "les-1", word: "A1", createdAt: "", durationMs: 0, frameCount: 0, frames: [], qualityScore: 50 },
      { id: "r-1", lessonId: "les-1", word: "A1", createdAt: "", durationMs: 0, frameCount: 0, frames: [], isPrimary: true, qualityScore: 80 },
      { id: "r-0", lessonId: "les-0", word: "A0", createdAt: "", durationMs: 0, frameCount: 0, frames: [], qualityScore: 90 },
    ];

    const sorted = sortDatasetItems(rawCategories, rawLessons, rawReferences);

    // Categories: order 1 ("cat-a", "cat-b"), then order 2 ("cat-z")
    assert.strictEqual(sorted.sortedCategories[0].id, "cat-a");
    assert.strictEqual(sorted.sortedCategories[1].id, "cat-b");
    assert.strictEqual(sorted.sortedCategories[2].id, "cat-z");

    // Lessons: cat-a first (order 1 "les-0", then order 2 "les-1"), then cat-z ("les-2")
    assert.strictEqual(sorted.sortedLessons[0].id, "les-0");
    assert.strictEqual(sorted.sortedLessons[1].id, "les-1");
    assert.strictEqual(sorted.sortedLessons[2].id, "les-2");

    // References: les-0 first ("r-0"), then les-1 (primary "r-1", then "r-2")
    assert.strictEqual(sorted.sortedReferences[0].id, "r-0");
    assert.strictEqual(sorted.sortedReferences[1].id, "r-1");
    assert.strictEqual(sorted.sortedReferences[2].id, "r-2");
  });

  test("15. generateDatasetFilename generates valid formatted filename", () => {
    const filename = generateDatasetFilename();
    assert.ok(filename.startsWith("tsl-dataset-"));
    assert.ok(filename.endsWith(".json"));
  });
});
