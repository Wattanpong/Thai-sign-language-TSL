import { Lesson } from "@/types";

export const initialLessons: Lesson[] = [
  {
    id: "hello",
    categoryId: "greeting-basic",
    word: "สวัสดี",
    description: "พนมมือระดับอกแล้วก้มศีรษะลงเล็กน้อย",
    gestureType: "dynamic",
    order: 1,
    difficulty: "beginner",
    isActive: true,
  },
  {
    id: "thank-you",
    categoryId: "greeting-basic",
    word: "ขอบคุณ",
    description: "แตะปลายนิ้วที่คางหรือหน้าอกแล้วยื่นมือออกไปข้างหน้าพร้อมก้มศีรษะเล็กน้อย",
    gestureType: "dynamic",
    order: 2,
    difficulty: "beginner",
    isActive: true,
  },
  {
    id: "sorry",
    categoryId: "greeting-basic",
    word: "ขอโทษ",
    description: "กำมือหลวมๆ แล้ววนเป็นวงกลมบริเวณหน้าอกด้านซ้าย",
    gestureType: "dynamic",
    order: 3,
    difficulty: "beginner",
    isActive: true,
  },
  {
    id: "comfortable",
    categoryId: "greeting-basic",
    word: "สบาย",
    description: "หงายมือระดับอกแล้วปัดมือลงเบาๆ แสดงความโล่งใจและผ่อนคลาย",
    gestureType: "dynamic",
    order: 4,
    difficulty: "beginner",
    isActive: true,
  },
  {
    id: "yes",
    categoryId: "greeting-basic",
    word: "ใช่",
    description: "กำมือชูนิ้วชี้หรือผงกมือลงไปข้างหน้า แสดงการตอบรับ",
    gestureType: "dynamic",
    order: 5,
    difficulty: "beginner",
    isActive: true,
  },
  {
    id: "no",
    categoryId: "greeting-basic",
    word: "ไม่ใช่",
    description: "คว่ำมือระดับอกแล้วส่ายมือไปมาซ้ายขวา แสดงการปฏิเสธ",
    gestureType: "dynamic",
    order: 6,
    difficulty: "beginner",
    isActive: true,
  },
  {
    id: "never-mind",
    categoryId: "greeting-basic",
    word: "ไม่เป็นไร",
    description: "คว่ำมือหรือหงายมือแล้วปัดออกไปด้านข้าง แสดงความไม่ถือสา",
    gestureType: "dynamic",
    order: 7,
    difficulty: "beginner",
    isActive: true,
  },
];

export async function getLessons(): Promise<Lesson[]> {
  return initialLessons
    .filter((lesson) => lesson.isActive !== false)
    .sort((a, b) => a.order - b.order);
}

export async function getLessonsByCategory(categoryId: string): Promise<Lesson[]> {
  return initialLessons
    .filter((lesson) => lesson.categoryId === categoryId && lesson.isActive !== false)
    .sort((a, b) => a.order - b.order);
}

export async function getLessonsByCategoryId(categoryId: string): Promise<Lesson[]> {
  return getLessonsByCategory(categoryId);
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  const lesson = initialLessons.find((item) => item.id === id);
  return lesson ?? null;
}
