import { Category } from "@/types";
import { getSupabaseClient, isSupabaseConfigured } from "./client";

export interface SupabaseCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string | null;
  order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Converts domain Category object to Supabase database row
 */
export function categoryToRow(cat: Category): SupabaseCategoryRow {
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug || cat.id,
    description: cat.description || "",
    icon: cat.icon || null,
    order: cat.order ?? 0,
    is_active: cat.isActive !== false,
    created_at: cat.createdAt || new Date().toISOString(),
    updated_at: cat.updatedAt || new Date().toISOString(),
  };
}

/**
 * Converts Supabase database row to domain Category object (handles snake_case and camelCase)
 */
export function rowToCategory(row: Record<string, unknown>): Category {
  const rawOrder = row.order ?? row.display_order ?? row.sort_order ?? row.seq ?? 0;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug || row.id),
    description: row.description ? String(row.description) : "",
    icon: row.icon ? String(row.icon) : undefined,
    order: Number(rawOrder) || 0,
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
): Promise<{
  syncedToCloud: number;
  downloadedFromCloud: number;
  purgedFromLocal: number;
  allCategories: Category[];
}> {
  if (!isSupabaseConfigured()) {
    return {
      syncedToCloud: 0,
      downloadedFromCloud: 0,
      purgedFromLocal: 0,
      allCategories: localCategories,
    };
  }

  try {
    const cloudCategories = await fetchCategoriesFromSupabase();

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
          if (res.success) uploadCount++;
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
    console.warn("[Supabase Database] Category sync failed:", err);
    return {
      syncedToCloud: 0,
      downloadedFromCloud: 0,
      purgedFromLocal: 0,
      allCategories: localCategories,
    };
  }
}
