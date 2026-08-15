import { ReferenceGesture } from "@/types";
import { SEED_REFERENCE_GESTURES } from "@/data/seedReferences";
import { evaluateReferenceQuality } from "@/lib/gesture/referenceQuality";
import { getBestReference, rankReferences } from "@/lib/reference/referenceRanking";

const STORAGE_MULTI_PREFIX = "tsl_ref_set_";
const LEGACY_STORAGE_PREFIX = "tsl_ref_gesture_";

// In-memory fallback for SSR / non-browser environments
const memoryStorage = new Map<string, ReferenceGesture[]>();

/**
 * Normalizes and migrates raw stored reference data
 */
function parseStoredReferences(data: string): ReferenceGesture[] {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed as ReferenceGesture[];
    } else if (parsed && typeof parsed === "object" && parsed.id) {
      // Legacy single object format
      return [parsed as ReferenceGesture];
    }
  } catch {
    // ignore parsing failure
  }
  return [];
}

/**
 * Retrieve all Reference Gestures associated with a lesson
 * Automatically falls back to built-in seed references if no custom recordings exist
 */
export async function getReferencesByLessonId(
  lessonId: string
): Promise<ReferenceGesture[]> {
  let references: ReferenceGesture[] = [];

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      // 1. Check modern multi-reference key
      const multiData = window.localStorage.getItem(`${STORAGE_MULTI_PREFIX}${lessonId}`);
      if (multiData) {
        references = parseStoredReferences(multiData);
      } else {
        // 2. Check legacy single-reference key for backward compatibility
        const legacyData = window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${lessonId}`);
        if (legacyData) {
          references = parseStoredReferences(legacyData);
        }
      }
    } catch {
      // fallback to memory
    }
  }

  if (references.length === 0) {
    const inMem = memoryStorage.get(lessonId);
    if (inMem && inMem.length > 0) {
      references = inMem;
    }
  }

  // 3. Fallback to seed reference dataset if storage is empty
  if (references.length === 0) {
    const seedList = SEED_REFERENCE_GESTURES[lessonId];
    if (seedList && seedList.length > 0) {
      references = seedList;
    }
  }

  return rankReferences(references);
}

/**
 * Retrieve the single best / primary Reference Gesture for a lesson
 */
export async function getBestReferenceByLessonId(
  lessonId: string
): Promise<ReferenceGesture | null> {
  const references = await getReferencesByLessonId(lessonId);
  return getBestReference(references);
}

/**
 * Backward-compatible alias for getBestReferenceByLessonId
 */
export async function getReferenceGestureByLessonId(
  lessonId: string
): Promise<ReferenceGesture | null> {
  return getBestReferenceByLessonId(lessonId);
}

/**
 * Retrieve a Reference Gesture across all lessons by its unique ID
 */
export async function getReferenceGestureById(
  id: string
): Promise<ReferenceGesture | null> {
  // Check memory
  for (const list of memoryStorage.values()) {
    const found = list.find((r) => r.id === id);
    if (found) return found;
  }

  // Check seeds
  for (const list of Object.values(SEED_REFERENCE_GESTURES)) {
    const found = list.find((r) => r.id === id);
    if (found) return found;
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith(STORAGE_MULTI_PREFIX) || key.startsWith(LEGACY_STORAGE_PREFIX))) {
          const item = window.localStorage.getItem(key);
          if (item) {
            const list = parseStoredReferences(item);
            const match = list.find((r) => r.id === id);
            if (match) return match;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Save an updated list of references for a lesson
 */
async function persistLessonReferences(
  lessonId: string,
  references: ReferenceGesture[]
): Promise<void> {
  memoryStorage.set(lessonId, references);

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const serialized = JSON.stringify(references);
      window.localStorage.setItem(`${STORAGE_MULTI_PREFIX}${lessonId}`, serialized);
      // Clean legacy key if present to prevent divergence
      window.localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${lessonId}`);
    } catch {
      // quota or private mode fallback
    }
  }
}

/**
 * Add a new Reference Gesture to the lesson's dataset
 * Automatically computes quality score and sets primary status if appropriate
 */
export async function addReference(
  gesture: ReferenceGesture
): Promise<void> {
  // 1. Compute quality score if missing
  if (gesture.qualityScore === undefined) {
    const qualityResult = evaluateReferenceQuality(gesture);
    gesture.qualityScore = qualityResult.scorePercent;
    gesture.qualityLevel = qualityResult.level;
  }

  const existing = await getReferencesByLessonId(gesture.lessonId);
  const isFirst = existing.length === 0;

  // If this is the first reference or explicitly flagged as primary
  if (isFirst || gesture.isPrimary) {
    existing.forEach((r) => {
      r.isPrimary = false;
    });
    gesture.isPrimary = true;
  }

  const updatedList = [...existing.filter((r) => r.id !== gesture.id), gesture];
  await persistLessonReferences(gesture.lessonId, updatedList);
}

