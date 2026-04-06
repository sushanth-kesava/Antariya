import { Product } from "@/app/lib/mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

export type ProductInput = {
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock: number;
  rating?: number;
  customizable?: boolean;
  fileDownloadLink?: string | null;
};

export type ProductReviewTag = "Quality" | "Fit" | "Delivery" | "Customization";

export type ProductReview = {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verified: boolean;
  tags: ProductReviewTag[];
  moderationStatus?: ReviewModerationStatus;
  createdAt: string;
};

export type ReviewModerationStatus = "approved" | "hidden" | "flagged" | "pending";

export type ModerationReview = ProductReview & {
  productName: string;
  productCategory: string | null;
  userEmail: string;
  moderationStatus: ReviewModerationStatus;
  moderationNote: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
};

export type ModerationActivityItem = ModerationReview & {
  moderatorName: string;
};

export type ProductReviewInput = {
  rating: number;
  title: string;
  comment: string;
  tags?: ProductReviewTag[];
};

function toQueryString(params: Record<string, string | boolean | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "undefined") {
      continue;
    }

    query.set(key, String(value));
  }

  return query.toString();
}

export async function getProductsFromBackend(filters?: {
  category?: string | null;
  search?: string;
  dealerId?: string;
  customizable?: boolean;
}): Promise<Product[]> {
  const query = toQueryString({
    category: filters?.category || undefined,
    search: filters?.search || undefined,
    dealerId: filters?.dealerId,
    customizable: typeof filters?.customizable === "boolean" ? filters.customizable : undefined,
  });

  const response = await fetch(`${API_BASE_URL}/products${query ? `?${query}` : ""}`);
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to fetch products");
  }

  return data.products as Product[];
}

export async function getProductByIdFromBackend(id: string): Promise<Product | null> {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);

  if (response.status === 404) {
    return null;
  }

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to fetch product");
  }

  return data.product as Product;
}

export async function getProductReviewsFromBackend(productId: string): Promise<ProductReview[]> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/reviews`);
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to fetch product reviews");
  }

  return (data.reviews || []) as ProductReview[];
}

export async function addProductReviewOnBackend(
  token: string,
  productId: string,
  payload: ProductReviewInput
): Promise<ProductReview> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to submit review");
  }

  return data.review as ProductReview;
}

export async function getReviewModerationQueueFromBackend(
  token: string,
  filters?: { status?: ReviewModerationStatus | "all"; search?: string }
): Promise<ModerationReview[]> {
  const query = toQueryString({
    status: filters?.status && filters.status !== "all" ? filters.status : undefined,
    search: filters?.search?.trim() ? filters.search.trim() : undefined,
  });

  const response = await fetch(`${API_BASE_URL}/products/admin/reviews${query ? `?${query}` : ""}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load review moderation queue");
  }

  return (data.reviews || []) as ModerationReview[];
}

export async function updateReviewModerationOnBackend(
  token: string,
  reviewId: string,
  payload: { moderationStatus: ReviewModerationStatus; moderationNote?: string }
): Promise<ModerationReview> {
  const response = await fetch(`${API_BASE_URL}/products/admin/reviews/${reviewId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to update review moderation");
  }

  return data.review as ModerationReview;
}

export async function getReviewModerationActivityFromBackend(
  token: string,
  limit = 25
): Promise<ModerationActivityItem[]> {
  const response = await fetch(`${API_BASE_URL}/products/admin/reviews/activity?limit=${Math.min(Math.max(limit, 1), 200)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load moderation activity");
  }

  return (data.activity || []) as ModerationActivityItem[];
}

export async function createProductOnBackend(token: string, payload: ProductInput): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to create product");
  }

  return data.product as Product;
}

export async function deleteProductOnBackend(token: string, productId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to delete product");
  }
}

export async function seedProductsOnBackend(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/products/seed`, {
    method: "POST",
  });

  const data = await response.json();

  return {
    success: Boolean(data?.success),
    message: data?.message || "Unknown response",
  };
}
