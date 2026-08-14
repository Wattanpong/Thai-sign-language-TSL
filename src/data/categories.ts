import { Category } from "@/types";

export const initialCategories: Category[] = [
  {
    id: "greeting-basic",
    name: "ทักทาย พูดคุยเบื้องต้น",
    description: "คำศัพท์พื้นฐานสำหรับการทักทายและสื่อสารในชีวิตประจำวัน",
    order: 1,
    isActive: true,
  },
];

export async function getCategories(): Promise<Category[]> {
  return initialCategories
    .filter((cat) => cat.isActive !== false)
    .sort((a, b) => a.order - b.order);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const category = initialCategories.find((item) => item.id === id);
  return category ?? null;
}
