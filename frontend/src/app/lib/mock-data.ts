export type Role = 'customer' | 'dealer' | 'admin' | 'superadmin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  dealerId: string;
  dealerName?: string;
  dealerEmail?: string | null;
  image: string;
  images?: string[];
  galleryImages?: string[];
  stock: number;
  fileDownloadLink?: string;
  rating: number;
  customizable?: boolean;
}

export const CATEGORIES = [
  'Embroidery Designs',
  'Machine Threads',
  'Fabrics',
  'Needles',
  'Accessories',
  'Hoodies',
  'Blouses'
];

