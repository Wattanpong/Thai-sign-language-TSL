import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import {
  getCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  deleteCategory,
  canDeleteCategory,
  resetCategoriesToDefault,
} from "./categoryStorage";
import {
  getLessons,
  getLessonById,
  getLessonsByCategoryId,
  addLesson,
  updateLesson,
  deleteLesson,
  resetLessonsToDefault,
} from "./lessonStorage";
import {
  getReferencesByLessonId,
  addReference,
  clearReferences,
} from "./referenceStorage";
import { INITIAL_CATEGORIES } from "@/data/seedCategories";
import { INITIAL_LESSONS } from "@/data/seedLessons";
import { ReferenceGesture } from "@/types";

describe("STEP 8A — Content Management System (CMS) Test Suite", () => {
  beforeEach(async () => {
    await resetCategoriesToDefault();
    await resetLessonsToDefault();
    await clearReferences();
  });

  // -------------------------------------------------------------
  // Category Tests
  // -------------------------------------------------------------
  describe("Category Management", () => {
    test("1. Create category: Successfully creates a new category with generated slug & metadata", async () => {
      const created = await addCategory({
        name: "ครอบครัวและบุคคล",
        description: "คำศัพท์เกี่ยวกับสมาชิกในครอบครัวและบุคคลทั่วไป",
        order: 2,
      });

      assert.strictEqual(created.name, "ครอบครัวและบุคคล");
      assert.ok(created.id, "Category must have an ID");
      assert.strictEqual(created.order, 2);
      assert.strictEqual(created.isActive, true);
      assert.ok(created.createdAt, "createdAt timestamp must exist");
      assert.ok(created.updatedAt, "updatedAt timestamp must exist");

      const fetched = await getCategoryById(created.id);
      assert.deepStrictEqual(fetched?.name, "ครอบครัวและบุคคล");
    });

    test("2. Read category: Retrieves list of categories sorted by order", async () => {
      await addCategory({ name: "หมวด B", order: 10 });
      await addCategory({ name: "หมวด A", order: 2 });

      const all = await getCategories();
      assert.ok(all.length >= 3);

      // Verify sorted order
      for (let i = 0; i < all.length - 1; i++) {
        assert.ok(
          (all[i].order ?? 0) <= (all[i + 1].order ?? 0),
          `Categories should be sorted by order: ${all[i].order} <= ${all[i + 1].order}`
        );
      }
    });

    test("3. Update category: Successfully updates existing category fields", async () => {
      const created = await addCategory({
        name: "อาหารและเครื่องดื่ม",
        description: "คำศัพท์หมวดอาหาร",
        order: 5,
      });

      const updated = await updateCategory({
        ...created,
        name: "อาหารและเครื่องดื่ม (ฉบับปรับปรุง)",
        description: "คำศัพท์หมวดอาหารและเครื่องดื่มในชีวิตประจำวัน",
        order: 6,
      });

      assert.strictEqual(updated.name, "อาหารและเครื่องดื่ม (ฉบับปรับปรุง)");
      assert.strictEqual(updated.description, "คำศัพท์หมวดอาหารและเครื่องดื่มในชีวิตประจำวัน");
      assert.strictEqual(updated.order, 6);

      const check = await getCategoryById(created.id);
      assert.strictEqual(check?.name, "อาหารและเครื่องดื่ม (ฉบับปรับปรุง)");
    });

    test("4. Delete category: Successfully deletes an empty category", async () => {
      const emptyCat = await addCategory({
        name: "หมวดหมู่ทดสอบลบ",
        description: "หมวดนี้ไม่มีบทเรียน",
      });

      const canDelete = await canDeleteCategory(emptyCat.id);
      assert.strictEqual(canDelete.canDelete, true);
      assert.strictEqual(canDelete.lessonCount, 0);

      const result = await deleteCategory(emptyCat.id);
      assert.strictEqual(result.success, true);

      const check = await getCategoryById(emptyCat.id);
      assert.strictEqual(check, null);
    });

    test("5. Duplicate category validation: Blocks duplicate names and invalid empty inputs", async () => {
      await addCategory({ name: "สีสันและธรรมชาติ" });

      // Duplicate name check (case-insensitive & trimmed)
      await assert.rejects(
        async () => {
          await addCategory({ name: "  สีสันและธรรมชาติ  " });
        },
        /มีอยู่ในระบบแล้ว/
      );

      // Empty name check
      await assert.rejects(
        async () => {
          await addCategory({ name: "   " });
        },
        /ชื่อหมวดหมู่ห้ามว่าง/
      );
    });
  });

  // -------------------------------------------------------------
  // Lesson Tests
  // -------------------------------------------------------------
  describe("Lesson & Vocabulary Management", () => {
    test("6. Create lesson: Successfully creates a new lesson under an existing category", async () => {
      const created = await addLesson({
        word: "พ่อ",
        categoryId: "greeting-basic",
        description: "ใช้นิ้วโป้งแตะที่คางหรือหน้าอก",
        gestureType: "dynamic",
        difficulty: "beginner",
        order: 10,
      });

      assert.strictEqual(created.word, "พ่อ");
      assert.strictEqual(created.categoryId, "greeting-basic");
      assert.strictEqual(created.gestureType, "dynamic");
      assert.strictEqual(created.difficulty, "beginner");
      assert.ok(created.id, "Lesson must have an ID");
      assert.ok(created.createdAt, "createdAt timestamp must exist");

      const fetched = await getLessonById(created.id);
      assert.strictEqual(fetched?.word, "พ่อ");
    });

    test("7. Read lesson: Retrieves all lessons and filters by category", async () => {
      const all = await getLessons();
      assert.ok(all.length >= 7, "Should have initial seed lessons");

      const greetingLessons = await getLessonsByCategoryId("greeting-basic");
      assert.ok(greetingLessons.length > 0);
      greetingLessons.forEach((l) => {
        assert.strictEqual(l.categoryId, "greeting-basic");
      });
    });

    test("8. Update lesson: Successfully updates lesson fields and maintains consistency", async () => {
      const lesson = await getLessonById("hello");
      assert.ok(lesson, "Hello lesson must exist");

      const updated = await updateLesson({
        ...lesson,
        description: "พนมมือระดับอกแล้วก้มศีรษะลงอย่างสุภาพและสง่างาม",
        difficulty: "intermediate",
      });

      assert.strictEqual(updated.description, "พนมมือระดับอกแล้วก้มศีรษะลงอย่างสุภาพและสง่างาม");
      assert.strictEqual(updated.difficulty, "intermediate");

      const check = await getLessonById("hello");
      assert.strictEqual(check?.description, "พนมมือระดับอกแล้วก้มศีรษะลงอย่างสุภาพและสง่างาม");
    });

    test("9. Delete lesson: Successfully removes lesson from storage", async () => {
      const tempLesson = await addLesson({
        word: "คำศัพท์ชั่วคราว",
        categoryId: "greeting-basic",
        description: "สำหรับทดสอบลบ",
      });

      const deleted = await deleteLesson(tempLesson.id);
      assert.strictEqual(deleted, true);

      const check = await getLessonById(tempLesson.id);
      assert.strictEqual(check, null);
    });

    test("10. Duplicate lesson validation: Blocks duplicate words and empty inputs", async () => {
      await assert.rejects(
        async () => {
          await addLesson({
            word: "สวัสดี", // already in seed
            categoryId: "greeting-basic",
          });
        },
        /มีอยู่ในระบบแล้ว/
      );

      await assert.rejects(
        async () => {
          await addLesson({
            word: "   ",
            categoryId: "greeting-basic",
          });
        },
        /คำศัพท์ห้ามว่าง/
      );
    });

    test("11. Category relation validation: Cannot delete category containing lessons; cannot add lesson to non-existent category", async () => {
      // 1. Guard against deleting category with existing lessons
      const canDelete = await canDeleteCategory("greeting-basic");
      assert.strictEqual(canDelete.canDelete, false);
      assert.ok(canDelete.lessonCount > 0);

      const deleteRes = await deleteCategory("greeting-basic");
      assert.strictEqual(deleteRes.success, false);
      assert.ok(deleteRes.error?.includes("ไม่สามารถลบหมวดหมู่"));

      // 2. Reject adding lesson to invalid category
      await assert.rejects(
        async () => {
          await addLesson({
            word: "คำทดสอบ",
            categoryId: "non-existent-cat-id",
            description: "...",
          });
        },
        /ไม่พบหมวดหมู่/
      );
    });
  });

  // -------------------------------------------------------------
  // Integration & Reference Compatibility Tests
  // -------------------------------------------------------------
  describe("Integration & Reference Compatibility", () => {
    test("12. Lesson + Reference compatibility: Multi-reference dataset connects seamlessly with created lessons", async () => {
      const newLesson = await addLesson({
        word: "ยินดี",
        categoryId: "greeting-basic",
        description: "ยิ้มพร้อมผายมือทั้งสองข้าง",
      });

      // Initially no custom references
      const initialRefs = await getReferencesByLessonId(newLesson.id);
      assert.strictEqual(initialRefs.length, 0);

      // Add a custom reference
      const dummyRef: ReferenceGesture = {
        id: `ref_${newLesson.id}_1`,
        lessonId: newLesson.id,
        word: newLesson.word,
        frames: [

          {
            timestampMs: 0,
            hands: [
              { handedness: "Right", landmarks: Array(21).fill({ x: 0.6, y: 0.5, z: 0 }) },
              { handedness: "Left", landmarks: Array(21).fill({ x: 0.4, y: 0.5, z: 0 }) },
            ],
            pose: Array(33).fill({ x: 0.5, y: 0.5, z: 0 }),
          },
          {
            timestampMs: 500,
            hands: [
              { handedness: "Right", landmarks: Array(21).fill({ x: 0.65, y: 0.45, z: 0 }) },
              { handedness: "Left", landmarks: Array(21).fill({ x: 0.35, y: 0.45, z: 0 }) },
            ],
            pose: Array(33).fill({ x: 0.5, y: 0.5, z: 0 }),
          },
          {
            timestampMs: 1000,
            hands: [
              { handedness: "Right", landmarks: Array(21).fill({ x: 0.7, y: 0.4, z: 0 }) },
              { handedness: "Left", landmarks: Array(21).fill({ x: 0.3, y: 0.4, z: 0 }) },
            ],
            pose: Array(33).fill({ x: 0.5, y: 0.5, z: 0 }),
          },
        ],
        durationMs: 1000,
        frameCount: 3,
        qualityScore: 90,
        qualityLevel: "good",
        isPrimary: true,
        createdAt: new Date().toISOString(),
      };

      await addReference(dummyRef);

      const refs = await getReferencesByLessonId(newLesson.id);
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].id, dummyRef.id);
      assert.strictEqual(refs[0].isPrimary, true);
    });

    test("13. Delete lesson cascade: Deleting a lesson clears its references and prevents orphan references", async () => {
      const lesson = await addLesson({
        word: "ลาก่อน",
        categoryId: "greeting-basic",
        description: "โบกมือซ้ายขวา",
      });

      const ref1: ReferenceGesture = {
        id: `ref_${lesson.id}_test`,
        lessonId: lesson.id,
        word: lesson.word,
        frames: [

          {
            timestampMs: 0,
            hands: [{ handedness: "Right", landmarks: Array(21).fill({ x: 0.5, y: 0.5, z: 0 }) }],
            pose: [],
          },
          {
            timestampMs: 500,
            hands: [{ handedness: "Right", landmarks: Array(21).fill({ x: 0.55, y: 0.5, z: 0 }) }],
            pose: [],
          },
          {
            timestampMs: 1000,
            hands: [{ handedness: "Right", landmarks: Array(21).fill({ x: 0.5, y: 0.5, z: 0 }) }],
            pose: [],
          },
        ],
        durationMs: 1000,
        frameCount: 3,
        qualityScore: 88,
        qualityLevel: "good",
        isPrimary: true,
        createdAt: new Date().toISOString(),
      };



      await addReference(ref1);
      const beforeDeleteRefs = await getReferencesByLessonId(lesson.id);
      assert.strictEqual(beforeDeleteRefs.length, 1);

      // Cascade Delete
      await deleteLesson(lesson.id);

      // Verify lesson is gone
      const lessonCheck = await getLessonById(lesson.id);
      assert.strictEqual(lessonCheck, null);

      // Verify references are also wiped (no orphan reference)
      const afterDeleteRefs = await getReferencesByLessonId(lesson.id);
      assert.strictEqual(afterDeleteRefs.length, 0);
    });

    test("14. Existing seed data remains compatible: Initial categories and lessons remain intact", async () => {
      const categories = await getCategories();
      const lessons = await getLessons();

      assert.strictEqual(categories.length, INITIAL_CATEGORIES.length);
      assert.strictEqual(lessons.length, INITIAL_LESSONS.length);

      const helloLesson = await getLessonById("hello");
      assert.ok(helloLesson);
      assert.strictEqual(helloLesson?.word, "สวัสดี");
      assert.strictEqual(helloLesson?.gestureType, "dynamic");
    });
  });
});
