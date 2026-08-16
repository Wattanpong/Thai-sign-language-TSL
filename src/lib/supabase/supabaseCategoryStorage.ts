import { Category } from "@/types";
import { INITIAL_CATEGORIES } from "@/data/seedCategories";
import { getSupabaseClient, isSupabaseConfigured } from "./client";

export interface SupabaseCategoryRow {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  level: string;
}

export interface SyncCategoriesResult {
  syncedToCloud: number;
  downloadedFromCloud: number;
  purgedFromLocal: number;
  allCategories: Category[];
  error?: string;
}

/**
 * Converts domain Category object to Supabase database row matching schema:
 * categories: id (text), title (text), description (text), icon (text), level (text)
 */
export function categoryToRow(cat: Category): SupabaseCategoryRow {
  return {
    id: cat.id,
    title: cat.name,
    description: cat.description || "",
    icon: cat.icon || null,
    level: "beginner",
  };
}

/**
 * Converts Supabase database row to domain Category object (handles title/name, level, etc.)
 */
export function rowToCategory(row: Record<string, unknown>): Category {
  const name = String(row.title || row.name || row.id);
  const rawOrder = row.order ?? row.display_order ?? row.sort_order ?? row.seq ?? 0;
  return {
    id: String(row.id),
    name,
    slug: String(row.slug || row.id),
    description: row.description ? String(row.description) : "",
    icon: row.icon ? String(row.icon) : undefined,
    order: Number(rawOrder) || 1,
    isActive:
      row.is_active !== undefined
        ? Boolean(row.is_active)
        : row.isActive !== undefined
        ? Boolean(row.isActive)
        : true,
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString()),
  };
}

/**
 * Fetch all categories from Supabase Database
 */
export async function fetchCategoriesFromSupabase(): Promise<Category[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*");

    if (error) {
      console.warn("[Supabase Database] Error fetching categories:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const list = data.map((row) => rowToCategory(row as Record<string, unknown>));
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (err) {
    console.warn("[Supabase Database] Failed fetching categories:", err);
    return [];
  }
}

/**
 * Upserts a Category in Supabase Database
 */
export async function upsertCategoryToSupabase(
  category: Category
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Supabase client not configured" };
  }

  try {
    const row = categoryToRow(category);
    const { error } = await supabase
      .from("categories")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.warn(`[Supabase Database] Upsert category ${category.id} error:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown upsert error";
    console.warn(`[Supabase Database] Failed upserting category ${category.id}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Deletes a Category from Supabase Database
 */
export async function deleteCategoryFromSupabase(
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Supabase client not configured" };
  }

  try {
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      console.warn(`[Supabase Database] Delete category ${categoryId} error:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown delete error";
    console.warn(`[Supabase Database] Failed deleting category ${categoryId}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Pushes default seed categories to Supabase Database
 */
export async function pushSeedToSupabase(): Promise<{
  success: boolean;
  pushedCount: number;
  error?: string;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, pushedCount: 0, error: "Supabase client not configured" };
  }

  try {
    const rows = INITIAL_CATEGORIES.map(categoryToRow);
    const { error } = await supabase
      .from("categories")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      console.error("[Supabase Database] pushSeedToSupabase categories error:", error.message);
      return { success: false, pushedCount: 0, error: error.message };
    }

    return { success: true, pushedCount: INITIAL_CATEGORIES.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error pushing seed categories";
    console.error("[Supabase Database] pushSeedToSupabase categories failed:", msg);
    return { success: false, pushedCount: 0, error: msg };
  }
}

/**
 * Reconciles local categories with cloud categories (identifying stale items to purge and new ones)
 */
export function reconcileCategoriesWithCloud(
  localCategories: Category[],
  cloudCategories: Category[]
): {
  reconciled: Category[];
  purgedCount: number;
  downloadedCount: number;
} {
  const cloudIdMap = new Map(cloudCategories.map((c) => [c.id, c]));
  const localIdSet = new Set(localCategories.map((c) => c.id));

  let purgedCount = 0;
  for (const local of localCategories) {
    if (!cloudIdMap.has(local.id)) {
      purgedCount++;
    }
  }

  let downloadedCount = 0;
  for (const cloud of cloudCategories) {
    if (!localIdSet.has(cloud.id)) {
      downloadedCount++;
    }
  }

  return {
    reconciled: cloudCategories,
    purgedCount,
    downloadedCount,
  };
}

/**
 * Full Sync of Categories with Supabase Cloud
 */
export async function syncCategoriesWithCloud(
  localCategories: Category[],
  options: { authoritativeCloud?: boolean } = { authoritativeCloud: true }
): Promise<SyncCategoriesResult> {
  if (!isSupabaseConfigured()) {
    return {
      syncedToCloud: 0,
      downloadedFromCloud: 0,
      purgedFromLocal: 0,
      allCategories: localCategories,
    };
  }

  try {
    let cloudCategories = await fetchCategoriesFromSupabase();

    // If cloud is empty, automatically push seed/local categories to populate database
    if (cloudCategories.length === 0) {
      const itemsToPush = localCategories.length > 0 ? localCategories : INITIAL_CATEGORIES;
      const supabase = getSupabaseClient();
      if (supabase) {
        const rows = itemsToPush.map(categoryToRow);
        const { error } = await supabase.from("categories").upsert(rows, { onConflict: "id" });
        if (error) {
          return {
            syncedToCloud: 0,
            downloadedFromCloud: 0,
            purgedFromLocal: 0,
            allCategories: localCategories,
            error: error.message,
          };
        }
        cloudCategories = await fetchCategoriesFromSupabase();
        return {
          syncedToCloud: itemsToPush.length,
          downloadedFromCloud: 0,
          purgedFromLocal: 0,
          allCategories: cloudCategories.length > 0 ? cloudCategories : itemsToPush,
        };
      }
    }

    if (options.authoritativeCloud && cloudCategories.length > 0) {
      const { reconciled, purgedCount, downloadedCount } = reconcileCategoriesWithCloud(
        localCategories,
        cloudCategories
      );

      return {
        syncedToCloud: 0,
        downloadedFromCloud: downloadedCount,
        purgedFromLocal: purgedCount,
        allCategories: reconciled,
      };
    } else {
      // Two-way sync: push missing local, pull missing cloud
      const cloudIds = new Set(cloudCategories.map((c) => c.id));
      let uploadCount = 0;
      for (const local of localCategories) {
        if (!cloudIds.has(local.id)) {
          const res = await upsertCategoryToSupabase(local);
          if (res.success) {
            uploadCount++;
          } else if (res.error) {
            return {
              syncedToCloud: uploadCount,
              downloadedFromCloud: 0,
              purgedFromLocal: 0,
              allCategories: localCategories,
              error: res.error,
            };
          }
        }
      }

      const localIds = new Set(localCategories.map((c) => c.id));
      let downloadCount = 0;
      const mergedList = [...localCategories];

      for (const cloud of cloudCategories) {
        if (!localIds.has(cloud.id)) {
          mergedList.push(cloud);
          downloadCount++;
        }
      }

      return {
        syncedToCloud: uploadCount,
        downloadedFromCloud: downloadCount,
        purgedFromLocal: 0,
        allCategories: mergedList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Category sync failed";
    console.warn("[Supabase Database] Category sync failed:", errorMsg);
    return {
      syncedToCloud: 0,
      downloadedFromCloud: 0,
      purgedFromLocal: 0,
      allCategories: localCategories,
      error: errorMsg,
    };
  }
}
