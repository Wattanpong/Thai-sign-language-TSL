import {
  TSLDatasetPackage,
  Category,
  Lesson,
  ReferenceGesture,
  ReferenceFrame,
  ReferenceHand,
  NormalizedLandmark,
  DatasetImportOptions,
  DatasetValidationResult,
  DatasetValidationError,
  DatasetValidationWarning,
  DatasetImportSummary,
} from "@/types";
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
} from "./categoryStorage";
import {
  getLessons,
  addLesson,
  updateLesson,
  deleteLesson,
} from "./lessonStorage";
import {
  getAllStoredReferences,
  addReference,
  updateReference,
  clearReferences,
} from "./referenceStorage";

export interface DatasetImportPlanItem<T> {
  action: "create" | "update" | "skip" | "delete";
  item: T;
  reason?: string;
}

export interface DatasetImportPlan {
  mode: "replace" | "merge";
  duplicateStrategy: "overwrite" | "skip" | "error";
  categories: DatasetImportPlanItem<Category>[];
  lessons: DatasetImportPlanItem<Lesson>[];
  references: DatasetImportPlanItem<ReferenceGesture>[];
  summary: {
    totalIncomingCategories: number;
    totalIncomingLessons: number;
    totalIncomingReferences: number;
    categoriesToCreate: number;
    categoriesToUpdate: number;
    categoriesToSkip: number;
    categoriesToDelete: number;
    lessonsToCreate: number;
    lessonsToUpdate: number;
    lessonsToSkip: number;
    lessonsToDelete: number;
    referencesToCreate: number;
    referencesToUpdate: number;
    referencesToSkip: number;
    referencesToDelete: number;
  };
}

/**
 * Phase 1 & 2: Structural and Relational Dataset Validation
 */
