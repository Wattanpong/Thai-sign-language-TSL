import {
  DatasetSnapshot,
  DatasetImportOptions,
  DatasetImportSummary,
  TSLDatasetPackage,
  ReferenceGesture,
} from "@/types";
import { exportDataset } from "./datasetExportService";
import { importDatasetFromJson, validateDataset } from "./datasetImportService";
import { INITIAL_CATEGORIES } from "@/data/seedCategories";
import { INITIAL_LESSONS } from "@/data/seedLessons";
import { SEED_REFERENCE_GESTURES } from "@/data/seedReferences";

const SNAPSHOT_STORAGE_KEY = "tsl_dataset_snapshots";

// In-memory storage for SSR / testing
let memorySnapshots: DatasetSnapshot[] = [];

/**
 * Normalizes and parses raw stored snapshots
 */
function parseStoredSnapshots(data: string): DatasetSnapshot[] {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed as DatasetSnapshot[];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Loads all raw snapshots from localStorage or memory (internal helper)
 */
function loadRawSnapshots(): DatasetSnapshot[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
      if (raw) {
        const parsed = parseStoredSnapshots(raw);
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  return [...memorySnapshots];
}

/**
 * Persists raw snapshots to memory and localStorage (internal helper)
 */
function persistRawSnapshots(snapshots: DatasetSnapshot[]): void {
  // Deep clone to guarantee immutability
  memorySnapshots = JSON.parse(JSON.stringify(snapshots));

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
    } catch {
      // quota or private mode fallback
    }
  }
}

/**
 * Retrieves all stored dataset snapshots, sorted from newest to oldest.
 * Guaranteed to return deep-cloned objects.
 */
export async function getDatasetSnapshots(): Promise<DatasetSnapshot[]> {
  const rawList = loadRawSnapshots();
  const sorted = [...rawList].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return JSON.parse(JSON.stringify(sorted));
}

/**
 * Retrieves a single dataset snapshot by its unique ID.
 */
export async function getDatasetSnapshotById(
  id: string
): Promise<DatasetSnapshot | null> {
  const all = await getDatasetSnapshots();
  const found = all.find((s) => s.id === id);
  if (!found) return null;
  return JSON.parse(JSON.stringify(found));
}

/**
 * Creates and stores a new Dataset Snapshot of current system state.
 */
export async function createDatasetSnapshot(options?: {
  name?: string;
  description?: string;
  includeSeeds?: boolean;
  isAutoBackup?: boolean;
}): Promise<DatasetSnapshot> {
  const includeSeeds = options?.includeSeeds ?? true;
  const isAutoBackup = options?.isAutoBackup ?? false;

  // 1. Export current dataset
  const datasetPackage = await exportDataset({ includeSeeds });

  // 2. Generate unique snapshot ID
  const timestamp = new Date();
  const id = `snapshot_${timestamp.getTime()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultName = `Snapshot ${timestamp.toISOString().replace("T", " ").substring(0, 19)}`;

  // 3. Assemble Snapshot
  const snapshot: DatasetSnapshot = {
    id,
    name: options?.name?.trim() || defaultName,
    description: options?.description?.trim() || undefined,
    createdAt: timestamp.toISOString(),
    dataset: JSON.parse(JSON.stringify(datasetPackage)),
    isAutoBackup,
  };

  // 4. Persist to storage
  const currentList = loadRawSnapshots();
  const updatedList = [snapshot, ...currentList.filter((s) => s.id !== id)];
  persistRawSnapshots(updatedList);

  return JSON.parse(JSON.stringify(snapshot));
}

/**
 * Quick Helper to create an automatic safety backup before risky operations
 */
export async function createQuickBackup(): Promise<DatasetSnapshot> {
  return createDatasetSnapshot({
    name: "Quick Backup",
    description: "Automatic safety backup",
    includeSeeds: true,
    isAutoBackup: true,
  });
}

/**
 * Deletes a snapshot by its ID
 */
export async function deleteDatasetSnapshot(id: string): Promise<void> {
  const currentList = loadRawSnapshots();
  const remaining = currentList.filter((s) => s.id !== id);
  persistRawSnapshots(remaining);
}

/**
 * Clears all snapshots from storage
 */
export async function clearDatasetSnapshots(): Promise<void> {
  memorySnapshots = [];
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Limits stored snapshots to `maxSnapshots` by removing the oldest ones.
 * Returns the number of removed snapshots.
 */
export async function cleanupOldSnapshots(maxSnapshots: number): Promise<number> {
  if (typeof maxSnapshots !== "number" || maxSnapshots < 1 || isNaN(maxSnapshots)) {
    throw new Error("maxSnapshots ต้องเป็นจำนวนเต็มบวกที่มากกว่าหรือเท่ากับ 1");
  }

  const all = await getDatasetSnapshots(); // already sorted newest first
  if (all.length <= maxSnapshots) {
    return 0;
  }

  const kept = all.slice(0, maxSnapshots);
  const removedCount = all.length - maxSnapshots;
  persistRawSnapshots(kept);

  return removedCount;
}

/**
 * Restores system dataset from an existing snapshot.
 * Creates an automatic safety snapshot before restoring.
 */
export async function restoreDatasetSnapshot(
  snapshotId: string,
  options?: Partial<DatasetImportOptions>
): Promise<DatasetImportSummary> {
  // 1. Fetch snapshot
  const snapshot = await getDatasetSnapshotById(snapshotId);
  if (!snapshot) {
    throw new Error(`ไม่พบ Snapshot ID: "${snapshotId}"`);
  }

  // 2. Validate Snapshot dataset
  const validation = await validateDataset(snapshot.dataset, {
    mode: "replace",
    ...options,
  });
  if (!validation.isValid) {
    throw new Error(
      `Snapshot ไม่ถูกต้องหรือข้อมูลเสียหาย: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // 3. Create safety backup of current state
  await createQuickBackup();

  // 4. Execute Restore via Import Service in replace mode
  const result = await importDatasetFromJson(snapshot.dataset, {
    mode: "replace",
    duplicateStrategy: "overwrite",
    ...options,
  });

  if (!result.summary || !result.summary.success) {
    throw new Error(result.validation.errors[0]?.message || "การ Restore Snapshot ล้มเหลว");
  }

  return result.summary;
}

