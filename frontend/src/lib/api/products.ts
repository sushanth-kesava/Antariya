import { Product } from "@/app/lib/mock-data";
import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type ProductInput = {
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
  variants?: { sku?: string; size?: string; color?: string; gender?: string; neckType?: string; pattern?: string; price?: number; stock: number }[];
  image?: string;
  images?: string[];
  galleryImages?: string[];
  stock: number;
  rating?: number;
  customizable?: boolean;
  fileDownloadLink?: string | null;
};

export type MarketplaceRole = "customer" | "admin" | "superadmin";

export type MarketplaceDealerCategory = {
  name: string;
  count: number;
  products: Product[];
};

export type MarketplaceDealerSection = {
  dealerId: string;
  dealerName: string;
  categories: MarketplaceDealerCategory[];
};

export type MarketplaceLayoutResponse =
  | {
      success: true;
      role: "customer" | "admin";
      categories: string[];
    }
  | {
      success: true;
      role: "superadmin";
      dealerSections: MarketplaceDealerSection[];
    };

export type ProductReviewTag = "Quality" | "Fit" | "Delivery" | "Customization";

export type ProductReviewSummary = {
  reviewCount: number;
  averageRating: number;
  ratingBreakdown: Record<string, number>;
  reviewImageCount: number;
};

export type ProductReview = {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  images: string[];
  verified: boolean;
  tags: ProductReviewTag[];
  moderationStatus?: ReviewModerationStatus;
  createdAt: string;
};

export type ReviewEligibility = {
  productId: string;
  productName: string;
  canReview: boolean;
  hasDeliveredOrder: boolean;
  hasReviewed: boolean;
  existingReview: ProductReview | null;
  message: string;
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
  images?: string[];
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
  subCategory?: string | null;
  size?: string | null;
  color?: string | null;
  gender?: string | null;
  neckType?: string | null;
  pattern?: string | null;
  search?: string;
  dealerId?: string;
  customizable?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ products: Product[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const query = toQueryString({
    category: filters?.category || undefined,
    subCategory: filters?.subCategory || undefined,
    size: filters?.size || undefined,
    color: filters?.color || undefined,
    gender: filters?.gender || undefined,
    neckType: filters?.neckType || undefined,
    pattern: filters?.pattern || undefined,
    search: filters?.search || undefined,
    dealerId: filters?.dealerId,
    customizable: typeof filters?.customizable === "boolean" ? filters.customizable : undefined,
    page: filters?.page ? String(filters.page) : undefined,
    limit: filters?.limit ? String(filters.limit) : undefined,
  });

  const response = await fetch(`${API_BASE_URL}/products${query ? `?${query}` : ""}`);
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to fetch products");
  }

  return {
    products: data.products as Product[],
    pagination: data.pagination || { page: 1, limit: 20, total: 0, pages: 0 },
  };
}

export async function getMarketplaceLayoutFromBackend(role: MarketplaceRole): Promise<MarketplaceLayoutResponse> {
  const response = await fetch(`${API_BASE_URL}/products/marketplace?role=${encodeURIComponent(role)}`);
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to fetch marketplace layout");
  }

  return data as MarketplaceLayoutResponse;
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

export async function getProductReviewsFromBackend(productId: string): Promise<{
  reviews: ProductReview[];
  summary: ProductReviewSummary;
}> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/reviews`);
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to fetch product reviews");
  }

  return {
    reviews: (data.reviews || []) as ProductReview[],
    summary: (data.summary || {
      reviewCount: 0,
      averageRating: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      reviewImageCount: 0,
    }) as ProductReviewSummary,
  };
}

export async function getReviewEligibilityFromBackend(token: string, productId: string): Promise<ReviewEligibility> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/review-eligibility`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load review eligibility");
  }

  return data as ReviewEligibility;
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

export async function uploadProductImagesToBackend(token: string, files: File[]): Promise<string[]> {
  const formData = new FormData();

  for (const file of files.slice(0, 6)) {
    formData.append("images", file);
  }

  const response = await fetch(`${API_BASE_URL}/products/upload-images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to upload product images");
  }

  return Array.isArray(data.images) ? (data.images as string[]) : [];
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


export type InventoryEntry = {
  productId: string;
  name: string;
  sku: string;
  variantLabel: string;
  stock: number;
  reorderPoint: number;
  image: string;
};

export type InventoryReport = {
  summary: {
    totalProducts: number;
    totalVariants: number;
    totalUnits: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  lowStock: InventoryEntry[];
  outOfStock: InventoryEntry[];
};

export async function getInventoryReportFromBackend(token: string): Promise<InventoryReport> {
  const response = await fetch(`${API_BASE_URL}/products/admin/inventory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load inventory report");
  }
  return {
    summary: data.summary,
    lowStock: data.lowStock || [],
    outOfStock: data.outOfStock || [],
  };
}


export type StockAdjustmentEntry = {
  id: string;
  productId: string;
  productName: string;
  variantSku: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  performedByEmail: string;
  createdAt: string;
};

export async function adjustStockOnBackend(
  token: string,
  productId: string,
  payload: { type: "add" | "remove" | "set"; quantity: number; variantSku?: string; reason?: string }
): Promise<{ adjustment: StockAdjustmentEntry; product: Product }> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/adjust-stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to adjust stock");
  }
  return { adjustment: data.adjustment as StockAdjustmentEntry, product: data.product as Product };
}

export async function getStockHistoryFromBackend(token: string, productId?: string): Promise<StockAdjustmentEntry[]> {
  const query = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  const response = await fetch(`${API_BASE_URL}/products/admin/stock-history${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load stock history");
  }
  return (data.history || []) as StockAdjustmentEntry[];
}

export async function updateInventorySettingsOnBackend(
  token: string,
  productId: string,
  payload: { reorderPoint?: number; variantReorderPoints?: Record<string, number> }
): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/inventory-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to update inventory settings");
  }
  return data.product as Product;
}


export async function exportInventoryCsvFromBackend(token: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/products/admin/inventory/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Failed to export inventory");
  }
  return await response.text();
}

export async function importInventoryCsvToBackend(
  token: string,
  csv: string
): Promise<{ updated: number; errors: string[] }> {
  const response = await fetch(`${API_BASE_URL}/products/admin/inventory/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ csv }),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to import inventory");
  }
  return { updated: data.updated || 0, errors: data.errors || [] };
}
