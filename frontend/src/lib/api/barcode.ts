import { getApiBaseUrl } from "@/lib/api/base-url";
const API_BASE = getApiBaseUrl();

// ─── TYPES ───────────────────────────────────────────────────────

export interface BarcodeItem {
  _id: string;
  productId: { _id: string; name: string; sku: string; price: number; images?: string[] };
  sku: string;
  variantId: string | null;
  warehouseId: { _id: string; name: string; location?: string };
  barcodeType: "CODE128" | "QR";
  barcodeData: string;
  barcodeImage: string | null;
  qrData?: {
    productName: string;
    currentStock: number;
    warehouse: string;
    batch: string;
    manufacturingDate: string | null;
    supplier: string;
  };
  labelSize: string;
  printCount: number;
  lastPrintedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WarehouseBin {
  _id: string;
  warehouseId: string;
  rack: string;
  shelf: string;
  bin: string;
  binCode: string;
  capacity: { maxItems: number; currentItems: number; maxWeight: number; currentWeight: number };
  assignedProducts: { productId: { _id: string; name: string; sku: string }; sku: string; quantity: number }[];
  status: "available" | "full" | "reserved" | "maintenance" | "inactive";
  zone: string;
  fullLocation: string;
}

export interface StockMovement {
  _id: string;
  productId: { _id: string; name: string; sku: string; images?: string[] };
  sku: string;
  movementType: "received" | "sold" | "transferred" | "returned" | "damaged" | "adjusted" | "manual";
  fromWarehouse?: { _id: string; name: string };
  toWarehouse?: { _id: string; name: string };
  quantity: number;
  oldQuantity: number;
  newQuantity: number;
  reason: string;
  referenceNumber?: string;
  performedBy: { _id: string; name: string; email: string };
  scannedBarcode?: string;
  createdAt: string;
}

export interface AuditSession {
  _id: string;
  countNumber: string;
  title: string;
  warehouseId: { _id: string; name: string };
  countType: string;
  status: string;
  scheduledDate: string;
  summary: {
    totalItems: number;
    countedItems: number;
    matchedItems: number;
    missingItems: number;
    extraItems: number;
    accuracyPercentage: number;
  };
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
}

export interface BarcodeDashboardStats {
  totalProducts: number;
  totalBarcodes: number;
  scannedToday: number;
  transfersToday: number;
  lowStockItems: number;
  inventoryAccuracy: number | string;
  stockAging: number;
  fastMoving: { _id: string; totalSold: number }[];
  slowMoving: { _id: string; totalSold: number }[];
  recentMovements: StockMovement[];
}

// ─── API FUNCTIONS ───────────────────────────────────────────────

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || `API error: ${res.status}`);
  }
  return data.data;
}

// ─── BARCODE ─────────────────────────────────────────────────────

export async function generateBarcode(token: string, productId: string, warehouseId: string, variantId?: string) {
  return apiFetch<{ barcode: BarcodeItem; qrBarcode: BarcodeItem }>("/barcode/generate", token, {
    method: "POST",
    body: JSON.stringify({ productId, warehouseId, variantId }),
  });
}

export async function bulkGenerateBarcodes(token: string, warehouseId: string, productIds?: string[]) {
  return apiFetch<{ generated: number; errors: number }>("/barcode/generate/bulk", token, {
    method: "POST",
    body: JSON.stringify({ warehouseId, productIds }),
  });
}

export async function searchBarcodes(token: string, params: { query?: string; warehouseId?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params.query) qs.set("query", params.query);
  if (params.warehouseId) qs.set("warehouseId", params.warehouseId);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return apiFetch<{ barcodes: BarcodeItem[]; total: number; page: number; pages: number }>(`/barcode/search?${qs}`, token);
}

export async function getProductBarcodes(token: string, productId: string) {
  return apiFetch<BarcodeItem[]>(`/barcode/product/${productId}`, token);
}

export async function recordPrint(token: string, barcodeId: string, labelSize?: string) {
  return apiFetch<BarcodeItem>("/barcode/print", token, {
    method: "POST",
    body: JSON.stringify({ barcodeId, labelSize }),
  });
}

// ─── SCANNER ─────────────────────────────────────────────────────

export async function processScan(
  token: string,
  barcodeData: string,
  action: "view" | "stock_in" | "stock_out" | "transfer" | "dispatch" | "receive",
  quantity?: number,
  warehouseId?: string
) {
  return apiFetch<{ action: string; product?: any; movement?: any; barcode?: any }>("/barcode/scan", token, {
    method: "POST",
    body: JSON.stringify({ barcodeData, action, quantity, warehouseId }),
  });
}

