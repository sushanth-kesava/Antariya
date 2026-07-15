import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type StockCheckRequest = {
  productId: string;
  variantSku?: string;
  quantity: number;
};

export type StockCheckResult = {
  productId: string;
  variantSku?: string;
  quantity: number;
  available: number;
  isAvailable: boolean;
  productName?: string;
};

export type StockCheckResponse = {
  success: boolean;
  items: StockCheckResult[];
  allAvailable: boolean;
  message?: string;
};

/**
 * Check stock availability for multiple cart items before checkout.
 * Validates product-level and variant-level stock in a single request.
 */
export async function checkStockAvailability(
  token: string,
  items: StockCheckRequest[]
): Promise<StockCheckResponse> {
  const response = await fetch(`${API_BASE_URL}/inventory/check-stock`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to check stock availability");
  }

  return response.json();
}

/**
 * Get detailed stock info for a single product, including all variants.
 */
export async function getProductStockDetails(productId: string) {
  const response = await fetch(`${API_BASE_URL}/inventory/product/${productId}/stock`);

  if (!response.ok) {
    throw new Error("Failed to fetch product stock details");
  }

  return response.json();
}
