import { Lesson } from "@/types";
import { INITIAL_LESSONS } from "./seedLessons";
import {
  getLessons as storageGetLessons,
  getLessonById as storageGetLessonById,
  getLessonsByCategoryId as storageGetLessonsByCategoryId,
} from "@/lib/storage/lessonStorage";

export const initialLessons: Lesson[] = INITIAL_LESSONS;


export async function getLessons(): Promise<Lesson[]> {
  return storageGetLessons();
}

export async function getLessonsByCategory(categoryId: string): Promise<Lesson[]> {
  return storageGetLessonsByCategoryId(categoryId);
}

export async function getLessonsByCategoryId(categoryId: string): Promise<Lesson[]> {
  return storageGetLessonsByCategoryId(categoryId);
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  return storageGetLessonById(id);
}

