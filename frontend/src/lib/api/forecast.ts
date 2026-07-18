const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5004/api";

export interface ForecastDashboard {
  revenue: { current: number; previous: number; growth: number; forecast: number };
  orders: { current: number; previous: number };
  topSelling: { productId: string; name: string; sku: string; category: string; totalQty: number; totalRevenue: number }[];
  deadStock: { name: string; sku: string; stock: number }[];
  stockoutRisk: { productId: string; name: string; sku: string; currentStock: number; dailySales: string; daysUntilStockout: number; suggestedReorder: number }[];
  categoryPerformance: { _id: string; totalRevenue: number; totalOrders: number }[];
  monthlyTrend: { _id: string; revenue: number; orders: number }[];
}

async function apiFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json(); if (!res.ok || !data.success) throw new Error(data.message || 'Error'); return data.data;
}

export async function getForecastDashboard(token: string) { return apiFetch<ForecastDashboard>("/forecast/dashboard", token); }
