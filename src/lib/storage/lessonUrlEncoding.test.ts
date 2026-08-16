import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLessonQueryId,
  matchLesson,
  generateLessonSlug,
  getLessonById,
  addLesson,
  deleteLesson,
} from "./lessonStorage";
import {
  normalizeCategoryQueryId,
  matchCategory,
  generateCategorySlug,
  getCategoryById,
} from "./categoryStorage";
import { Lesson, Category } from "@/types";

test("Lesson & Category URL-Encoding & Thai Slug Resolution Test Suite", async (t) => {
  await t.test("1. normalizeLessonQueryId handles raw, URL-encoded, and whitespace strings", () => {
    assert.equal(normalizeLessonQueryId("hello"), "hello");
    assert.equal(normalizeLessonQueryId(" HELLO "), "hello");

    const thaiRaw = "สวัสดี-แบบเพื่อน";
    const thaiEncoded = encodeURIComponent(thaiRaw);
    assert.equal(normalizeLessonQueryId(thaiEncoded), thaiRaw.toLowerCase());
  });

  await t.test("2. matchLesson resolves raw ID, URL-encoded ID, and Thai word names", () => {
    const mockLesson: Lesson = {
      id: "สวัสดี-แบบเพื่อน",
      categoryId: "greeting-basic",
      word: "สวัสดีแบบเพื่อน",
      description: "คำอธิบาย",
      gestureType: "dynamic",
      order: 1,
      isActive: true,
    };

    const thaiEncoded = encodeURIComponent("สวัสดี-แบบเพื่อน");

    // Exact ID
    assert.equal(matchLesson(mockLesson, "สวัสดี-แบบเพื่อน"), true);
    // URL Encoded ID
    assert.equal(matchLesson(mockLesson, thaiEncoded), true);
    // Word Name
    assert.equal(matchLesson(mockLesson, "สวัสดีแบบเพื่อน"), true);
    // Case/whitespace variant
    assert.equal(matchLesson(mockLesson, "  สวัสดี-แบบเพื่อน  "), true);
    // Unrelated ID
    assert.equal(matchLesson(mockLesson, "ขอบคุณ"), false);
  });

  await t.test("3. generateLessonSlug & generateCategorySlug produce URL-safe identifiers", () => {
    // English word produces clean latin slug
    const latinLessonSlug = generateLessonSlug("Hello Friend");
    assert.equal(latinLessonSlug, "hello-friend");

    const latinCategorySlug = generateCategorySlug("Basic Greetings");
    assert.equal(latinCategorySlug, "basic-greetings");

    // Pure Thai word produces clean URL-safe ASCII slug (no %, no spaces, no special chars)
    const thaiLessonSlug = generateLessonSlug("สวัสดีแบบเพื่อน");
    assert.ok(thaiLessonSlug.startsWith("lesson-"));
    assert.ok(/^[a-z0-9-]+$/.test(thaiLessonSlug), "Generated slug must be strictly URL-safe ASCII");

    const thaiCategorySlug = generateCategorySlug("คำทักทาย");
    assert.ok(thaiCategorySlug.startsWith("category-"));
    assert.ok(/^[a-z0-9-]+$/.test(thaiCategorySlug), "Generated category slug must be strictly URL-safe ASCII");
  });

  await t.test("4. getLessonById successfully finds lesson with URL-encoded and Thai query strings", async () => {
    const thaiId = "สวัสดี-ทดสอบ-url-safe";
    const created = await addLesson({
      id: thaiId,
      categoryId: "greeting-basic",
      word: "สวัสดีทดสอบ",
      description: "ทดสอบการค้นหาด้วย URL Encoding",
      gestureType: "dynamic",
    });

    try {
      // Query with exact ID
      const byExact = await getLessonById(thaiId);
      assert.ok(byExact, "Must find lesson by exact Thai ID");
      assert.equal(byExact.id, thaiId);

      // Query with URL-encoded ID
      const encodedQuery = encodeURIComponent(thaiId);
      const byEncoded = await getLessonById(encodedQuery);
      assert.ok(byEncoded, "Must find lesson by URL-encoded Thai ID");
      assert.equal(byEncoded.id, thaiId);

      // Query with word name
      const byWord = await getLessonById("สวัสดีทดสอบ");
      assert.ok(byWord, "Must find lesson by Thai word name");
      assert.equal(byWord.id, thaiId);
    } finally {
      await deleteLesson(created.id);
    }
  });

  await t.test("5. getCategoryById successfully resolves URL-encoded and Thai categories", async () => {
    const mockCat: Category = {
      id: "greeting-basic",
      name: "ทักทาย พูดคุยเบื้องต้น",
      slug: "greeting-basic",
      order: 1,
      isActive: true,
    };

    assert.equal(normalizeCategoryQueryId("greeting-basic"), "greeting-basic");
    assert.equal(matchCategory(mockCat, "greeting-basic"), true);
    assert.equal(matchCategory(mockCat, encodeURIComponent("ทักทาย พูดคุยเบื้องต้น")), true);

    const category = await getCategoryById("greeting-basic");
    assert.ok(category, "Must find greeting-basic");

    // Also match by category name
    const byName = await getCategoryById("ทักทาย พูดคุยเบื้องต้น");
    assert.ok(byName, "Must find category by Thai name");
    assert.equal(byName.id, "greeting-basic");

    // Also match by URL encoded name
    const encodedName = encodeURIComponent("ทักทาย พูดคุยเบื้องต้น");
    const byEncodedName = await getCategoryById(encodedName);
    assert.ok(byEncodedName, "Must find category by URL-encoded Thai name");
    assert.equal(byEncodedName.id, "greeting-basic");
  });
});
