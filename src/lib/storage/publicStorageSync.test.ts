import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import {
  addCategory,
  resetCategoriesToDefault,
} from "./categoryStorage";
import {
  addLesson,
  updateLesson,
  deleteLesson,
  resetLessonsToDefault,
} from "./lessonStorage";
import { getCategories, getCategoryById } from "@/data/categories";
import {
  getLessons,
  getLessonById,
  getLessonsByCategory,
  getLessonsByCategoryId,
} from "@/data/lessons";
import { INITIAL_CATEGORIES } from "@/data/seedCategories";
import { INITIAL_LESSONS } from "@/data/seedLessons";


describe("STEP 8C — Public UI & Storage Layer Synchronization Test Suite", () => {
  beforeEach(async () => {
    await resetCategoriesToDefault();
    await resetLessonsToDefault();
  });

  test("1. Default State: Public UI APIs return original seed data on clean initialization", async () => {
    const categories = await getCategories();
    const lessons = await getLessons();

    assert.strictEqual(categories.length, INITIAL_CATEGORIES.length);
    assert.strictEqual(lessons.length, INITIAL_LESSONS.length);
    assert.strictEqual(categories[0].id, "greeting-basic");
    assert.strictEqual(lessons[0].id, "hello");
  });

  test("2. Admin Adds Category -> Public UI immediately retrieves new category", async () => {
    const newCat = await addCategory({
      name: "หมวดอาหารและเครื่องดื่ม",
      description: "คำศัพท์เกี่ยวกับอาหารและเครื่องดื่ม",
      order: 10,
    });

    // Public UI helper from @/data/categories
    const publicCategories = await getCategories();
    assert.strictEqual(publicCategories.length, INITIAL_CATEGORIES.length + 1);

    const foundPublic = await getCategoryById(newCat.id);
    assert.ok(foundPublic);
    assert.strictEqual(foundPublic?.name, "หมวดอาหารและเครื่องดื่ม");
  });

  test("3. Admin Adds Lesson -> Public UI immediately retrieves new lesson and category relationship", async () => {
    const customLesson = await addLesson({
      categoryId: "greeting-basic",
      word: "ราตรีสวัสดิ์",
      description: "ทำท่าโบกมือและเอียงศีรษะแนบฝ่ามือ",
      gestureType: "dynamic",
      difficulty: "beginner",
    });

    // Public UI helper from @/data/lessons
    const publicLessons = await getLessons();
    assert.strictEqual(publicLessons.length, INITIAL_LESSONS.length + 1);

    const foundLesson = await getLessonById(customLesson.id);
    assert.ok(foundLesson);
    assert.strictEqual(foundLesson?.word, "ราตรีสวัสดิ์");
    assert.strictEqual(foundLesson?.categoryId, "greeting-basic");

    // Category filter in Public UI
    const categoryLessons = await getLessonsByCategoryId("greeting-basic");
    assert.ok(categoryLessons.some((l) => l.id === customLesson.id));

    const categoryLessonsAlias = await getLessonsByCategory("greeting-basic");
    assert.ok(categoryLessonsAlias.some((l) => l.id === customLesson.id));
  });

  test("4. Admin Updates Lesson -> Public UI reflects updated word and description", async () => {
    const created = await addLesson({
      categoryId: "greeting-basic",
      word: "สวัสดีตอนเช้า",
      description: "คำทักทายยามเช้า",
      gestureType: "static",
      difficulty: "beginner",
    });

    await updateLesson({
      ...created,
      word: "อรุณสวัสดิ์",
      description: "คำทักทายยามเช้าแบบทางการ",
      gestureType: "dynamic",
    });

    const publicLesson = await getLessonById(created.id);
    assert.ok(publicLesson);
    assert.strictEqual(publicLesson?.word, "อรุณสวัสดิ์");
    assert.strictEqual(publicLesson?.description, "คำทักทายยามเช้าแบบทางการ");
    assert.strictEqual(publicLesson?.gestureType, "dynamic");
  });

  test("5. Admin Deletes Lesson -> Public UI removes lesson from catalog & dictionary", async () => {
    const created = await addLesson({
      categoryId: "greeting-basic",
      word: "ยินดีที่ได้รู้จัก",
      description: "ทักทายเมื่อพบกันครั้งแรก",
      gestureType: "dynamic",
      difficulty: "beginner",
    });

    let publicLessons = await getLessons();
    assert.ok(publicLessons.some((l) => l.id === created.id));

    await deleteLesson(created.id);

    publicLessons = await getLessons();
    assert.strictEqual(publicLessons.some((l) => l.id === created.id), false);

    const found = await getLessonById(created.id);
    assert.strictEqual(found, null);
  });

  test("6. Category + Lesson Cascading & Consistency across Storage and Public UI Layer", async () => {
    const cat = await addCategory({
      name: "การเดินทางและยานพาหนะ",
      description: "หมวดคำศัพท์เกี่ยวกับการเดินทาง",
      order: 5,
    });

    await addLesson({
      categoryId: cat.id,
      word: "รถยนต์",
      description: "ทำท่าจับพวงมาลัยหมุนซ้ายขวา",
      gestureType: "dynamic",
      difficulty: "beginner",
    });

    await addLesson({
      categoryId: cat.id,
      word: "เครื่องบิน",
      description: "กางนิ้วโป้งและก้อยเลียนแบบปีกเครื่องบิน",
      gestureType: "dynamic",
      difficulty: "intermediate",
    });


    const catLessons = await getLessonsByCategoryId(cat.id);
    assert.strictEqual(catLessons.length, 2);
    assert.deepStrictEqual(
      catLessons.map((l) => l.word),
      ["รถยนต์", "เครื่องบิน"]
    );
  });

  test("7. Practice Category Tabs: Simulates 30+ lessons across 4-5 categories with accurate grouping & tabs", async () => {
    // Create 4 categories
    const catAlphabets = await addCategory({ name: "ตัวอักษร ก-ฮ", order: 2 });
    const catNumbers = await addCategory({ name: "ตัวเลข 0-9", order: 3 });
    const catFeelings = await addCategory({ name: "อารมณ์และความรู้สึก", order: 4 });
    const catFamily = await addCategory({ name: "ครอบครัว", order: 5 });

    // Seed 8 lessons in Alphabets
    for (let i = 1; i <= 8; i++) {
      await addLesson({
        categoryId: catAlphabets.id,
        word: `อักษร_${i}`,
        description: `ท่าทางตัวอักษร ${i}`,
        gestureType: "static",
      });
    }

    // Seed 10 lessons in Numbers
    for (let i = 0; i <= 9; i++) {
      await addLesson({
        categoryId: catNumbers.id,
        word: `ตัวเลข_${i}`,
        description: `ท่าทางตัวเลข ${i}`,
        gestureType: "static",
      });
    }

    // Seed 6 lessons in Feelings
    for (let i = 1; i <= 6; i++) {
      await addLesson({
        categoryId: catFeelings.id,
        word: `อารมณ์_${i}`,
        description: `ท่าทางอารมณ์ ${i}`,
        gestureType: "dynamic",
      });
    }

    // Seed 5 lessons in Family
    for (let i = 1; i <= 5; i++) {
      await addLesson({
        categoryId: catFamily.id,
        word: `ครอบครัว_${i}`,
        description: `ท่าทางครอบครัว ${i}`,
        gestureType: "dynamic",
      });
    }

    const allCats = await getCategories();
    const allLessons = await getLessons();

    // Total categories = 1 (seed) + 4 (new) = 5
    assert.strictEqual(allCats.length, 5);
    // Total lessons = 7 (seed) + 8 + 10 + 6 + 5 = 36
    assert.strictEqual(allLessons.length, 36);

    // Verify per-category counts
    const greetingCount = allLessons.filter((l) => l.categoryId === "greeting-basic").length;
    const alphaCount = allLessons.filter((l) => l.categoryId === catAlphabets.id).length;
    const numCount = allLessons.filter((l) => l.categoryId === catNumbers.id).length;
    const feelCount = allLessons.filter((l) => l.categoryId === catFeelings.id).length;
    const familyCount = allLessons.filter((l) => l.categoryId === catFamily.id).length;

    assert.strictEqual(greetingCount, 7);
    assert.strictEqual(alphaCount, 8);
    assert.strictEqual(numCount, 10);
    assert.strictEqual(feelCount, 6);
    assert.strictEqual(familyCount, 5);
  });
});

