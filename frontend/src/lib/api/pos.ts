import { getApiBaseUrl } from "@/lib/api/base-url";
const API_BASE = getApiBaseUrl();

export interface POSInvoice { _id: string; invoiceNumber: string; customerName: string; customerPhone: string; items: { productName: string; variantSku: string; size: string; color: string; quantity: number; unitPrice: number; lineTotal: number }[]; subtotal: number; discountAmount: number; totalAmount: number; paymentMethod: string; paymentStatus: string; amountPaid: number; changeGiven: number; balanceDue: number; billedBy: { displayName: string }; createdAt: string; status: string; }
export interface POSDashboard { todayRevenue: number; todayOrders: number; monthRevenue: number; monthOrders: number; recentInvoices: POSInvoice[]; topProducts: { _id: string; totalQty: number; totalRevenue: number }[]; }
export interface POSProduct { _id: string; name: string; price: number; sku: string; stock: number; images: string[]; category: string; variants: { sku: string; size: string; color: string; price: number; stock: number }[]; }

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const data = await res.json(); if (!res.ok || !data.success) throw new Error(data.message || 'Error'); return data.data;
}

export async function getPOSDashboard(token: string) { return apiFetch<POSDashboard>("/pos/dashboard", token); }
export async function searchPOSProducts(token: string, query: string) { return apiFetch<POSProduct[]>(`/pos/search?q=${encodeURIComponent(query)}`, token); }
export async function createPOSSale(token: string, data: { items: { productId: string; variantSku?: string; quantity: number; unitPrice: number; size?: string; color?: string }[]; customerName?: string; customerPhone?: string; paymentMethod: string; amountPaid?: number; discountType?: string; discountValue?: number; notes?: string }) {
  return apiFetch<POSInvoice>("/pos/sale", token, { method: "POST", body: JSON.stringify(data) });
}
export async function getPOSInvoices(token: string, params: { page?: number; customerPhone?: string }) {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ invoices: POSInvoice[]; total: number; pages: number }>(`/pos/invoices?${qs}`, token);
}
export async function getPOSInvoiceById(token: string, id: string) { return apiFetch<POSInvoice>(`/pos/invoices/${id}`, token); }