/**
 * Update an existing Reference Gesture
 */
export async function updateReference(
  gesture: ReferenceGesture
): Promise<void> {
  const existing = await getReferencesByLessonId(gesture.lessonId);
  const idx = existing.findIndex((r) => r.id === gesture.id);

  if (idx >= 0) {
    if (gesture.isPrimary) {
      existing.forEach((r) => {
        r.isPrimary = false;
      });
    }
    existing[idx] = gesture;
    await persistLessonReferences(gesture.lessonId, existing);
  } else {
    await addReference(gesture);
  }
}

/**
 * Set a specific reference as the primary reference for a lesson
 */
export async function setPrimaryReference(
  lessonId: string,
  refId: string
): Promise<void> {
  const existing = await getReferencesByLessonId(lessonId);
  let found = false;

  existing.forEach((r) => {
    if (r.id === refId) {
      r.isPrimary = true;
      found = true;
    } else {
      r.isPrimary = false;
    }
  });

  if (found) {
    await persistLessonReferences(lessonId, existing);
  }
}

/**
 * Delete a specific reference by its unique ID
 */
export async function deleteReference(
  id: string
): Promise<void> {
  // Find lessonId of this reference
  const target = await getReferenceGestureById(id);
  if (!target) return;

  const existing = await getReferencesByLessonId(target.lessonId);
  const remaining = existing.filter((r) => r.id !== id);

  // If deleted reference was primary, promote the best remaining reference
  if (target.isPrimary && remaining.length > 0) {
    const bestRemaining = getBestReference(remaining);
    if (bestRemaining) {
      bestRemaining.isPrimary = true;
    }
  }

  await persistLessonReferences(target.lessonId, remaining);
}

/**
 * Clear all references for a lesson (or all stored lessons)
 */
