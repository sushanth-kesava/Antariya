import { Product } from "@/app/lib/mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

export type WishlistItem = {
  id: string;
  productId: string;
  product: Product;
  createdAt: string;
};

export async function getWishlistFromBackend(token: string): Promise<WishlistItem[]> {
  const response = await fetch(`${API_BASE_URL}/wishlist`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load wishlist");
  }

  return (data.wishlist || []) as WishlistItem[];
}

export async function setWishlistItemOnBackend(
  token: string,
  productId: string,
  saved: boolean
): Promise<{ saved: boolean; item?: WishlistItem }> {
  const response = await fetch(`${API_BASE_URL}/wishlist/${productId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ saved }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to update wishlist");
  }

  return {
    saved: Boolean(data.saved),
    item: data.item as WishlistItem | undefined,
  };
}
