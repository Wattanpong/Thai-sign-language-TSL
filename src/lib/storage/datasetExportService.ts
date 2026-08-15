import { TSLDatasetPackage, DatasetMetadata, Category, Lesson, ReferenceGesture } from "@/types";
import { getCategories } from "./categoryStorage";
import { getLessons } from "./lessonStorage";
import { getAllStoredReferences } from "./referenceStorage";

export interface ExportDatasetOptions {
  includeSeeds?: boolean;
  author?: string;
  notes?: string;
  skipConsistencyCheck?: boolean;
}

export interface ExportJsonOptions extends ExportDatasetOptions {
  pretty?: boolean;
}

export const DATASET_VERSION = "1.0.0";
export const DATASET_SCHEMA_URL = "https://tsl-ai.platform/schemas/dataset-v1.json";
export const APP_NAME = "Thai Sign Language AI Platform";

/**
 * Validates export dataset consistency before packaging
 */
export function validateExportConsistency(
  categories: Category[],
  lessons: Lesson[],
  references: ReferenceGesture[]
): void {
  // 1. Check duplicate Category IDs
  const categoryIds = new Set<string>();
  for (const cat of categories) {
    if (categoryIds.has(cat.id)) {
      throw new Error(`พบ Category ID ซ้ำกันในระบบ: "${cat.id}"`);
    }
    categoryIds.add(cat.id);
  }

  // 2. Check duplicate Lesson IDs & Category Foreign Key
  const lessonIds = new Set<string>();
  for (const lesson of lessons) {
    if (lessonIds.has(lesson.id)) {
      throw new Error(`พบ Lesson ID ซ้ำกันในระบบ: "${lesson.id}"`);
    }
    lessonIds.add(lesson.id);

    if (!categoryIds.has(lesson.categoryId)) {
      throw new Error(
        `ความไม่สอดคล้องของข้อมูล: Lesson "${lesson.word}" (${lesson.id}) อ้างอิง Category ID "${lesson.categoryId}" ที่ไม่มีอยู่จริง`
      );
    }
  }

  // 3. Check duplicate Reference IDs & Lesson Foreign Key
  const referenceIds = new Set<string>();
  for (const ref of references) {
    if (referenceIds.has(ref.id)) {
      throw new Error(`พบ Reference ID ซ้ำกันในระบบ: "${ref.id}"`);
    }
    referenceIds.add(ref.id);

    if (!lessonIds.has(ref.lessonId)) {
      throw new Error(
        `ความไม่สอดคล้องของข้อมูล: Reference "${ref.id}" (${ref.word}) อ้างอิง Lesson ID "${ref.lessonId}" ที่ไม่มีอยู่จริง`
      );
    }
  }
}

/**
 * Deterministically sorts categories, lessons, and references
 */
export function sortDatasetItems(
  categories: Category[],
  lessons: Lesson[],
  references: ReferenceGesture[]
): {
  sortedCategories: Category[];
  sortedLessons: Lesson[];
  sortedReferences: ReferenceGesture[];
} {
  // Sort Categories by order asc, then id asc
  const sortedCategories = [...categories].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.id.localeCompare(b.id);
  });

  // Sort Lessons by categoryId asc, then order asc, then id asc
  const sortedLessons = [...lessons].sort((a, b) => {
    const catDiff = a.categoryId.localeCompare(b.categoryId);
    if (catDiff !== 0) return catDiff;
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.id.localeCompare(b.id);
  });

  // Sort References by lessonId asc, then isPrimary desc, then qualityScore desc, then id asc
  const sortedReferences = [...references].sort((a, b) => {
    const lessonDiff = a.lessonId.localeCompare(b.lessonId);
    if (lessonDiff !== 0) return lessonDiff;
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    const scoreDiff = (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return a.id.localeCompare(b.id);
  });

  return {
    sortedCategories,
    sortedLessons,
    sortedReferences,
  };
}

/**
 * Exports complete platform content as a standardized TSLDatasetPackage
 */
export async function exportDataset(
  options?: ExportDatasetOptions
): Promise<TSLDatasetPackage> {
  const includeSeeds = options?.includeSeeds ?? true;

  // 1. Fetch data from Storage abstraction layers
  const [rawCategories, rawLessons, rawReferences] = await Promise.all([
    getCategories({ includeInactive: true }),
    getLessons({ includeInactive: true }),
    getAllStoredReferences({ includeSeeds }),
  ]);

  // 2. Deep clone to guarantee immutability of source storage data
  const clonedCategories: Category[] = JSON.parse(JSON.stringify(rawCategories));
  const clonedLessons: Lesson[] = JSON.parse(JSON.stringify(rawLessons));
  const clonedReferences: ReferenceGesture[] = JSON.parse(JSON.stringify(rawReferences));

  // 3. Consistency Validation (unless skipped)
  if (!options?.skipConsistencyCheck) {
    validateExportConsistency(clonedCategories, clonedLessons, clonedReferences);
  }

  // 4. Deterministic Ordering
  const { sortedCategories, sortedLessons, sortedReferences } = sortDatasetItems(
    clonedCategories,
    clonedLessons,
    clonedReferences
  );

  // 5. Construct Dataset Package
  const metadata: DatasetMetadata = {
    totalCategories: sortedCategories.length,
    totalLessons: sortedLessons.length,
    totalReferences: sortedReferences.length,
    environment: typeof process !== "undefined" && process.env?.NODE_ENV ? process.env.NODE_ENV : "production",
    author: options?.author?.trim() || undefined,
    notes: options?.notes?.trim() || undefined,
  };

  const datasetPackage: TSLDatasetPackage = {
    $schema: DATASET_SCHEMA_URL,
    version: DATASET_VERSION,
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    metadata,
    categories: sortedCategories,
    lessons: sortedLessons,
    references: sortedReferences,
  };

  return datasetPackage;
}

/**
 * Exports dataset as formatted JSON string
 */
export async function exportDatasetToJson(
  options?: ExportJsonOptions
): Promise<string> {
  const dataset = await exportDataset(options);
  const pretty = options?.pretty ?? true;
  return JSON.stringify(dataset, null, pretty ? 2 : undefined);
}

/**
 * Generate standard timestamped filename for dataset backup
 */
export function generateDatasetFilename(prefix = "tsl-dataset"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${prefix}-${year}-${month}-${day}-${hours}${minutes}${seconds}.json`;
}

/**
 * Triggers a browser file download of the dataset JSON package
 */
export async function downloadDatasetJson(
  customFilename?: string,
  options?: ExportJsonOptions
): Promise<{ success: boolean; filename: string; error?: string }> {
  const filename = customFilename?.trim() || generateDatasetFilename();

  try {
    const jsonString = await exportDatasetToJson(options);

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
    const errorMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดาวน์โหลด Dataset";
    return {
      success: false,
      filename,
      error: errorMsg,
    };
  }
}
