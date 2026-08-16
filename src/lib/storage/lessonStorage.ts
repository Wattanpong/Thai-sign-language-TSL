import { Lesson, GestureType, DifficultyLevel } from "@/types";
import { INITIAL_LESSONS } from "@/data/seedLessons";
import { getCategoryById } from "./categoryStorage";
import { clearReferences } from "./referenceStorage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchLessonsFromSupabase,
  upsertLessonToSupabase,
  deleteLessonFromSupabase,
  syncLessonsWithCloud,
} from "@/lib/supabase/supabaseLessonStorage";

const LESSON_STORAGE_KEY = "tsl_lessons";

// In-memory fallback for SSR / non-browser / test environments
let memoryLessons: Lesson[] = JSON.parse(JSON.stringify(INITIAL_LESSONS));
let hasInitialCloudSynced = false;

/**
 * Normalizes and parses raw stored lesson data
 */
function parseStoredLessons(data: string): Lesson[] {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed as Lesson[];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Helper to fetch all raw lessons from localStorage or memory
 */
function loadAllLessons(): Lesson[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const data = window.localStorage.getItem(LESSON_STORAGE_KEY);
      if (data) {
        const parsed = parseStoredLessons(data);
        if (parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback to memory
    }
  }
  return [...memoryLessons];
}

/**
 * Helper to persist lessons to memory & localStorage
 */
function persistLessons(lessons: Lesson[]): void {
  memoryLessons = [...lessons];

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(LESSON_STORAGE_KEY, JSON.stringify(lessons));
    } catch {
      // quota or private mode fallback
    }
  }
}

/**
 * Generate a clean ID/slug for a lesson
 */
