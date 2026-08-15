export interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  order: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

