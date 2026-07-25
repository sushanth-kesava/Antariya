import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type UnifiedRevenueStats = {
  total: number;
  today: number;
  week: number;
  month: number;
  marketplace: number;
  pos: number;
};

export type UnifiedOrderStats = {
  total: number;
  today: number;
  week: number;
  month: number;
  marketplace: number;
  pos: number;
};

export type UnifiedStatusBreakdown = {
  Processing: number;
  Shipped: number;
  Delivered: number;
  Cancelled: number;
};

export type UnifiedTopProduct = {
  name: string;
  totalQty: number;
  totalRevenue: number;
};

export type UnifiedRecentOrder = {
  id: string;
  source: "marketplace" | "pos";
  customer: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  invoiceNumber?: string;
  createdAt: string;
};

export type UnifiedRevenueTrendDay = {
  date: string;
  marketplace: number;
  pos: number;
  totalRevenue: number;
  marketplaceOrders: number;
  posOrders: number;
};

export type UnifiedChannelBreakdown = {
  marketplace: {
    revenue: number;
    orders: number;
    todayRevenue: number;
    todayOrders: number;
  };
  pos: {
    revenue: number;
    orders: number;
    todayRevenue: number;
    todayOrders: number;
  };
};

export type UnifiedOperationsPayload = {
  revenue: UnifiedRevenueStats;
  orders: UnifiedOrderStats;
  averageOrderValue: number;
  statusBreakdown: UnifiedStatusBreakdown;
  posCompleted: number;
  topSellingProducts: UnifiedTopProduct[];
  recentOrders: UnifiedRecentOrder[];
  revenueTrend: UnifiedRevenueTrendDay[];
  breakdown: UnifiedChannelBreakdown;
};

export async function getUnifiedOperationsStatsFromBackend(
  token: string
): Promise<UnifiedOperationsPayload> {
  const response = await fetch(`${API_BASE_URL}/stats/unified-operations`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load unified operations stats");
  }

  return data.unified as UnifiedOperationsPayload;
}
