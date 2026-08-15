import { Category } from "@/types";
import { INITIAL_CATEGORIES } from "./seedCategories";
import {
  getCategories as storageGetCategories,
  getCategoryById as storageGetCategoryById,
} from "@/lib/storage/categoryStorage";

export const initialCategories: Category[] = INITIAL_CATEGORIES;


export async function getCategories(): Promise<Category[]> {
  return storageGetCategories();
}

export async function getCategoryById(id: string): Promise<Category | null> {
  return storageGetCategoryById(id);
}