export async function clearReferences(
  lessonId?: string
): Promise<void> {
  if (lessonId) {
    memoryStorage.delete(lessonId);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(`${STORAGE_MULTI_PREFIX}${lessonId}`);
        window.localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${lessonId}`);
      } catch {
        // ignore
      }
    }
  } else {
    memoryStorage.clear();
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith(STORAGE_MULTI_PREFIX) || key.startsWith(LEGACY_STORAGE_PREFIX))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Count the total number of references for a given lesson
 */
export async function countReferences(
  lessonId: string
): Promise<number> {
  const refs = await getReferencesByLessonId(lessonId);
  return refs.length;
}

/**
 * Retrieve all Reference Gestures across all lessons from storage.
 * Automatically incorporates seed references for lessons that do not have custom recordings.
 * 
 * @param options.includeSeeds If true (default), includes built-in seed references for lessons with no stored references.
 *                              If false, only returns references actively persisted in custom storage/memory.
 */
export async function getAllStoredReferences(options?: {
  includeSeeds?: boolean;
}): Promise<ReferenceGesture[]> {
  const includeSeeds = options?.includeSeeds ?? true;
  const referencesByLesson = new Map<string, ReferenceGesture[]>();

  // 1. Gather from LocalStorage if available
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(STORAGE_MULTI_PREFIX)) {
          const lessonId = key.slice(STORAGE_MULTI_PREFIX.length);
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const list = parseStoredReferences(raw);
            if (list.length > 0) {
              referencesByLesson.set(lessonId, list);
            }
          }
        } else if (key && key.startsWith(LEGACY_STORAGE_PREFIX)) {
          const lessonId = key.slice(LEGACY_STORAGE_PREFIX.length);
          if (!referencesByLesson.has(lessonId)) {
            const raw = window.localStorage.getItem(key);
            if (raw) {
              const list = parseStoredReferences(raw);
              if (list.length > 0) {
                referencesByLesson.set(lessonId, list);
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Gather from memoryStorage for any lessons in memory
  for (const [lessonId, list] of memoryStorage.entries()) {
    if (list && list.length > 0) {
      referencesByLesson.set(lessonId, list);
    }
  }

  // 3. Fallback to SEED_REFERENCE_GESTURES if includeSeeds is true
  if (includeSeeds) {
    for (const [lessonId, seedList] of Object.entries(SEED_REFERENCE_GESTURES)) {
      if (!referencesByLesson.has(lessonId) && seedList && seedList.length > 0) {
        referencesByLesson.set(lessonId, seedList);
      }
    }
  }

  // 4. Flatten, rank per lesson, and deduplicate by ID without mutating originals
  const result: ReferenceGesture[] = [];
  const seenIds = new Set<string>();

  for (const list of referencesByLesson.values()) {
    const ranked = rankReferences(list);
    for (const ref of ranked) {
      if (!seenIds.has(ref.id)) {
        seenIds.add(ref.id);
        result.push(JSON.parse(JSON.stringify(ref)));
      }
    }
  }

  return result;
}

/**
 * Bulk import an array of Reference Gestures into storage.
 * Performs low-level structural and unique ID validation.
 * 
 * Throws an Error if:
 * - input is not an Array
 * - any reference lacks id or lessonId
 * - frames is not an array
 * - duplicate IDs are found within incoming list or already existing in storage
 */
export async function bulkImportReferences(
  refs: ReferenceGesture[]
): Promise<void> {
  if (!Array.isArray(refs)) {
    throw new Error("ข้อมูล References ที่ส่งเข้ามาต้องเป็น Array");
  }

  if (refs.length === 0) {
    return;
  }

  // 1. Validate incoming reference items and internal duplicate IDs
  const incomingIds = new Set<string>();
  const clonedRefs: ReferenceGesture[] = [];

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    if (!ref || typeof ref !== "object") {
      throw new Error(`Reference รายการที่ ${i + 1} ไม่ถูกต้อง`);
    }

    const id = ref.id?.trim();
    if (!id) {
      throw new Error(`Reference รายการที่ ${i + 1} ไม่มี id หรือ id ว่างเปล่า`);
    }

    const lessonId = ref.lessonId?.trim();
    if (!lessonId) {
      throw new Error(`Reference "${id}" ขาดข้อมูล lessonId`);
    }

    if (!Array.isArray(ref.frames)) {
      throw new Error(`Reference "${id}" ข้อมูล frames ต้องเป็น Array`);
    }

    if (incomingIds.has(id)) {
      throw new Error(`พบ Reference ID ซ้ำกันในชุดข้อมูลที่นำเข้า: "${id}"`);
    }
    incomingIds.add(id);

    // Deep clone to prevent mutating input objects
    const cloned: ReferenceGesture = JSON.parse(JSON.stringify(ref));
    cloned.id = id;
    cloned.lessonId = lessonId;

    // Compute quality score if missing
    if (cloned.qualityScore === undefined) {
      const qualityResult = evaluateReferenceQuality(cloned);
      cloned.qualityScore = qualityResult.scorePercent;
      cloned.qualityLevel = qualityResult.level;
    }

    clonedRefs.push(cloned);
  }

  // 2. Check for duplicate IDs against existing storage
  const existingAll = await getAllStoredReferences({ includeSeeds: false });
  const existingIdMap = new Set(existingAll.map((r) => r.id));

  for (const ref of clonedRefs) {
    if (existingIdMap.has(ref.id)) {
      throw new Error(`Reference ID "${ref.id}" มีอยู่ในระบบแล้ว`);
    }
  }

  // 3. Group by lessonId and persist
  const grouped = new Map<string, ReferenceGesture[]>();
  for (const ref of clonedRefs) {
    const list = grouped.get(ref.lessonId) || [];
    list.push(ref);
    grouped.set(ref.lessonId, list);
  }

  for (const [lessonId, incomingList] of grouped.entries()) {
    const existingForLesson = await getReferencesByLessonId(lessonId);
    // Check if memory or localStorage has custom stored references for this lesson
    const hasCustomStorage = memoryStorage.has(lessonId) || 
      (typeof window !== "undefined" && window.localStorage && !!window.localStorage.getItem(`${STORAGE_MULTI_PREFIX}${lessonId}`));
    
    const baseList = hasCustomStorage ? existingForLesson : [];
    
    // Check if any incoming has primary or if baseList is empty
    const hasIncomingPrimary = incomingList.some((r) => r.isPrimary);
    if (!hasIncomingPrimary && baseList.length === 0 && incomingList.length > 0) {
      incomingList[0].isPrimary = true;
    } else if (hasIncomingPrimary) {
      baseList.forEach((r) => {
        r.isPrimary = false;
      });
    }

    const combined = [...baseList, ...incomingList];
    await persistLessonReferences(lessonId, combined);
  }
}

/**
 * Backward-compatible alias for addReference / saveReferenceGesture
 */
export async function saveReferenceGesture(
  gesture: ReferenceGesture
): Promise<void> {
  await addReference(gesture);
}

/**
 * Backward-compatible alias for deleteReferenceGesture
 */
export async function deleteReferenceGesture(
  lessonId: string
): Promise<void> {
  await clearReferences(lessonId);
}