export async function lookupBarcode(token: string, barcodeData: string) {
  return apiFetch<BarcodeItem>(`/barcode/lookup/${encodeURIComponent(barcodeData)}`, token);
}

// ─── WAREHOUSE BINS ──────────────────────────────────────────────

export async function createBin(token: string, data: { warehouseId: string; rack: string; shelf: string; bin: string; zone?: string }) {
  return apiFetch<WarehouseBin>("/barcode/bins", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function bulkCreateBins(token: string, data: { warehouseId: string; rack: string; shelves: string[]; binsPerShelf: number; zone?: string }) {
  return apiFetch<{ created: number; bins: WarehouseBin[] }>("/barcode/bins/bulk", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function assignProductToBin(token: string, binId: string, productId: string, sku: string, quantity: number) {
  return apiFetch<WarehouseBin>("/barcode/bins/assign", token, {
    method: "POST",
    body: JSON.stringify({ binId, productId, sku, quantity }),
  });
}

export async function getWarehouseBins(token: string, warehouseId: string, params?: { rack?: string; zone?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params?.rack) qs.set("rack", params.rack);
  if (params?.zone) qs.set("zone", params.zone);
  if (params?.page) qs.set("page", String(params.page));
  return apiFetch<{ bins: WarehouseBin[]; total: number; pages: number }>(`/barcode/bins/warehouse/${warehouseId}?${qs}`, token);
}

export async function getProductLocation(token: string, productId: string) {
  return apiFetch<{ binCode: string; warehouse: string; rack: string; shelf: string; bin: string; zone: string; quantity: number }[]>(
    `/barcode/bins/product/${productId}`, token
  );
}

// ─── STOCK MOVEMENTS ─────────────────────────────────────────────

export async function recordMovement(token: string, data: {
  productId: string;
  movementType: string;
  quantity: number;
  reason: string;
  fromWarehouse?: string;
  toWarehouse?: string;
  referenceNumber?: string;
  batch?: string;
}) {
  return apiFetch<StockMovement>("/barcode/movements", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMovementHistory(token: string, params: {
  productId?: string;
  warehouseId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ movements: StockMovement[]; total: number; pages: number }>(`/barcode/movements?${qs}`, token);
}

// ─── AUDIT / PHYSICAL COUNT ──────────────────────────────────────

export async function createAuditSession(token: string, data: {
  title: string;
  warehouseId: string;
  scheduledDate: string;
  countType?: string;
  description?: string;
}) {
  return apiFetch<AuditSession>("/barcode/audit", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAuditSessions(token: string, params?: { warehouseId?: string; status?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  return apiFetch<{ sessions: AuditSession[]; total: number; pages: number }>(`/barcode/audit?${qs}`, token);
}

export async function recordAuditCount(token: string, sessionId: string, itemId: string, countedQuantity: number, scannedBarcode?: string) {
  return apiFetch<AuditSession>(`/barcode/audit/${sessionId}/count`, token, {
    method: "POST",
    body: JSON.stringify({ itemId, countedQuantity, scannedBarcode }),
  });
}

export async function completeAuditSession(token: string, sessionId: string) {
  return apiFetch<AuditSession>(`/barcode/audit/${sessionId}/complete`, token, { method: "PATCH" });
}

export async function approveAuditAdjustments(token: string, sessionId: string, notes?: string) {
  return apiFetch<AuditSession>(`/barcode/audit/${sessionId}/approve`, token, {
    method: "PATCH",
    body: JSON.stringify({ notes }),
  });
}

// ─── DASHBOARD ───────────────────────────────────────────────────

export async function getBarcodeDashboard(token: string, warehouseId?: string) {
  const qs = warehouseId ? `?warehouseId=${warehouseId}` : "";
  return apiFetch<BarcodeDashboardStats>(`/barcode/dashboard${qs}`, token);
}

// ─── LABEL DOWNLOAD ──────────────────────────────────────────────

export async function downloadProductLabel(token: string, productId: string, variantSku?: string, labelSize?: string) {
  const qs = new URLSearchParams();
  if (variantSku) qs.set("variantSku", variantSku);
  if (labelSize) qs.set("labelSize", labelSize);

  const res = await fetch(`${API_BASE}/barcode/label/${productId}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Failed to download label");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `label-${variantSku || productId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadBulkLabels(token: string, productIds: string[], labelSize?: string) {
  const res = await fetch(`${API_BASE}/barcode/labels/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productIds, labelSize }),
  });

  if (!res.ok) throw new Error("Failed to download labels");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product-labels.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
