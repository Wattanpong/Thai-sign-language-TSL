import { ReferenceGesture } from "@/types";
import { getSupabaseClient, isSupabaseConfigured } from "./client";

export const SUPABASE_BUCKET_NAME = "gesture-references";

export interface SupabaseUploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

/**
 * Generates the standardized storage path for a reference gesture in the Supabase bucket
 */
export function getReferenceStoragePath(lessonId: string, referenceId: string): string {
  return `references/${lessonId}/${referenceId}.json`;
}

/**
 * Uploads a full ReferenceGesture JSON payload to Supabase Storage bucket
 */
export async function uploadReferenceToSupabase(
  gesture: ReferenceGesture
): Promise<SupabaseUploadResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      error: "Supabase client is not configured (missing URL or Anon Key)",
    };
  }

  try {
    const path = getReferenceStoragePath(gesture.lessonId, gesture.id);
    const jsonString = JSON.stringify(gesture);

    let payload: Blob | Uint8Array;
    if (typeof Blob !== "undefined") {
      payload = new Blob([jsonString], { type: "application/json" });
    } else {
      payload = new TextEncoder().encode(jsonString);
    }

    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET_NAME)
      .upload(path, payload, {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      console.warn(`[Supabase Storage] Upload error for ${path}:`, error.message);
      return { success: false, error: error.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_BUCKET_NAME)
      .getPublicUrl(path);

    // Optional metadata table upsert if table exists
    try {
      await supabase.from("reference_gestures").upsert(
        {
          id: gesture.id,
          lesson_id: gesture.lessonId,
          word: gesture.word,
          is_primary: gesture.isPrimary ?? false,
          quality_score: gesture.qualityScore ?? 0,
          duration_ms: gesture.durationMs,
          frame_count: gesture.frameCount,
          storage_path: path,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    } catch {
      // ignore metadata table failure if table is not provisioned
    }

    return {
      success: true,
      path: data?.path || path,
      url: publicUrlData?.publicUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    console.warn(`[Supabase Storage] Failed to upload reference ${gesture.id}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Fetches all ReferenceGestures for a given lessonId from Supabase Storage
 */
export async function fetchReferencesFromSupabase(
  lessonId: string
): Promise<ReferenceGesture[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  try {
    const folder = `references/${lessonId}`;
    const { data: files, error } = await supabase.storage
      .from(SUPABASE_BUCKET_NAME)
      .list(folder);

    if (error) {
      console.warn(`[Supabase Storage] List error for ${folder}:`, error.message);
      return [];
    }

    if (!files || files.length === 0) {
      return [];
    }

    const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
    const downloadPromises = jsonFiles.map(async (file) => {
      try {
        const filePath = `${folder}/${file.name}`;
        const { data, error: dlError } = await supabase.storage
          .from(SUPABASE_BUCKET_NAME)
          .download(filePath);

        if (dlError || !data) {
          return null;
        }

        const text = await data.text();
        const parsed = JSON.parse(text) as ReferenceGesture;
        return parsed && parsed.id ? parsed : null;
      } catch (err) {
        console.warn(`[Supabase Storage] Failed downloading ${file.name}:`, err);
        return null;
      }
    });

    const results = await Promise.all(downloadPromises);
    return results.filter((r): r is ReferenceGesture => r !== null);
  } catch (err) {
    console.warn(`[Supabase Storage] Error fetching references for lesson ${lessonId}:`, err);
    return [];
  }
}

/**
 * Fetches a single ReferenceGesture by ID from Supabase
 */
export async function fetchReferenceByIdFromSupabase(
  lessonId: string,
  referenceId: string
): Promise<ReferenceGesture | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const path = getReferenceStoragePath(lessonId, referenceId);
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET_NAME)
      .download(path);

    if (error || !data) {
      return null;
    }

    const text = await data.text();
    return JSON.parse(text) as ReferenceGesture;
  } catch (err) {
    console.warn(`[Supabase Storage] Failed fetching reference ${referenceId}:`, err);
    return null;
  }
}

/**
 * Deletes a ReferenceGesture from Supabase Storage
 */
export async function deleteReferenceFromSupabase(
  lessonId: string,
  referenceId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  try {
    const path = getReferenceStoragePath(lessonId, referenceId);
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.warn(`[Supabase Storage] Delete error for ${path}:`, error.message);
      return false;
    }

    // Optional metadata delete
    try {
      await supabase.from("reference_gestures").delete().eq("id", referenceId);
    } catch {
      // ignore
    }

    return true;
  } catch (err) {
    console.warn(`[Supabase Storage] Failed deleting reference ${referenceId}:`, err);
    return false;
  }
}

export interface SyncLessonReferencesResult {
  syncedToCloud: number;
  downloadedFromCloud: number;
  purgedFromLocal: number;
  allReferences: ReferenceGesture[];
}

/**
 * Reconciles local references with cloud references, identifying items to purge or add
 */
export function reconcileReferencesWithCloud(
  localReferences: ReferenceGesture[],
  cloudReferences: ReferenceGesture[]
): {
  reconciled: ReferenceGesture[];
  purgedCount: number;
  downloadedCount: number;
} {
  const cloudIdMap = new Map(cloudReferences.map((r) => [r.id, r]));
  const localIdSet = new Set(localReferences.map((r) => r.id));

  // Count local items that no longer exist on cloud (Stale items)
  let purgedCount = 0;
  for (const localRef of localReferences) {
    if (!cloudIdMap.has(localRef.id)) {
      purgedCount++;
    }
  }

  // Count new items downloaded from cloud
  let downloadedCount = 0;
  for (const cloudRef of cloudReferences) {
    if (!localIdSet.has(cloudRef.id)) {
      downloadedCount++;
    }
  }

  return {
    reconciled: cloudReferences,
    purgedCount,
    downloadedCount,
  };
}

/**
 * Syncs local references with Supabase Cloud with full deletion reconciliation
 */
export async function syncLessonReferences(
  lessonId: string,
  localReferences: ReferenceGesture[],
  options: { authoritativeCloud?: boolean } = { authoritativeCloud: true }
): Promise<SyncLessonReferencesResult> {
  if (!isSupabaseConfigured()) {
    return {
      syncedToCloud: 0,
      downloadedFromCloud: 0,
      purgedFromLocal: 0,
      allReferences: localReferences,
    };
  }

  try {
    const cloudRefs = await fetchReferencesFromSupabase(lessonId);

    if (options.authoritativeCloud) {
      // Authoritative Cloud Sync: Reconcile deletions & additions
      const { reconciled, purgedCount, downloadedCount } = reconcileReferencesWithCloud(
        localReferences,
        cloudRefs
      );

      return {
        syncedToCloud: 0,
        downloadedFromCloud: downloadedCount,
        purgedFromLocal: purgedCount,
        allReferences: reconciled,
      };
    } else {
      // Bidirectional sync: upload local missing, download cloud missing
      const cloudIds = new Set(cloudRefs.map((r) => r.id));
      let uploadCount = 0;
      for (const localRef of localReferences) {
        if (!cloudIds.has(localRef.id)) {
          const res = await uploadReferenceToSupabase(localRef);
          if (res.success) uploadCount++;
        }
      }

      const localIds = new Set(localReferences.map((r) => r.id));
      let downloadCount = 0;
      const mergedList = [...localReferences];

      for (const cloudRef of cloudRefs) {
        if (!localIds.has(cloudRef.id)) {
          mergedList.push(cloudRef);
          downloadCount++;
        }
      }

      return {
        syncedToCloud: uploadCount,
        downloadedFromCloud: downloadCount,
        purgedFromLocal: 0,
        allReferences: mergedList,
      };
    }
  } catch (err) {
    console.warn(`[Supabase Storage] Sync failed for lesson ${lessonId}:`, err);
    return {
      syncedToCloud: 0,
      downloadedFromCloud: 0,
      purgedFromLocal: 0,
      allReferences: localReferences,
    };
  }
}