export function generateLessonSlug(word: string): string {
  const trimmed = word.trim().toLowerCase();
  const slug = trimmed
    .replace(/[^\u0E00-\u0E7Fa-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `lesson-${Date.now()}`;
}

/**
 * Retrieve all lessons
 * Reconciles with Supabase Database and falls back to local cache or seed lessons
 */
export async function getLessons(options?: {
  includeInactive?: boolean;
  forceCloudSync?: boolean;
}): Promise<Lesson[]> {
  let lessons = loadAllLessons();

  // Cloud sync if configured and forced or initial
  if (isSupabaseConfigured() && (options?.forceCloudSync || !hasInitialCloudSynced)) {
    try {
      const cloudLessons = await fetchLessonsFromSupabase();
      if (cloudLessons.length > 0) {
        lessons = cloudLessons;
        persistLessons(cloudLessons);
        hasInitialCloudSynced = true;
      }
    } catch {
      // fallback on network error
    }
  }

  const includeInactive = options?.includeInactive ?? false;

  return lessons
    .filter((lesson) => includeInactive || lesson.isActive !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Retrieve a single lesson by its ID
 */
export async function getLessonById(id: string): Promise<Lesson | null> {
  const lessons = await getLessons({ includeInactive: true });
  const found = lessons.find((item) => item.id === id);
  return found ? { ...found } : null;
}

/**
 * Retrieve lessons belonging to a specific category
 */
export async function getLessonsByCategoryId(
  categoryId: string,
  includeInactive = false
): Promise<Lesson[]> {
  const lessons = await getLessons({ includeInactive });

  return lessons
    .filter(
      (lesson) =>
        lesson.categoryId === categoryId &&
        (includeInactive || lesson.isActive !== false)
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Add a new lesson with validation and category relation check
 */
export async function addLesson(
  data: Partial<Lesson> & { word: string; categoryId: string }
): Promise<Lesson> {
  const word = data.word?.trim();
  if (!word) {
    throw new Error("คำศัพท์ห้ามว่าง");
  }

  const categoryId = data.categoryId?.trim();
  if (!categoryId) {
    throw new Error("กรุณาระบุหมวดหมู่");
  }

  // Validate category existence
  const category = await getCategoryById(categoryId);
  if (!category) {
    throw new Error(`ไม่พบหมวดหมู่รหัส "${categoryId}" ในระบบ`);
  }

  const existing = loadAllLessons();

  // Check duplicate word
  const isDuplicate = existing.some(
    (l) => l.word.trim().toLowerCase() === word.toLowerCase()
  );
  if (isDuplicate) {
    throw new Error(`คำศัพท์ "${word}" มีอยู่ในระบบแล้ว`);
  }

  // Determine ID
  let id = data.id?.trim();
  if (!id) {
    id = generateLessonSlug(word);
  }

  let finalId = id;
  let counter = 1;
  while (existing.some((l) => l.id === finalId)) {
    finalId = `${id}-${counter}`;
    counter++;
  }

  const now = new Date().toISOString();
  const maxOrder = existing.reduce((max, l) => Math.max(max, l.order ?? 0), 0);

  const newLesson: Lesson = {
    id: finalId,
    categoryId,
    word,
    description: data.description?.trim() || "",
    gestureType: (data.gestureType as GestureType) || "dynamic",
    order: data.order !== undefined && !isNaN(data.order) ? Number(data.order) : maxOrder + 1,
    difficulty: (data.difficulty as DifficultyLevel) || "beginner",
    example: data.example?.trim() || undefined,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdAt: now,
    updatedAt: now,
  };

  existing.push(newLesson);
  persistLessons(existing);

  if (isSupabaseConfigured()) {
    upsertLessonToSupabase(newLesson).catch((err) => {
      console.warn("[lessonStorage] Cloud upsert warning:", err);
    });
  }

  return newLesson;
}

/**
 * Update an existing lesson
 */
export async function updateLesson(data: Lesson): Promise<Lesson> {
  const id = data.id?.trim();
  if (!id) {
    throw new Error("รหัสคำศัพท์ไม่ถูกต้อง");
  }

  const word = data.word?.trim();
  if (!word) {
    throw new Error("คำศัพท์ห้ามว่าง");
  }

  const categoryId = data.categoryId?.trim();
  if (!categoryId) {
    throw new Error("กรุณาระบุหมวดหมู่");
  }

  // Validate category existence
  const category = await getCategoryById(categoryId);
  if (!category) {
    throw new Error(`ไม่พบหมวดหมู่รหัส "${categoryId}" ในระบบ`);
  }

  const existing = loadAllLessons();
  const idx = existing.findIndex((l) => l.id === id);

  if (idx === -1) {
    throw new Error(`ไม่พบคำศัพท์รหัส "${id}"`);
  }

  // Check duplicate word on other lessons
  const isDuplicate = existing.some(
    (l) => l.id !== id && l.word.trim().toLowerCase() === word.toLowerCase()
  );
  if (isDuplicate) {
    throw new Error(`คำศัพท์ "${word}" มีอยู่ในระบบแล้ว`);
  }

  const now = new Date().toISOString();
  const current = existing[idx];

  const updated: Lesson = {
    ...current,
    word,
    categoryId,
    description: data.description !== undefined ? data.description.trim() : current.description,
    gestureType: (data.gestureType as GestureType) || current.gestureType,
    difficulty: (data.difficulty as DifficultyLevel) || current.difficulty,
    order: data.order !== undefined && !isNaN(data.order) ? Number(data.order) : current.order,
    example: data.example !== undefined ? data.example.trim() : current.example,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : current.isActive,
    updatedAt: now,
  };

  existing[idx] = updated;
  persistLessons(existing);

  if (isSupabaseConfigured()) {
    upsertLessonToSupabase(updated).catch((err) => {
      console.warn("[lessonStorage] Cloud update warning:", err);
    });
  }

  return updated;
}

/**
 * Delete a lesson by ID
 * CASCADE: Automatically deletes all associated reference gestures to prevent orphan references
 */
export async function deleteLesson(id: string): Promise<boolean> {
  const existing = loadAllLessons();
  const target = existing.find((l) => l.id === id);

  if (!target) {
    return false;
  }

  const remaining = existing.filter((l) => l.id !== id);
  persistLessons(remaining);

  // CASCADE CLEANUP: Clear references associated with this lesson
  await clearReferences(id);

  if (isSupabaseConfigured()) {
    deleteLessonFromSupabase(id).catch((err) => {
      console.warn("[lessonStorage] Cloud delete warning:", err);
    });
  }

  return true;
}

/**
 * Synchronize lessons with Supabase Cloud
 */
export async function syncLessons(): Promise<{
  syncedToCloud: number;
  downloadedFromCloud: number;
  purgedFromLocal: number;
  allLessons: Lesson[];
  error?: string;
}> {
  const local = loadAllLessons();
  const syncResult = await syncLessonsWithCloud(local, { authoritativeCloud: true });
  if (syncResult.allLessons.length > 0) {
    persistLessons(syncResult.allLessons);
  }
  return syncResult;
}

/**
 * Force push seed lessons to Supabase Cloud
 */
export async function pushSeedLessonsToCloud() {
  const { pushSeedToSupabase } = await import("@/lib/supabase/supabaseLessonStorage");
  return pushSeedToSupabase();
}

/**
 * Reset lessons to initial seed dataset
 */
export async function resetLessonsToDefault(): Promise<void> {
  memoryLessons = JSON.parse(JSON.stringify(INITIAL_LESSONS));

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(LESSON_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

