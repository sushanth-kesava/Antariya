import { getApiBaseUrl } from "@/lib/api/base-url";
const API_BASE = getApiBaseUrl();

export interface SupportTicket { _id: string; ticketNumber: string; source: string; customerName: string; customerEmail: string; category: string; subject: string; description: string; status: string; priority: string; assignedTo: { _id: string; displayName: string } | null; notes: { _id: string; message: string; isInternal: boolean; createdBy: { displayName: string }; createdAt: string }[]; resolvedAt: string | null; createdAt: string; }
export interface SupportDashboard { openTickets: number; inProgress: number; resolved: number; totalThisMonth: number; todayNew: number; resolutionRate: number; avgResponseHours: string | number; topCategories: { _id: string; count: number }[]; }

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const data = await res.json(); if (!res.ok || !data.success) throw new Error(data.message || `Error`); return data.data;
}

export async function getSupportDashboard(token: string) { return apiFetch<SupportDashboard>("/support/dashboard", token); }
export async function getSupportTickets(token: string, params: { status?: string; priority?: string; category?: string; search?: string; page?: number }) {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ tickets: SupportTicket[]; total: number; pages: number }>(`/support?${qs}`, token);
}
export async function createSupportTicket(token: string, data: { customerName: string; customerEmail?: string; customerPhone?: string; category: string; subject: string; description: string; priority?: string; source?: string; orderNumber?: string }) {
  return apiFetch<SupportTicket>("/support", token, { method: "POST", body: JSON.stringify(data) });
}
export async function updateTicketStatus(token: string, id: string, status: string) { return apiFetch<SupportTicket>(`/support/${id}/status`, token, { method: "PATCH", body: JSON.stringify({ status }) }); }
export async function addTicketNote(token: string, id: string, message: string, isInternal?: boolean) { return apiFetch<SupportTicket>(`/support/${id}/notes`, token, { method: "POST", body: JSON.stringify({ message, isInternal }) }); }
