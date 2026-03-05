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
  image: string;
  stock: number;
  fileDownloadLink?: string;
  rating: number;
}

export const CATEGORIES = [
  'Embroidery Designs',
  'Machine Threads',
  'Fabrics',
  'Stabilizers',
  'Needles',
  'Hoops & Frames',
  'Spare Parts',
  'Accessories'
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
    id: '3',
    name: 'Cotton Linen Blend - Off White',
    description: 'Perfect weight for home decor embroidery projects.',
    price: 15.50,
    category: 'Fabrics',
    dealerId: 'd2',
    image: 'https://picsum.photos/seed/fabric1/400/400',
    stock: 200,
    rating: 4.2
  },
  {
    id: '4',
    name: 'Precision Embroidery Hoop 150x150',
    description: 'Compatible with major machine brands. High-grip surface.',
    price: 28.00,
    category: 'Hoops & Frames',
    dealerId: 'd2',
    image: 'https://picsum.photos/seed/tool1/400/400',
    stock: 15,
    rating: 4.9
  },
  {
    id: '5',
    name: 'Mandala Spirit Pattern',
    description: 'Intricate spiritual geometric design. Digital download.',
    price: 12.00,
    category: 'Embroidery Designs',
    dealerId: 'd3',
    image: 'https://picsum.photos/seed/design2/600/600',
    stock: 999,
    fileDownloadLink: '/designs/mandala.zip',
    rating: 5.0
  }
];

export const CURRENT_USER: User = {
  id: 'u1',
  name: 'Arjun Sharma',
  email: 'arjun@example.com',
  role: 'customer'
};