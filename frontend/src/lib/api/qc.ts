import { getApiBaseUrl } from "@/lib/api/base-url";
const API_BASE = getApiBaseUrl();

export interface QCInspection {
  _id: string;
  inspectionNumber: string;
  productId: { _id: string; name: string; sku?: string; images?: string[] };
  stage: string;
  status: "pending" | "passed" | "rejected" | "hold" | "rework" | "disposed";
  checklist: { _id: string; item: string; passed: boolean | null; notes: string; measuredValue: string }[];
  defects: { _id: string; defectType: string; severity: string; rootCause: string; assignedDepartment: string; correctiveAction: string }[];
  quantity: { inspected: number; passed: number; rejected: number; rework: number };
  supplier: { name: string };
  factory: { name: string; location: string };
  batchNumber: string;
  priority: string;
  inspectedBy: { _id: string; displayName: string; email: string };
  approvedBy?: { _id: string; displayName: string };
  notes: string;
  createdAt: string;
}

export interface QCDashboardStats {
  totalInspections: number;
  pendingCount: number;
  passedCount: number;
  rejectedCount: number;
  reworkCount: number;
  todayInspections: number;
  passRate: number;
  rejectRate: number;
  reworkRate: number;
  topDefects: { _id: string; count: number }[];
  supplierScores: { _id: string; supplier: string; total: number; passed: number; score: number }[];
}

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || `API error: ${res.status}`);
  return data.data;
}

export async function createQCInspection(token: string, data: { productId: string; stage: string; batchNumber?: string; supplier?: { name: string }; priority?: string }) {
  return apiFetch<QCInspection>("/qc", token, { method: "POST", body: JSON.stringify(data) });
}

export async function getQCInspections(token: string, params: { stage?: string; status?: string; priority?: string; page?: number }) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ inspections: QCInspection[]; total: number; pages: number }>(`/qc?${qs}`, token);
}

export async function getQCInspectionById(token: string, id: string) {
  return apiFetch<QCInspection>(`/qc/${id}`, token);
}

export async function updateQCChecklist(token: string, id: string, checklistItemId: string, passed: boolean, notes?: string) {
  return apiFetch<QCInspection>(`/qc/${id}/checklist`, token, { method: "PATCH", body: JSON.stringify({ checklistItemId, passed, notes }) });
}

export async function addQCDefect(token: string, id: string, data: { defectType: string; severity?: string; rootCause?: string; assignedDepartment?: string; correctiveAction?: string }) {
  return apiFetch<QCInspection>(`/qc/${id}/defects`, token, { method: "POST", body: JSON.stringify(data) });
}

export async function updateQCStatus(token: string, id: string, status: string, quantity?: { inspected: number; passed: number; rejected: number; rework: number }, notes?: string) {
  return apiFetch<QCInspection>(`/qc/${id}/status`, token, { method: "PATCH", body: JSON.stringify({ status, quantity, notes }) });
}

export async function getQCDashboard(token: string) {
  return apiFetch<QCDashboardStats>("/qc/dashboard", token);
}

export async function getStageChecklist(token: string, stage: string) {
  return apiFetch<string[]>(`/qc/checklist/${stage}`, token);
}
