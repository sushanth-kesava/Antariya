const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

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

export type OrderItemInput = {
  productId: string;
  quantity: number;
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
  customization?: ProductCustomization;
};

export type Order = {
  id: string;
  userEmail?: string;
  userRole?: "customer" | "admin";
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  status: string;
  createdAt: string;
};

export async function createOrderOnBackend(token: string, items: OrderItemInput[]): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to place order");
  }

  return data.order as Order;
}

export async function getMyOrdersFromBackend(token: string): Promise<Order[]> {
  const response = await fetch(`${API_BASE_URL}/orders/my`, {
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