export async function validateDataset(
  rawInput: unknown,
  options?: Partial<DatasetImportOptions>
): Promise<DatasetValidationResult> {
  const errors: DatasetValidationError[] = [];
  const warnings: DatasetValidationWarning[] = [];
  const mode = options?.mode || "merge";

  let dataset: TSLDatasetPackage;

  // 1. JSON parsing check
  if (typeof rawInput === "string") {
    try {
      dataset = JSON.parse(rawInput);
    } catch {
      return {
        isValid: false,
        errors: [
          {
            type: "invalid_json",
            message: "ไฟล์นำเข้าไม่ใช่รูปแบบ JSON ที่ถูกต้อง",
          },
        ],
        warnings: [],
        summary: {
          categoriesCount: 0,
          lessonsCount: 0,
          referencesCount: 0,
          validCategoriesCount: 0,
          validLessonsCount: 0,
          validReferencesCount: 0,
        },
      };
    }
  } else if (rawInput && typeof rawInput === "object") {
    dataset = rawInput as TSLDatasetPackage;
  } else {
    return {
      isValid: false,
      errors: [
        {
          type: "schema_error",
          message: "ข้อมูล Dataset ต้องเป็น Object",
        },
      ],
      warnings: [],
      summary: {
        categoriesCount: 0,
        lessonsCount: 0,
        referencesCount: 0,
        validCategoriesCount: 0,
        validLessonsCount: 0,
        validReferencesCount: 0,
      },
    };
  }

  // 2. Version validation
  if (!dataset.version || typeof dataset.version !== "string") {
    errors.push({
      type: "unsupported_version",
      message: "ไม่พบฟิลด์ version ใน Dataset Package",
    });
  } else if (dataset.version !== "1.0.0") {
    errors.push({
      type: "unsupported_version",
      message: `เวอร์ชัน Dataset "${dataset.version}" ไม่รองรับในปัจจุบัน (รองรับเฉพาะเวอร์ชัน 1.0.0)`,
      field: "version",
    });
  }

  // 3. Structural checks for top-level arrays
  if (!Array.isArray(dataset.categories)) {
    errors.push({
      type: "schema_error",
      message: "ฟิลด์ categories ต้องเป็น Array",
      entity: "category",
    });
  }
  if (!Array.isArray(dataset.lessons)) {
    errors.push({
      type: "schema_error",
      message: "ฟิลด์ lessons ต้องเป็น Array",
      entity: "lesson",
    });
  }
  if (!Array.isArray(dataset.references)) {
    errors.push({
      type: "schema_error",
      message: "ฟิลด์ references ต้องเป็น Array",
      entity: "reference",
    });
  }

  const rawCategories = Array.isArray(dataset.categories) ? dataset.categories : [];
  const rawLessons = Array.isArray(dataset.lessons) ? dataset.lessons : [];
  const rawReferences = Array.isArray(dataset.references) ? dataset.references : [];

  let validCategoriesCount = 0;
  let validLessonsCount = 0;
  let validReferencesCount = 0;

  // 4. Validate Categories
  const categoryIdsInDataset = new Set<string>();
  for (let i = 0; i < rawCategories.length; i++) {
    const cat = rawCategories[i];
    const catIndex = `category[${i}]`;

    if (!cat || typeof cat !== "object") {
      errors.push({
        type: "schema_error",
        message: `${catIndex}: ข้อมูล Category ไม่ถูกต้อง`,
        entity: "category",
      });
      continue;
    }

    const id = cat.id?.trim();
    if (!id) {
      errors.push({
        type: "schema_error",
        message: `${catIndex}: ขาดข้อมูล id หรือ id ว่างเปล่า`,
        entity: "category",
        field: "id",
      });
      continue;
    }

    if (categoryIdsInDataset.has(id)) {
      errors.push({
        type: "duplicate_id",
        message: `พบ Category ID ซ้ำกันใน Dataset: "${id}"`,
        entity: "category",
        entityId: id,
        field: "id",
      });
    }
    categoryIdsInDataset.add(id);

    const name = cat.name?.trim();
    if (!name) {
      errors.push({
        type: "schema_error",
        message: `Category "${id}": ขาดข้อมูล name หรือ name ว่างเปล่า`,
        entity: "category",
        entityId: id,
        field: "name",
      });
      continue;
    }

    validCategoriesCount++;
  }

  // Fetch existing state for relational checks
  const existingCategories = await getCategories({ includeInactive: true });
  const existingCategoryIds = new Set(existingCategories.map((c) => c.id));
  const allowedCategoryIds =
    mode === "replace"
      ? categoryIdsInDataset
      : new Set([...categoryIdsInDataset, ...existingCategoryIds]);

  // 5. Validate Lessons
  const lessonIdsInDataset = new Set<string>();
  for (let i = 0; i < rawLessons.length; i++) {
    const lesson = rawLessons[i];
    const lessonIndex = `lesson[${i}]`;

    if (!lesson || typeof lesson !== "object") {
      errors.push({
        type: "schema_error",
        message: `${lessonIndex}: ข้อมูล Lesson ไม่ถูกต้อง`,
        entity: "lesson",
      });
      continue;
    }

    const id = lesson.id?.trim();
    if (!id) {
      errors.push({
        type: "schema_error",
        message: `${lessonIndex}: ขาดข้อมูล id หรือ id ว่างเปล่า`,
        entity: "lesson",
        field: "id",
      });
      continue;
    }

    if (lessonIdsInDataset.has(id)) {
      errors.push({
        type: "duplicate_id",
        message: `พบ Lesson ID ซ้ำกันใน Dataset: "${id}"`,
        entity: "lesson",
        entityId: id,
        field: "id",
      });
    }
    lessonIdsInDataset.add(id);

    const word = lesson.word?.trim();
    if (!word) {
      errors.push({
        type: "schema_error",
        message: `Lesson "${id}": ขาดข้อมูล word หรือ word ว่างเปล่า`,
        entity: "lesson",
        entityId: id,
        field: "word",
      });
      continue;
    }

    const categoryId = lesson.categoryId?.trim();
    if (!categoryId) {
      errors.push({
        type: "missing_category",
        message: `Lesson "${id}" (${word}): ขาดข้อมูล categoryId`,
        entity: "lesson",
        entityId: id,
        field: "categoryId",
      });
    } else if (!allowedCategoryIds.has(categoryId)) {
      errors.push({
        type: "missing_category",
        message: `Lesson "${id}" (${word}): อ้างอิง Category ID "${categoryId}" ที่ไม่มีอยู่จริง`,
        entity: "lesson",
        entityId: id,
        field: "categoryId",
      });
    }

    if (lesson.gestureType !== "static" && lesson.gestureType !== "dynamic") {
      errors.push({
        type: "invalid_gesture_type",
        message: `Lesson "${id}" (${word}): gestureType ต้องเป็น "static" หรือ "dynamic" (พบ: "${lesson.gestureType}")`,
        entity: "lesson",
        entityId: id,
        field: "gestureType",
      });
    }

    if (
      lesson.difficulty &&
      !["beginner", "intermediate", "advanced"].includes(lesson.difficulty)
    ) {
      errors.push({
        type: "invalid_difficulty",
        message: `Lesson "${id}" (${word}): difficulty ไม่ถูกต้อง (พบ: "${lesson.difficulty}")`,
        entity: "lesson",
        entityId: id,
        field: "difficulty",
      });
    }

    validLessonsCount++;
  }

  // Fetch existing lessons for reference relation
  const existingLessons = await getLessons({ includeInactive: true });
  const existingLessonIds = new Set(existingLessons.map((l) => l.id));
  const allowedLessonIds =
    mode === "replace"
      ? lessonIdsInDataset
      : new Set([...lessonIdsInDataset, ...existingLessonIds]);

  // 6. Validate References
  const referenceIdsInDataset = new Set<string>();
  for (let i = 0; i < rawReferences.length; i++) {
    const ref = rawReferences[i];
    const refIndex = `reference[${i}]`;

    if (!ref || typeof ref !== "object") {
      errors.push({
        type: "schema_error",
        message: `${refIndex}: ข้อมูล Reference ไม่ถูกต้อง`,
        entity: "reference",
      });
      continue;
    }

    const id = ref.id?.trim();
    if (!id) {
      errors.push({
        type: "schema_error",
        message: `${refIndex}: ขาดข้อมูล id หรือ id ว่างเปล่า`,
        entity: "reference",
        field: "id",
      });
      continue;
    }

    if (referenceIdsInDataset.has(id)) {
      errors.push({
        type: "duplicate_id",
        message: `พบ Reference ID ซ้ำกันใน Dataset: "${id}"`,
        entity: "reference",
        entityId: id,
        field: "id",
      });
    }
    referenceIdsInDataset.add(id);

    const lessonId = ref.lessonId?.trim();
    if (!lessonId) {
      errors.push({
        type: "orphan_reference",
        message: `Reference "${id}": ขาดข้อมูล lessonId`,
        entity: "reference",
        entityId: id,
        field: "lessonId",
      });
    } else if (!allowedLessonIds.has(lessonId)) {
      errors.push({
        type: "orphan_reference",
        message: `Reference "${id}": อ้างอิง Lesson ID "${lessonId}" ที่ไม่มีอยู่จริง (Orphan Reference)`,
        entity: "reference",
        entityId: id,
        field: "lessonId",
      });
    }

    // Validate Frames
    if (!Array.isArray(ref.frames)) {
      errors.push({
        type: "invalid_frames",
        message: `Reference "${id}": ข้อมูล frames ต้องเป็น Array`,
        entity: "reference",
        entityId: id,
        field: "frames",
      });
      continue;
    }

    let frameHasError = false;
    for (let f = 0; f < ref.frames.length; f++) {
      const frame: ReferenceFrame = ref.frames[f];
      if (!frame || typeof frame !== "object") {
        errors.push({
          type: "invalid_frames",
          message: `Reference "${id}" frame[${f}]: โครงสร้างเฟรมไม่ถูกต้อง`,
          entity: "reference",
          entityId: id,
        });
        frameHasError = true;
        break;
      }

      if (typeof frame.timestampMs !== "number" || isNaN(frame.timestampMs) || !isFinite(frame.timestampMs)) {
        errors.push({
          type: "invalid_frames",
          message: `Reference "${id}" frame[${f}]: timestampMs ต้องเป็นตัวเลขที่ถูกต้อง`,
          entity: "reference",
          entityId: id,
          field: "timestampMs",
        });
        frameHasError = true;
        break;
      }

      // Validate Hands
      if (!Array.isArray(frame.hands)) {
        errors.push({
          type: "invalid_landmarks",
          message: `Reference "${id}" frame[${f}]: hands ต้องเป็น Array`,
          entity: "reference",
          entityId: id,
          field: "hands",
        });
        frameHasError = true;
        break;
      }

      for (const hand of frame.hands as ReferenceHand[]) {
        if (hand.handedness !== "Left" && hand.handedness !== "Right") {
          errors.push({
            type: "invalid_landmarks",
            message: `Reference "${id}" frame[${f}]: handedness ต้องเป็น "Left" หรือ "Right"`,
            entity: "reference",
            entityId: id,
          });
          frameHasError = true;
          break;
        }

        if (!Array.isArray(hand.landmarks)) {
          errors.push({
            type: "invalid_landmarks",
            message: `Reference "${id}" frame[${f}]: landmarks ต้องเป็น Array`,
            entity: "reference",
            entityId: id,
          });
          frameHasError = true;
          break;
        }

        for (let l = 0; l < hand.landmarks.length; l++) {
          const lm: NormalizedLandmark = hand.landmarks[l];
          if (
            typeof lm.x !== "number" || isNaN(lm.x) || !isFinite(lm.x) ||
            typeof lm.y !== "number" || isNaN(lm.y) || !isFinite(lm.y) ||
            typeof lm.z !== "number" || isNaN(lm.z) || !isFinite(lm.z)
          ) {
            errors.push({
              type: "invalid_landmarks",
              message: `Reference "${id}" frame[${f}]: Hand landmark[${l}] มีพิกัด x/y/z ไม่ถูกต้อง (พบ NaN หรือ Infinity)`,
              entity: "reference",
              entityId: id,
            });
            frameHasError = true;
            break;
          }
        }
        if (frameHasError) break;
      }
      if (frameHasError) break;

      // Validate Pose
      if (!Array.isArray(frame.pose)) {
        errors.push({
          type: "invalid_landmarks",
          message: `Reference "${id}" frame[${f}]: pose ต้องเป็น Array`,
          entity: "reference",
          entityId: id,
          field: "pose",
        });
        frameHasError = true;
        break;
      }

      for (let p = 0; p < frame.pose.length; p++) {
        const lm: NormalizedLandmark = frame.pose[p];
        if (
          typeof lm.x !== "number" || isNaN(lm.x) || !isFinite(lm.x) ||
          typeof lm.y !== "number" || isNaN(lm.y) || !isFinite(lm.y) ||
          typeof lm.z !== "number" || isNaN(lm.z) || !isFinite(lm.z)
        ) {
          errors.push({
            type: "invalid_landmarks",
            message: `Reference "${id}" frame[${f}]: Pose landmark[${p}] มีพิกัด x/y/z ไม่ถูกต้อง (พบ NaN หรือ Infinity)`,
            entity: "reference",
            entityId: id,
          });
          frameHasError = true;
          break;
        }
      }
      if (frameHasError) break;
    }

    if (!frameHasError) {
      validReferencesCount++;
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    summary: {
      categoriesCount: rawCategories.length,
      lessonsCount: rawLessons.length,
      referencesCount: rawReferences.length,
      validCategoriesCount,
      validLessonsCount,
      validReferencesCount,
    },
  };
}

/**
 * Phase 3: Create an Import Plan for UI preview and atomic execution
 */
export async function createImportPlan(
  dataset: TSLDatasetPackage,
  options?: Partial<DatasetImportOptions>
): Promise<DatasetImportPlan> {
  const mode = options?.mode || "merge";
  const duplicateStrategy = options?.duplicateStrategy || "overwrite";

  const [existingCategories, existingLessons, existingReferences] = await Promise.all([
    getCategories({ includeInactive: true }),
    getLessons({ includeInactive: true }),
    getAllStoredReferences({ includeSeeds: false }),
  ]);

  const existingCatMap = new Map(existingCategories.map((c) => [c.id, c]));
  const existingLesMap = new Map(existingLessons.map((l) => [l.id, l]));
  const existingRefMap = new Map(existingReferences.map((r) => [r.id, r]));

  const incomingCatIds = new Set(dataset.categories.map((c) => c.id));
  const incomingLesIds = new Set(dataset.lessons.map((l) => l.id));
  const incomingRefIds = new Set(dataset.references.map((r) => r.id));

  // Plan Categories
  const categoryPlan: DatasetImportPlanItem<Category>[] = [];
  for (const cat of dataset.categories) {
    if (existingCatMap.has(cat.id)) {
      if (mode === "replace" || duplicateStrategy === "overwrite") {
        categoryPlan.push({ action: "update", item: cat, reason: "เขียนทับข้อมูลเดิม" });
      } else if (duplicateStrategy === "skip") {
        categoryPlan.push({ action: "skip", item: cat, reason: "ข้ามเนื่องจากมี ID ซ้ำ" });
      } else {
        throw new Error(`พบ Category ID ซ้ำกันในระบบ: "${cat.id}"`);
      }
    } else {
      categoryPlan.push({ action: "create", item: cat });
    }
  }

  if (mode === "replace") {
    for (const oldCat of existingCategories) {
      if (!incomingCatIds.has(oldCat.id)) {
        categoryPlan.push({ action: "delete", item: oldCat, reason: "ลบเนื่องจากไม่อยู่ใน Dataset" });
      }
    }
  }

  // Plan Lessons
  const lessonPlan: DatasetImportPlanItem<Lesson>[] = [];
  for (const lesson of dataset.lessons) {
    if (existingLesMap.has(lesson.id)) {
      if (mode === "replace" || duplicateStrategy === "overwrite") {
        lessonPlan.push({ action: "update", item: lesson, reason: "เขียนทับข้อมูลเดิม" });
      } else if (duplicateStrategy === "skip") {
        lessonPlan.push({ action: "skip", item: lesson, reason: "ข้ามเนื่องจากมี ID ซ้ำ" });
      } else {
        throw new Error(`พบ Lesson ID ซ้ำกันในระบบ: "${lesson.id}"`);
      }
    } else {
      lessonPlan.push({ action: "create", item: lesson });
    }
  }

  if (mode === "replace") {
    for (const oldLesson of existingLessons) {
      if (!incomingLesIds.has(oldLesson.id)) {
        lessonPlan.push({ action: "delete", item: oldLesson, reason: "ลบเนื่องจากไม่อยู่ใน Dataset" });
      }
    }
  }

  // Plan References
  const referencePlan: DatasetImportPlanItem<ReferenceGesture>[] = [];
  for (const ref of dataset.references) {
    if (existingRefMap.has(ref.id)) {
      if (mode === "replace" || duplicateStrategy === "overwrite") {
        referencePlan.push({ action: "update", item: ref, reason: "เขียนทับข้อมูลเดิม" });
      } else if (duplicateStrategy === "skip") {
        referencePlan.push({ action: "skip", item: ref, reason: "ข้ามเนื่องจากมี ID ซ้ำ" });
      } else {
        throw new Error(`พบ Reference ID ซ้ำกันในระบบ: "${ref.id}"`);
      }
    } else {
      referencePlan.push({ action: "create", item: ref });
    }
  }

  if (mode === "replace") {
    for (const oldRef of existingReferences) {
      if (!incomingRefIds.has(oldRef.id)) {
        referencePlan.push({ action: "delete", item: oldRef, reason: "ลบเนื่องจากไม่อยู่ใน Dataset" });
      }
    }
  }

  const summary = {
    totalIncomingCategories: dataset.categories.length,
    totalIncomingLessons: dataset.lessons.length,
    totalIncomingReferences: dataset.references.length,
    categoriesToCreate: categoryPlan.filter((c) => c.action === "create").length,
    categoriesToUpdate: categoryPlan.filter((c) => c.action === "update").length,
    categoriesToSkip: categoryPlan.filter((c) => c.action === "skip").length,
    categoriesToDelete: categoryPlan.filter((c) => c.action === "delete").length,
    lessonsToCreate: lessonPlan.filter((l) => l.action === "create").length,
    lessonsToUpdate: lessonPlan.filter((l) => l.action === "update").length,
    lessonsToSkip: lessonPlan.filter((l) => l.action === "skip").length,
    lessonsToDelete: lessonPlan.filter((l) => l.action === "delete").length,
    referencesToCreate: referencePlan.filter((r) => r.action === "create").length,
    referencesToUpdate: referencePlan.filter((r) => r.action === "update").length,
    referencesToSkip: referencePlan.filter((r) => r.action === "skip").length,
    referencesToDelete: referencePlan.filter((r) => r.action === "delete").length,
  };

  return {
    mode,
    duplicateStrategy,
    categories: categoryPlan,
    lessons: lessonPlan,
    references: referencePlan,
    summary,
  };
}

/**
 * Phase 4: Atomic Execution of Import Plan with Snapshot & Rollback
 */
export async function executeImport(
  plan: DatasetImportPlan
): Promise<DatasetImportSummary> {
  const timestamp = new Date().toISOString();

  // 1. Take Snapshot of current state for rollback protection
  const [snapshotCategories, snapshotLessons, snapshotReferences] = await Promise.all([
    getCategories({ includeInactive: true }),
    getLessons({ includeInactive: true }),
    getAllStoredReferences({ includeSeeds: false }),
  ]);

  const restoreSnapshot = async () => {
    try {
      // Clear references
      await clearReferences();

      // Wipe current lessons
      const currentLessons = await getLessons({ includeInactive: true });
      for (const l of currentLessons) {
        await deleteLesson(l.id);
      }

      // Wipe current categories
      const currentCats = await getCategories({ includeInactive: true });
      for (const c of currentCats) {
        await deleteCategory(c.id);
      }

      // Restore snapshot categories
      for (const c of snapshotCategories) {
        try {
          await addCategory(c);
        } catch {
          await updateCategory(c);
        }
      }

      // Restore snapshot lessons
      for (const l of snapshotLessons) {
        try {
          await addLesson(l);
        } catch {
          await updateLesson(l);
        }
      }

      // Restore snapshot references
      for (const r of snapshotReferences) {
        await addReference(r);
      }
    } catch {
      // Critical fallback
    }
  };

  let importedCategories = 0;
  let skippedCategories = 0;
  let importedLessons = 0;
  let skippedLessons = 0;
  let importedReferences = 0;
  let skippedReferences = 0;

  try {
    // A. If Replace Mode: Wipe old items that are not in plan or marked for delete
    if (plan.mode === "replace") {
      const deleteLessonsList = plan.lessons.filter((l) => l.action === "delete");
      for (const l of deleteLessonsList) {
        await deleteLesson(l.item.id);
      }

      const deleteCategoriesList = plan.categories.filter((c) => c.action === "delete");
      for (const c of deleteCategoriesList) {
        await deleteCategory(c.item.id);
      }
    }


    // B. Import Categories
    for (const catPlan of plan.categories) {
      if (catPlan.action === "create") {
        await addCategory(catPlan.item);
        importedCategories++;
      } else if (catPlan.action === "update") {
        await updateCategory(catPlan.item);
        importedCategories++;
      } else if (catPlan.action === "skip") {
        skippedCategories++;
      }
    }

    // C. Import Lessons
    for (const lesPlan of plan.lessons) {
      if (lesPlan.action === "create") {
        await addLesson(lesPlan.item);
        importedLessons++;
      } else if (lesPlan.action === "update") {
        await updateLesson(lesPlan.item);
        importedLessons++;
      } else if (lesPlan.action === "skip") {
        skippedLessons++;
      }
    }

    // D. Import References
    for (const refPlan of plan.references) {
      if (refPlan.action === "create") {
        await addReference(refPlan.item);
        importedReferences++;
      } else if (refPlan.action === "update") {
        await updateReference(refPlan.item);
        importedReferences++;
      } else if (refPlan.action === "skip") {
        skippedReferences++;
      }
    }

    return {
      success: true,
      mode: plan.mode,
      importedCategories,
      importedLessons,
      importedReferences,
      skippedCategories,
      skippedLessons,
      skippedReferences,
      timestamp,
    };
  } catch (err: unknown) {
    // ATOMIC ROLLBACK ON ERROR
    await restoreSnapshot();
    const errorMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดระหว่างนำเข้า Dataset";
    throw new Error(`การนำเข้าล้มเหลว และระบบได้ Rollback ข้อมูลเดิมเรียบร้อยแล้ว: ${errorMsg}`);
  }
}

/**
 * High-level one-step dataset import from JSON string or object
 */
export async function importDatasetFromJson(
  rawInput: unknown,
  options?: Partial<DatasetImportOptions>
): Promise<{
  validation: DatasetValidationResult;
  summary?: DatasetImportSummary;
}> {
  // Phase 1 & 2: Validate
  const validation = await validateDataset(rawInput, options);
  if (!validation.isValid) {
    return { validation };
  }

  let dataset: TSLDatasetPackage;
  if (typeof rawInput === "string") {
    dataset = JSON.parse(rawInput);
  } else {
    dataset = rawInput as TSLDatasetPackage;
  }

  // Phase 3: Create Plan
  const plan = await createImportPlan(dataset, options);

  // Phase 4: Execute
  const summary = await executeImport(plan);

  return {
    validation,
    summary,
  };
}