/**
 * Performs a factory reset to restore built-in seed dataset.
 * Destructive operation protected by optional safety backup and atomic execution.
 */
export async function factoryResetDataset(options?: {
  createBackup?: boolean;
}): Promise<DatasetImportSummary> {
  const shouldCreateBackup = options?.createBackup ?? true;

  // 1. Create safety backup if enabled
  if (shouldCreateBackup) {
    await createQuickBackup();
  }

  // 2. Construct Factory Seed Dataset Package
  const seedRefs: ReferenceGesture[] = [];
  for (const list of Object.values(SEED_REFERENCE_GESTURES)) {
    seedRefs.push(...list);
  }

  const factoryPackage: TSLDatasetPackage = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    appName: "Thai Sign Language AI Platform",
    metadata: {
      totalCategories: INITIAL_CATEGORIES.length,
      totalLessons: INITIAL_LESSONS.length,
      totalReferences: seedRefs.length,
      environment: "production",
      notes: "Factory Reset Default Seed Dataset",
    },
    categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),
    lessons: JSON.parse(JSON.stringify(INITIAL_LESSONS)),
    references: JSON.parse(JSON.stringify(seedRefs)),
  };

  // 3. Execute Restore via Import Service in replace mode
  const result = await importDatasetFromJson(factoryPackage, {
    mode: "replace",
    duplicateStrategy: "overwrite",
  });

  if (!result.summary || !result.summary.success) {
    throw new Error("Factory Reset ล้มเหลว");
  }

  return result.summary;
}

/**
 * Downloads a snapshot package as a JSON file
 */
export async function downloadDatasetSnapshot(
  snapshotId: string
): Promise<{ success: boolean; filename: string; error?: string }> {
  const snapshot = await getDatasetSnapshotById(snapshotId);
  if (!snapshot) {
    return {
      success: false,
      filename: "",
      error: `ไม่พบ Snapshot ID "${snapshotId}"`,
    };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const filename = `tsl-backup-${year}-${month}-${day}-${hours}${minutes}${seconds}.json`;

  try {
    const jsonString = JSON.stringify(snapshot.dataset, null, 2);

    if (typeof window === "undefined" || typeof document === "undefined") {
      return {
        success: false,
        filename,
        error: "ดาวน์โหลดไฟล์รองรับเฉพาะในสภาพแวดล้อมเบราว์เซอร์เท่านั้น",
      };
    }

    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดาวน์โหลด Snapshot";
    return {
      success: false,
      filename,
      error: errorMsg,
    };
  }
}
