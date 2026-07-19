import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type ProductCustomization = {
  symbol: string;
  threadColor: string;
  fabricColor: string;
  size: "Small" | "Medium" | "Large";
  placement: string;
  referenceImage?: string;
  referenceImageName?: string;
  notes?: string;
};

export type OrderVariant = {
  sku?: string;
  size?: string;
  color?: string;
  gender?: string;
  neckType?: string;
  pattern?: string;
};

export type OrderItemInput = {
  productId: string;
  quantity: number;
  variantSku?: string;
  customization?: ProductCustomization;
};

export type OrderItem = {
  productId: string;
  dealerId?: string;
  dealerName?: string;
  dealerEmail?: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variantSku?: string;
  variant?: OrderVariant;
  customization?: ProductCustomization;
};

export type Order = {
  id: string;
  userEmail?: string;
  userRole?: "customer" | "admin";
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  coupon?: {
    code: string;
    discountType: string;
    discountAmount: number;
    freeShipping: boolean;
  } | null;
  tax: number;
  total: number;
  status: string;
  createdAt: string;
  paymentMethod?: "upi" | "cod";
  paymentStatus?: "pending" | "paid" | "failed";
  razorpayPaymentId?: string;
  deliveryPrepaid?: boolean;
  amountPrepaid?: number;
  amountDueOnDelivery?: number;
};

export type PaymentVerification = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export async function createOrderOnBackend(
  token: string,
  items: OrderItemInput[],
  paymentMethod?: "upi" | "cod",
  payment?: PaymentVerification,
  couponCode?: string
): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items, paymentMethod, couponCode: couponCode || undefined, ...(payment || {}) }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to place order");
  }

  return data.order as Order;
}

export async function getMyOrdersFromBackend(token: string): Promise<Order[]> {
  const response = await fetch(`${API_BASE_URL}/orders/my`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to fetch orders");
  }

  return (data.orders || []) as Order[];
}

export type AdminDashboardSummary = {
  customers: number;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  todayOrders: number;
  lowStockProducts: number;
  pendingReviews: number;
  wishlistItems: number;
};

export type AdminDashboardStatusBreakdown = {
  Processing: number;
  Shipped: number;
  Delivered: number;
  Cancelled: number;
};

export type AdminDashboardPayload = {
  summary: AdminDashboardSummary;
  recentOrders: Order[];
  statusBreakdown: AdminDashboardStatusBreakdown;
};

export async function getAdminDashboardFromBackend(token: string): Promise<AdminDashboardPayload> {
  const response = await fetch(`${API_BASE_URL}/orders/admin/dashboard`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load admin dashboard");
  }

  return {
    summary: data.summary as AdminDashboardSummary,
    recentOrders: (data.recentOrders || []) as Order[],
    statusBreakdown: data.statusBreakdown as AdminDashboardStatusBreakdown,
  };
}

export async function updateAdminOrderStatusOnBackend(
  token: string,
  orderId: string,
  status: Order["status"]
): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders/admin/${orderId}/status`, {
    credentials: "include",
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to update order status");
  }

  return data.order as Order;
}

export async function cancelMyOrderOnBackend(token: string, orderId: string): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders/my/${orderId}/cancel`, {
    credentials: "include",
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to cancel order");
  }

  return data.order as Order;
}
