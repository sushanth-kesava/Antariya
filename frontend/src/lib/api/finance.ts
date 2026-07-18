const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5004/api";

export interface FinanceTransaction {
  _id: string;
  transactionNumber: string;
  type: string;
  category: string;
  subCategory: string;
  partyName: string;
  amount: number;
  taxAmount: number;
  netAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  accountHead: string;
  description: string;
  referenceNumber: string;
  createdBy: { _id: string; displayName: string };
  createdAt: string;
}

export interface FinanceExpense {
  _id: string;
  expenseNumber: string;
  category: string;
  description: string;
  amount: number;
  netAmount: number;
  paymentMethod: string;
  paidTo: string;
  expenseDate: string;
  status: string;
  createdBy: { _id: string; displayName: string };
}

export interface FinanceDashboard {
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number | string;
  receivables: number;
  payables: number;
  gstPayable: number;
  outputGst: number;
  inputGst: number;
  monthlyRevenue: { _id: string; total: number }[];
  monthlyExpenses: { _id: string; total: number }[];
  expenseByCategory: { _id: string; total: number }[];
  recentTransactions: FinanceTransaction[];
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

export async function getFinanceDashboard(token: string, startDate?: string, endDate?: string) {
  const qs = new URLSearchParams();
  if (startDate) qs.set("startDate", startDate);
  if (endDate) qs.set("endDate", endDate);
  return apiFetch<FinanceDashboard>(`/finance/dashboard?${qs}`, token);
}

export async function getFinanceTransactions(token: string, params: { type?: string; paymentStatus?: string; page?: number }) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ transactions: FinanceTransaction[]; total: number; pages: number }>(`/finance/transactions?${qs}`, token);
}

export async function createFinanceTransaction(token: string, data: any) {
  return apiFetch<FinanceTransaction>("/finance/transactions", token, { method: "POST", body: JSON.stringify(data) });
}

export async function recordPayment(token: string, transactionId: string, amount: number, paymentMethod?: string) {
  return apiFetch<FinanceTransaction>("/finance/transactions/payment", token, {
    method: "POST", body: JSON.stringify({ transactionId, amount, paymentMethod })
  });
}

export async function createExpense(token: string, data: { category: string; description: string; amount: number; paymentMethod?: string; paidTo?: string; expenseDate: string }) {
  return apiFetch<FinanceExpense>("/finance/expenses", token, { method: "POST", body: JSON.stringify(data) });
}

export async function getExpenses(token: string, params: { category?: string; page?: number }) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ expenses: FinanceExpense[]; total: number; pages: number }>(`/finance/expenses?${qs}`, token);
}

export async function getProfitLoss(token: string, startDate?: string, endDate?: string) {
  const qs = new URLSearchParams();
  if (startDate) qs.set("startDate", startDate);
  if (endDate) qs.set("endDate", endDate);
  return apiFetch<{ income: any[]; expenses: any[]; totalIncome: number; totalExpenses: number; netProfit: number; profitMargin: string }>(`/finance/profit-loss?${qs}`, token);
}
