import { Lesson, GestureType, DifficultyLevel } from "@/types";
import { getSupabaseClient, isSupabaseConfigured } from "./client";

export interface SupabaseLessonRow {
  id: string;
  category_id: string;
  word: string;
  description: string;
  gesture_type: string;
  difficulty: string;
  order: number;
  example?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Converts domain Lesson object to Supabase database row
 */
export function lessonToRow(lesson: Lesson): SupabaseLessonRow {
  return {
    id: lesson.id,
    category_id: lesson.categoryId,
    word: lesson.word,
    description: lesson.description || "",
    gesture_type: lesson.gestureType,
    difficulty: lesson.difficulty || "beginner",
    order: lesson.order ?? 0,
    example: lesson.example || null,
    is_active: lesson.isActive !== false,
    created_at: lesson.createdAt || new Date().toISOString(),
    updated_at: lesson.updatedAt || new Date().toISOString(),
  };
}

/**
 * Converts Supabase database row to domain Lesson object (handles snake_case and camelCase)
 */
export function rowToLesson(row: Record<string, unknown>): Lesson {
  const rawOrder = row.order ?? row.display_order ?? row.sort_order ?? row.seq ?? 0;
  return {
    id: String(row.id),
    categoryId: String(row.category_id || row.categoryId),
    word: String(row.word),
    description: row.description ? String(row.description) : "",
    gestureType: (row.gesture_type || row.gestureType || "dynamic") as GestureType,
    difficulty: (row.difficulty || "beginner") as DifficultyLevel,
    order: Number(rawOrder) || 0,
    example: row.example ? String(row.example) : undefined,
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
 * Fetch all lessons from Supabase Database
 */
export async function fetchLessonsFromSupabase(): Promise<Lesson[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("lessons")
      .select("*");

    if (error) {
      console.warn("[Supabase Database] Error fetching lessons:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const list = data.map((row) => rowToLesson(row as Record<string, unknown>));
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (err) {
    console.warn("[Supabase Database] Failed fetching lessons:", err);
    return [];
  }
}

/**
 * Upserts a Lesson in Supabase Database
 */
export async function upsertLessonToSupabase(
  lesson: Lesson
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Supabase client not configured" };
  }

  try {
    const row = lessonToRow(lesson);
    const { error } = await supabase
      .from("lessons")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.warn(`[Supabase Database] Upsert lesson ${lesson.id} error:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown upsert error";
    console.warn(`[Supabase Database] Failed upserting lesson ${lesson.id}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Deletes a Lesson from Supabase Database
 */
export async function deleteLessonFromSupabase(
  lessonId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Supabase client not configured" };
  }

  try {
    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId);

    if (error) {
      console.warn(`[Supabase Database] Delete lesson ${lessonId} error:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown delete error";
    console.warn(`[Supabase Database] Failed deleting lesson ${lessonId}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Reconciles local lessons with cloud lessons (identifying stale items to purge and new ones)
 */
export function reconcileLessonsWithCloud(
  localLessons: Lesson[],
  cloudLessons: Lesson[]
): {
  reconciled: Lesson[];
  purgedCount: number;
  downloadedCount: number;
} {
  const cloudIdMap = new Map(cloudLessons.map((l) => [l.id, l]));
  const localIdSet = new Set(localLessons.map((l) => l.id));

  let purgedCount = 0;
  for (const local of localLessons) {
    if (!cloudIdMap.has(local.id)) {
      purgedCount++;
    }
  }

  let downloadedCount = 0;
  for (const cloud of cloudLessons) {
    if (!localIdSet.has(cloud.id)) {
      downloadedCount++;
    }
  }

  return {
    reconciled: cloudLessons,
    purgedCount,
    downloadedCount,
  };
}

/**
 * Full Sync of Lessons with Supabase Cloud
 */
export async function syncLessonsWithCloud(
  localLessons: Lesson[],
  options: { authoritativeCloud?: boolean } = { authoritativeCloud: true }
): Promise<{
  syncedToCloud: number;
  downloadedFromCloud: number;
  purgedFromLocal: number;
  allLessons: Lesson[];
}> {
  if (!isSupabaseConfigured()) {
    return {
      syncedToCloud: 0,
      downloadedFromCloud: 0,
      purgedFromLocal: 0,
      allLessons: localLessons,
    };
  }

  try {
    const cloudLessons = await fetchLessonsFromSupabase();

    if (options.authoritativeCloud && cloudLessons.length > 0) {
      const { reconciled, purgedCount, downloadedCount } = reconcileLessonsWithCloud(
        localLessons,
        cloudLessons
      );

      return {
        syncedToCloud: 0,
        downloadedFromCloud: downloadedCount,
        purgedFromLocal: purgedCount,
        allLessons: reconciled,
      };
    } else {
      // Two-way sync: push missing local, pull missing cloud
      const cloudIds = new Set(cloudLessons.map((l) => l.id));
      let uploadCount = 0;
      for (const local of localLessons) {
        if (!cloudIds.has(local.id)) {
          const res = await upsertLessonToSupabase(local);
          if (res.success) uploadCount++;
        }
      }

      const localIds = new Set(localLessons.map((l) => l.id));
      let downloadCount = 0;
      const mergedList = [...localLessons];

      for (const cloud of cloudLessons) {
        if (!localIds.has(cloud.id)) {
          mergedList.push(cloud);
          downloadCount++;
        }
      }

      return {
        syncedToCloud: uploadCount,
        downloadedFromCloud: downloadCount,
        purgedFromLocal: 0,
        allLessons: mergedList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      };
    }
  } catch (err) {
    console.warn("[Supabase Database] Lesson sync failed:", err);
    return {
      syncedToCloud: 0,
      downloadedFromCloud: 0,
      purgedFromLocal: 0,
      allLessons: localLessons,
    };
  }
}
