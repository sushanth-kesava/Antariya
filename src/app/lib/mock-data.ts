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

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Royal Zardosi Floral Pack',
    description: 'A collection of 5 traditional Indian floral designs optimized for high-speed machines.',
    price: 49.99,
    category: 'Embroidery Designs',
    dealerId: 'd1',
    image: 'https://picsum.photos/seed/design1/600/600',
    stock: 999,
    fileDownloadLink: '/designs/royal-zardosi.zip',
    rating: 4.8
  },
  {
    id: '2',
    name: 'Vibrant Silk Thread Set',
    description: 'Set of 24 colors, 1000m each. High sheen and break resistance.',
    price: 35.00,
    category: 'Machine Threads',
    dealerId: 'd1',
    image: 'https://picsum.photos/seed/thread1/400/400',
    stock: 50,
    rating: 4.5
  },
  {
    id: 'h1',
    name: 'Premium Cotton Hoodie - Jet Black',
    description: 'Heavyweight 400GSM cotton hoodie, perfect for intricate embroidery work.',
    price: 25.00,
    category: 'Hoodies',
    dealerId: 'd2',
    image: 'https://picsum.photos/seed/hoodie1/600/600',
    stock: 100,
    rating: 4.7,
    customizable: true
  },
  {
    id: 'b1',
    name: 'Silk Blend Blouse Piece',
    description: 'Unstitched blouse piece in rich silk, ready for custom zardosi embroidery.',
    price: 18.50,
    category: 'Blouses',
    dealerId: 'd2',
    image: 'https://picsum.photos/seed/blouse1/600/600',
    stock: 150,
    rating: 4.6,
    customizable: true
  }
];

export const CURRENT_USER: User = {
  id: 'u1',
  name: 'Arjun Sharma',
  email: 'arjun@example.com',
  role: 'customer'
};
