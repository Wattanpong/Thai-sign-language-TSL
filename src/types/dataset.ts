import { Category } from "./category";
import { Lesson } from "./lesson";
import { ReferenceGesture } from "./gesture";

/**
 * Metadata and summary statistics of a dataset export package
 */
export interface DatasetMetadata {
  totalCategories: number;
  totalLessons: number;
  totalReferences: number;
  environment?: string;
  author?: string;
  notes?: string;
}

/**
 * Standard complete TSL Dataset Package structure for Export/Import
 */
export interface TSLDatasetPackage {
  $schema?: string;
  version: string;
  exportedAt: string;
  appName: string;
  metadata?: DatasetMetadata;
  categories: Category[];
  lessons: Lesson[];
  references: ReferenceGesture[];
}

/**
 * Strategy mode for importing data into storage:
 * - "replace": Wipes existing data and restores from dataset (Factory / Restore)
 * - "merge": Combines dataset with current storage according to duplicate strategy
 */
export type DatasetImportMode = "replace" | "merge";

/**
 * Strategy when encountering existing/duplicate items during import:
 * - "overwrite": Replaces existing item with imported data
 * - "skip": Keeps existing item and ignores incoming duplicate
 * - "error": Aborts import and reports duplicate collision error
 */
export type DuplicateStrategy = "overwrite" | "skip" | "error";

/**
 * Configurable options for executing dataset import
 */
export interface DatasetImportOptions {
  mode: DatasetImportMode;
  duplicateStrategy?: DuplicateStrategy;
  validateLandmarks?: boolean;
  skipOrphans?: boolean;
}

/**
 * Categorized error types for granular validation reporting
 */
export type DatasetValidationErrorType =
  | "invalid_json"
  | "unsupported_version"
  | "duplicate_id"
  | "missing_category"
  | "orphan_reference"
  | "invalid_gesture_type"
  | "invalid_difficulty"
  | "invalid_frames"
  | "invalid_landmarks"
  | "schema_error"
  | "unknown_error";

/**
 * Specific validation error item
 */
export interface DatasetValidationError {
  type: DatasetValidationErrorType;
  message: string;
  entity?: "category" | "lesson" | "reference";
  entityId?: string;
  field?: string;
}

/**
 * Specific validation warning item (non-blocking)
 */
export interface DatasetValidationWarning {
  message: string;
  entity?: "category" | "lesson" | "reference";
  entityId?: string;
}

/**
 * Comprehensive result of validating a dataset package before import
 */
export interface DatasetValidationResult {
  isValid: boolean;
  errors: DatasetValidationError[];
  warnings: DatasetValidationWarning[];
  summary: {
    categoriesCount: number;
    lessonsCount: number;
    referencesCount: number;
    validCategoriesCount: number;
    validLessonsCount: number;
    validReferencesCount: number;
  };
}

/**
 * Execution summary after completing an import operation
 */
export interface DatasetImportSummary {
  success: boolean;
  mode: DatasetImportMode;
  importedCategories: number;
  importedLessons: number;
  importedReferences: number;
  skippedCategories: number;
  skippedLessons: number;
  skippedReferences: number;
  timestamp: string;
  error?: string;
}

/**
 * Local snapshot metadata and payload for Backup & Restore
 */
export interface DatasetSnapshot {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  dataset: TSLDatasetPackage;
  isAutoBackup?: boolean;
}
