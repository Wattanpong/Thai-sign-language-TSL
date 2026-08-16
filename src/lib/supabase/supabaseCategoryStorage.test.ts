import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryToRow,
  rowToCategory,
  fetchCategoriesFromSupabase,
  upsertCategoryToSupabase,
  deleteCategoryFromSupabase,
  reconcileCategoriesWithCloud,
  syncCategoriesWithCloud,
} from "./supabaseCategoryStorage";
import { Category } from "@/types";
import { getCategories } from "@/lib/storage/categoryStorage";

test("Supabase Category Database Storage Integration Test Suite", async (t) => {
  await t.test("1. categoryToRow and rowToCategory serialization", () => {
    const category: Category = {
      id: "cat_test",
      name: "หมวดทดสอบ",
      slug: "cat-test",
      description: "คำอธิบายหมวดทดสอบ",
      icon: "👋",
      order: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const row = categoryToRow(category);
    assert.equal(row.id, "cat_test");
    assert.equal(row.name, "หมวดทดสอบ");
    assert.equal(row.is_active, true);

    const backToCat = rowToCategory(row as unknown as Record<string, unknown>);
    assert.equal(backToCat.id, category.id);
    assert.equal(backToCat.name, category.name);
    assert.equal(backToCat.isActive, true);
  });

  await t.test("2. Unconfigured environment handles fetch, upsert, and delete gracefully", async () => {
    const mockCat: Category = {
      id: "cat_unconf",
      name: "ทดสอบ",
      slug: "cat-unconf",
      order: 1,
      isActive: true,
    };

    const fetchRes = await fetchCategoriesFromSupabase();
    assert.ok(Array.isArray(fetchRes));

    const upsertRes = await upsertCategoryToSupabase(mockCat);
    assert.ok(typeof upsertRes.success === "boolean");

    const deleteRes = await deleteCategoryFromSupabase("cat_unconf");
    assert.ok(typeof deleteRes.success === "boolean");
  });

  await t.test("3. reconcileCategoriesWithCloud identifies purged and new categories", () => {
    const localCats: Category[] = [
      { id: "c1", name: "หมวด 1", slug: "c1", order: 1, isActive: true },
      { id: "c2_stale", name: "หมวด 2", slug: "c2", order: 2, isActive: true },
    ];

    const cloudCats: Category[] = [
      { id: "c1", name: "หมวด 1", slug: "c1", order: 1, isActive: true },
      { id: "c3_new", name: "หมวด 3", slug: "c3", order: 3, isActive: true },
    ];

    const { reconciled, purgedCount, downloadedCount } = reconcileCategoriesWithCloud(
      localCats,
      cloudCats
    );

    assert.equal(purgedCount, 1, "Must detect 1 stale category (c2_stale)");
    assert.equal(downloadedCount, 1, "Must detect 1 new category (c3_new)");
    assert.equal(reconciled.length, 2);
    assert.ok(!reconciled.some((c) => c.id === "c2_stale"));
    assert.ok(reconciled.some((c) => c.id === "c1"));
    assert.ok(reconciled.some((c) => c.id === "c3_new"));
  });

  await t.test("4. syncCategoriesWithCloud returns local categories when offline", async () => {
    const localCats: Category[] = [
      { id: "c_local", name: "Local", slug: "c-local", order: 1, isActive: true },
    ];

    const syncRes = await syncCategoriesWithCloud(localCats);
    assert.ok(syncRes.allCategories.length >= 1);
  });

  await t.test("5. getCategories falls back to initial seed categories", async () => {
    const categories = await getCategories();
    assert.ok(categories.length > 0, "Must return initial categories");
    assert.ok(categories.some((c) => c.id === "greeting-basic"));
  });
});
