
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "./config";
import { Product, CATEGORIES } from "@/app/lib/mock-data";

export async function getProducts(categoryFilter?: string | null) {
  const productsCol = collection(db, 'products');
  
  // Simplified query to avoid requiring composite indexes immediately.
  // We apply sorting after fetching for the MVP.
  let q;
  if (categoryFilter) {
    q = query(productsCol, where('category', '==', categoryFilter));
  } else {
    q = query(productsCol, orderBy('createdAt', 'desc'));
  }
  
  const snapshot = await getDocs(q);
  const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
  
  // Manual sorting if we used a where filter to ensure the UI stays consistent
  if (categoryFilter) {
    return products.sort((a, b) => 0); // No reliable createdAt on mock items without index, returning as is
  }
  
  return products;
}

export async function getProductById(id: string) {
  const docRef = doc(db, 'products', id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Product;
  }
  return null;
}

export async function getCategories() {
  return CATEGORIES;
}

export async function seedDatabase(products: any[]) {
  const productsCol = collection(db, 'products');
  const existing = await getDocs(productsCol);
  
  if (existing.empty) {
    for (const product of products) {
      await addDoc(productsCol, {
        ...product,
        createdAt: serverTimestamp(),
      });
    }
    return true;
  }
  return false;
}
