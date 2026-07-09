export type Role = 'customer' | 'dealer' | 'admin' | 'superadmin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ProductVariant {
  sku?: string;
  size?: string;
  color?: string;
  gender?: string;
  neckType?: string;
  pattern?: string;
  price?: number;
  stock: number;
  reorderPoint?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subCategory?: string;
  size?: string;
  color?: string;
  gender?: string;
  neckType?: string;
  pattern?: string;
  sizes?: string[];
  colors?: string[];
  genders?: string[];
  neckTypes?: string[];
  patterns?: string[];
  variants?: ProductVariant[];
  dealerId: string;
  dealerName?: string;
  dealerEmail?: string | null;
  image: string;
  images?: string[];
  galleryImages?: string[];
  stock: number;
  fileDownloadLink?: string;
  rating: number;
  reviewCount?: number;
  reviewAverage?: number;
  reviewBreakdown?: Record<string, number>;
  reviewImageCount?: number;
  customizable?: boolean;
}

