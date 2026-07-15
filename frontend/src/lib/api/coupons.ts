import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

// ─── Types ───────────────────────────────────────────────────────────────────

export type CouponDiscountType = "percentage" | "flat" | "free_shipping";

export type Coupon = {
  _id: string;
  code: string;
  title: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number;
  validFrom: string;
  validUntil: string;
  maxUses: number | null;
  maxUsesPerUser: number;
  currentUses: number;
  showOnHero: boolean;
  heroBannerText: string;
  heroBannerColor: string;
  applicableCategories: string[];
  active: boolean;
  isValid: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type HeroCoupon = Pick<
  Coupon,
  "code" | "title" | "description" | "discountType" | "discountValue" | "maxDiscount" | "minOrderValue" | "heroBannerText" | "heroBannerColor" | "validUntil"
>;

export type CouponValidationResult = {
  code: string;
  title: string;
  discountType: CouponDiscountType;
  discountValue: number;
  discount: number; // actual discount in paise
  freeShipping: boolean;
};

export type CreateCouponPayload = {
  code: string;
  title: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue?: number;
  validFrom: string;
  validUntil: string;
  maxUses?: number | null;
  maxUsesPerUser?: number;
  showOnHero?: boolean;
  heroBannerText?: string;
  heroBannerColor?: string;
  applicableCategories?: string[];
};

// ─── Public: Get hero coupons for homepage ───────────────────────────────────

export async function getHeroCoupons(): Promise<HeroCoupon[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/coupons/hero`, {
      credentials: "include",
    });
    const data = await response.json();
    return data.success ? data.coupons : [];
  } catch {
    return [];
  }
}

// ─── Customer: Validate coupon at checkout ───────────────────────────────────

export async function validateCouponCode(
  token: string,
  code: string,
  subtotal: number,
  quantity?: number
): Promise<{ success: boolean; message: string; coupon?: CouponValidationResult }> {
  const response = await fetch(`${API_BASE_URL}/coupons/validate`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code, subtotal, quantity: quantity || 0 }),
  });

  const data = await response.json();
  return data;
}

// ─── Superadmin: CRUD operations ─────────────────────────────────────────────

export async function listAllCoupons(token: string): Promise<Coupon[]> {
  const response = await fetch(`${API_BASE_URL}/coupons`, {
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.success ? data.coupons : [];
}

export async function createCouponOnBackend(
  token: string,
  payload: CreateCouponPayload
): Promise<{ success: boolean; message: string; coupon?: Coupon }> {
  const response = await fetch(`${API_BASE_URL}/coupons`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function updateCouponOnBackend(
  token: string,
  couponId: string,
  updates: Partial<CreateCouponPayload & { active: boolean }>
): Promise<{ success: boolean; message: string; coupon?: Coupon }> {
  const response = await fetch(`${API_BASE_URL}/coupons/${couponId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  return response.json();
}

export async function deleteCouponOnBackend(
  token: string,
  couponId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/coupons/${couponId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}
