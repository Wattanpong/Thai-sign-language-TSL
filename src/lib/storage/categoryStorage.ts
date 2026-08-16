import { Category } from "@/types";
import { INITIAL_CATEGORIES } from "@/data/seedCategories";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchCategoriesFromSupabase,
  upsertCategoryToSupabase,
  deleteCategoryFromSupabase,
  syncCategoriesWithCloud,
} from "@/lib/supabase/supabaseCategoryStorage";

const CATEGORY_STORAGE_KEY = "tsl_categories";

// In-memory fallback for SSR / non-browser / test environments
let memoryCategories: Category[] = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
let hasInitialCloudSynced = false;

/**
 * Normalizes and parses raw stored category data
 */
function parseStoredCategories(data: string): Category[] {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed as Category[];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Helper to fetch all raw categories from localStorage or memory
 */
function loadAllCategories(): Category[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const data = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
      if (data) {
        const parsed = parseStoredCategories(data);
        if (parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback to memory
    }
  }
  return [...memoryCategories];
}

/**
 * Helper to persist categories to memory & localStorage
 */
function persistCategories(categories: Category[]): void {
  memoryCategories = [...categories];

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
    } catch {
      // quota or private mode fallback
    }
  }
}

/**
 * Normalizes a category ID/slug for search and comparison
 */
export function normalizeCategoryQueryId(id: string): string {
  if (!id) return "";
  try {
    return decodeURIComponent(id).trim().toLowerCase();
  } catch {
    return id.trim().toLowerCase();
  }
}

/**
 * Matches a category against a query ID (supports raw ID, URL-encoded string, Thai string, and name match)
 */
export function matchCategory(category: Category, queryId: string): boolean {
  if (!queryId || !category) return false;
  const rawQuery = queryId.trim();
  let decodedQuery = rawQuery;
  try {
    decodedQuery = decodeURIComponent(rawQuery).trim();
  } catch {
    // ignore
  }

  const normQuery = normalizeCategoryQueryId(queryId);
  const normId = normalizeCategoryQueryId(category.id);
  const normSlug = normalizeCategoryQueryId(category.slug || "");
  const normName = normalizeCategoryQueryId(category.name);

  return (
    category.id === rawQuery ||
    category.id === decodedQuery ||
    category.slug === rawQuery ||
    category.slug === decodedQuery ||
    normId === normQuery ||
    normSlug === normQuery ||
    normName === normQuery ||
    category.name.trim().toLowerCase() === rawQuery.toLowerCase() ||
    category.name.trim().toLowerCase() === decodedQuery.toLowerCase()
  );
}

/**
 * Generate a clean URL-safe ID/slug from category name
 */
export function generateCategorySlug(name: string): string {
  const trimmed = name.trim().toLowerCase();
  const latinSlug = trimmed
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (latinSlug && latinSlug.length >= 2) {
    return latinSlug;
  }

  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `category-${timestamp}-${randomSuffix}`;
}

/**
 * Retrieve all categories
 * Reconciles with Supabase Database and falls back to local cache or seed categories
 */
