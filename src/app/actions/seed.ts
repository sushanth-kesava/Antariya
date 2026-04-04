
'use server';

import { seedProductsOnBackend } from "@/lib/api/products";

export async function runSeeding() {
  try {
    const result = await seedProductsOnBackend();
    return result;
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