export async function getCategories(options?: {
  includeInactive?: boolean;
  forceCloudSync?: boolean;
}): Promise<Category[]> {
  let categories = loadAllCategories();

  // Cloud sync if configured and forced or initial
  if (isSupabaseConfigured() && (options?.forceCloudSync || !hasInitialCloudSynced)) {
    try {
      const cloudCats = await fetchCategoriesFromSupabase();
      if (cloudCats.length > 0) {
        categories = cloudCats;
        persistCategories(cloudCats);
        hasInitialCloudSynced = true;
      }
    } catch {
      // fallback on network error
    }
  }

  const includeInactive = options?.includeInactive ?? false;

  return categories
    .filter((cat) => includeInactive || cat.isActive !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Retrieve a single category by its ID (handles URL-encoded strings, Thai IDs, and cloud fallback)
 */
export async function getCategoryById(
  id: string,
  options?: { forceCloudSync?: boolean }
): Promise<Category | null> {
  if (!id) return null;

  let categories = await getCategories({
    includeInactive: true,
    forceCloudSync: options?.forceCloudSync,
  });

  let found = categories.find((cat) => matchCategory(cat, id));

  // If not found in local cache and Supabase is configured, force a sync from cloud once
  if (!found && isSupabaseConfigured() && !options?.forceCloudSync) {
    try {
      categories = await getCategories({ includeInactive: true, forceCloudSync: true });
      found = categories.find((cat) => matchCategory(cat, id));
    } catch {
      // fallback on network error
    }
  }

  return found ? { ...found } : null;
}

/**
 * Add a new category with complete validation
 */
export async function addCategory(
  data: Partial<Category> & { name: string }
): Promise<Category> {
  const name = data.name?.trim();
  if (!name) {
    throw new Error("ชื่อหมวดหมู่ห้ามว่าง");
  }

  const existing = loadAllCategories();

  // Check duplicate name
  const isDuplicateName = existing.some(
    (c) => c.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (isDuplicateName) {
    throw new Error(`หมวดหมู่ชื่อ "${name}" มีอยู่ในระบบแล้ว`);
  }

  // Determine ID & Slug
  let id = data.id?.trim();
  if (!id) {
    id = generateCategorySlug(name);
  }

  // Ensure unique ID
  let finalId = id;
  let counter = 1;
  while (existing.some((c) => c.id === finalId)) {
    finalId = `${id}-${counter}`;
    counter++;
  }

  const now = new Date().toISOString();
  const maxOrder = existing.reduce((max, c) => Math.max(max, c.order ?? 0), 0);

  const newCategory: Category = {
    id: finalId,
    name,
    slug: data.slug?.trim() || finalId,
    description: data.description?.trim() || "",
    icon: data.icon?.trim() || undefined,
    order: data.order !== undefined && !isNaN(data.order) ? Number(data.order) : maxOrder + 1,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdAt: now,
    updatedAt: now,
  };

  existing.push(newCategory);
  persistCategories(existing);

  if (isSupabaseConfigured()) {
    upsertCategoryToSupabase(newCategory).catch((err) => {
      console.warn("[categoryStorage] Cloud upsert warning:", err);
    });
  }

  return newCategory;
}

/**
 * Update an existing category
 */
export async function updateCategory(data: Category): Promise<Category> {
  const id = data.id?.trim();
  if (!id) {
    throw new Error("รหัสหมวดหมู่ไม่ถูกต้อง");
  }

  const name = data.name?.trim();
  if (!name) {
    throw new Error("ชื่อหมวดหมู่ห้ามว่าง");
  }

  const existing = loadAllCategories();
  const idx = existing.findIndex((c) => c.id === id);

  if (idx === -1) {
    throw new Error(`ไม่พบหมวดหมู่รหัส "${id}"`);
  }

  // Check duplicate name on other categories
  const isDuplicateName = existing.some(
    (c) => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (isDuplicateName) {
    throw new Error(`หมวดหมู่ชื่อ "${name}" มีอยู่ในระบบแล้ว`);
  }

  const now = new Date().toISOString();
  const current = existing[idx];

  const updated: Category = {
    ...current,
    name,
    slug: data.slug?.trim() || current.slug || current.id,
    description: data.description !== undefined ? data.description.trim() : current.description,
    icon: data.icon !== undefined ? data.icon.trim() : current.icon,
    order: data.order !== undefined && !isNaN(data.order) ? Number(data.order) : current.order,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : current.isActive,
    updatedAt: now,
  };

  existing[idx] = updated;
  persistCategories(existing);

  if (isSupabaseConfigured()) {
    upsertCategoryToSupabase(updated).catch((err) => {
      console.warn("[categoryStorage] Cloud update warning:", err);
    });
  }

  return updated;
}

/**
 * Check if a category can be deleted safely
 * Requires dynamic checking against lesson storage
 */
export async function canDeleteCategory(
  id: string,
  lessonChecker?: (categoryId: string) => Promise<number>
): Promise<{ canDelete: boolean; lessonCount: number; reason?: string }> {
  const category = await getCategoryById(id);
  if (!category) {
    return { canDelete: false, lessonCount: 0, reason: "ไม่พบหมวดหมู่ที่ระบุ" };
  }

  let lessonCount = 0;
  if (lessonChecker) {
    lessonCount = await lessonChecker(id);
  } else {
    // Dynamic import to avoid circular dependency
    const { getLessonsByCategoryId } = await import("./lessonStorage");
    const lessons = await getLessonsByCategoryId(id, true);
    lessonCount = lessons.length;
  }

  if (lessonCount > 0) {
    return {
      canDelete: false,
      lessonCount,
      reason: `ไม่สามารถลบหมวดหมู่ "${category.name}" ได้ เนื่องจากมีคำศัพท์อยู่ในหมวดนี้ ${lessonCount} คำ กรุณาลบหรือย้ายคำศัพท์ก่อน`,
    };
  }

  return { canDelete: true, lessonCount: 0 };
}

/**
 * Delete a category by ID
 * Guarded against categories containing lessons
 */
export async function deleteCategory(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const guard = await canDeleteCategory(id);
  if (!guard.canDelete) {
    return { success: false, error: guard.reason };
  }

  const existing = loadAllCategories();
  const remaining = existing.filter((c) => c.id !== id);

  if (remaining.length === existing.length) {
    return { success: false, error: `ไม่พบหมวดหมู่รหัส "${id}"` };
  }

  persistCategories(remaining);

  if (isSupabaseConfigured()) {
    deleteCategoryFromSupabase(id).catch((err) => {
      console.warn("[categoryStorage] Cloud delete warning:", err);
    });
  }

  return { success: true };
}

/**
 * Synchronize categories with Supabase Cloud
 */
export async function syncCategories(): Promise<{
  syncedToCloud: number;
  downloadedFromCloud: number;
  purgedFromLocal: number;
  allCategories: Category[];
  error?: string;
}> {
  const local = loadAllCategories();
  const syncResult = await syncCategoriesWithCloud(local, { authoritativeCloud: true });
  if (syncResult.allCategories.length > 0) {
    persistCategories(syncResult.allCategories);
  }
  return syncResult;
}

/**
 * Force push seed categories to Supabase Cloud
 */
export async function pushSeedCategoriesToCloud() {
  const { pushSeedToSupabase } = await import("@/lib/supabase/supabaseCategoryStorage");
  return pushSeedToSupabase();
}

/**
 * Reset categories to initial seed dataset
 */
export async function resetCategoriesToDefault(): Promise<void> {
  memoryCategories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(CATEGORY_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

