"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  QrCode,
  ScanBarcode,
  Warehouse,
  ArrowLeftRight,
  ClipboardList,
  BarChart3,
  Printer,
  Download,
  Search,
  RefreshCw,
  Plus,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  searchBarcodes,
  getBarcodeDashboard,
  getMovementHistory,
  getAuditSessions,
  processScan,
  generateBarcode,
  bulkGenerateBarcodes,
  getWarehouseBins,
  downloadProductLabel,
  type BarcodeItem,
  type BarcodeDashboardStats,
  type StockMovement,
  type AuditSession,
  type WarehouseBin,
} from "@/lib/api/barcode";
import { listErpWarehouses, ErpWarehouse } from "@/lib/api/erp";

type Tab = "dashboard" | "barcodes" | "scanner" | "bins" | "movements" | "audit";

export function BarcodeModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto border-b pb-px">
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={BarChart3}>Dashboard</TabBtn>
        <TabBtn active={tab === "barcodes"} onClick={() => setTab("barcodes")} icon={QrCode}>Barcodes</TabBtn>
        <TabBtn active={tab === "scanner"} onClick={() => setTab("scanner")} icon={ScanBarcode}>Scanner</TabBtn>
        <TabBtn active={tab === "bins"} onClick={() => setTab("bins")} icon={Warehouse}>Bins</TabBtn>
        <TabBtn active={tab === "movements"} onClick={() => setTab("movements")} icon={ArrowLeftRight}>Movements</TabBtn>
        <TabBtn active={tab === "audit"} onClick={() => setTab("audit")} icon={ClipboardList}>Audit</TabBtn>
      </div>

      {tab === "dashboard" && <DashboardPanel token={token} />}
      {tab === "barcodes" && <BarcodesPanel token={token} />}
      {tab === "scanner" && <ScannerPanel token={token} />}
      {tab === "bins" && <BinsPanel token={token} />}
      {tab === "movements" && <MovementsPanel token={token} />}
      {tab === "audit" && <AuditPanel token={token} />}
    </div>
  );
}

// ─── TAB BUTTON ──────────────────────────────────────────────────

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

// ─── DASHBOARD PANEL ─────────────────────────────────────────────

function DashboardPanel({ token }: { token: string }) {
  const [stats, setStats] = useState<BarcodeDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getBarcodeDashboard(token)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <div className="text-destructive text-center py-4">{error}</div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Products" value={stats.totalProducts} icon={Package} />
        <StatCard title="Scanned Today" value={stats.scannedToday} icon={ScanBarcode} />
        <StatCard title="Transfers Today" value={stats.transfersToday} icon={ArrowLeftRight} />
        <StatCard title="Low Stock" value={stats.lowStockItems} icon={AlertTriangle} variant="warning" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Barcodes</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.totalBarcodes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Accuracy</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.inventoryAccuracy}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Aging (30d+)</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.stockAging}</p></CardContent>
        </Card>
      </div>

      {/* Fast / Slow Moving */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Fast Moving (30d)</CardTitle></CardHeader>
          <CardContent>
            {stats.fastMoving.length === 0 ? <p className="text-muted-foreground text-sm">No data</p> : (
              <ul className="space-y-1 text-sm">
                {stats.fastMoving.map((p) => (
                  <li key={p._id} className="flex justify-between">
                    <span className="truncate">{p._id}</span>
                    <Badge variant="secondary">{p.totalSold} sold</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> Slow Moving (30d)</CardTitle></CardHeader>
          <CardContent>
            {stats.slowMoving.length === 0 ? <p className="text-muted-foreground text-sm">No data</p> : (
              <ul className="space-y-1 text-sm">
                {stats.slowMoving.map((p) => (
                  <li key={p._id} className="flex justify-between">
                    <span className="truncate">{p._id}</span>
                    <Badge variant="outline">{p.totalSold} sold</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Movements */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Movements</CardTitle></CardHeader>
        <CardContent>
          {stats.recentMovements.length === 0 ? <p className="text-muted-foreground text-sm">No recent movements</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-left py-2">By</th>
                </tr></thead>
                <tbody>
                  {stats.recentMovements.map((m) => (
                    <tr key={m._id} className="border-b last:border-0">
                      <td className="py-2 truncate max-w-[150px]">{m.productId?.name || m.sku}</td>
                      <td className="py-2"><MovementBadge type={m.movementType} /></td>
                      <td className="py-2 text-right font-mono">{m.quantity}</td>
                      <td className="py-2 truncate max-w-[100px]">{m.performedBy?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── BARCODES PANEL ──────────────────────────────────────────────

function BarcodesPanel({ token }: { token: string }) {
  const [barcodes, setBarcodes] = useState<BarcodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await searchBarcodes(token, { query, page: p, limit: 20 });
      setBarcodes(res.barcodes);
      setTotal(res.total);
      setPage(p);
    } catch {}
    setLoading(false);
  }, [token, query]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by SKU or barcode..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => load(1)}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : barcodes.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">No barcodes found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left py-2">SKU</th>
              <th className="text-left py-2">Product</th>
              <th className="text-left py-2">Barcode</th>
              <th className="text-left py-2">Warehouse</th>
              <th className="text-right py-2">Prints</th>
              <th className="text-right py-2">Label</th>
            </tr></thead>
            <tbody>
              {barcodes.map((b) => (
                <tr key={b._id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 font-mono text-xs">{b.sku}</td>
                  <td className="py-2 truncate max-w-[150px]">{b.productId?.name || "—"}</td>
                  <td className="py-2">
                    {b.barcodeImage ? (
                      <img src={b.barcodeImage} alt={b.barcodeData} className="h-10 max-w-[140px] object-contain" />
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{b.barcodeData}</span>
                    )}
                  </td>
                  <td className="py-2">{b.warehouseId?.name || "—"}</td>
                  <td className="py-2 text-right">{b.printCount}</td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => downloadProductLabel(token, b.productId?._id || "", b.sku)}
                      title="Download Label PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>Prev</Button>
              <span className="text-sm text-muted-foreground py-1">Page {page}</span>
              <Button size="sm" variant="outline" onClick={() => load(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SCANNER PANEL ───────────────────────────────────────────────

function ScannerPanel({ token }: { token: string }) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [action, setAction] = useState<"view" | "stock_in" | "stock_out" | "dispatch" | "receive">("view");
  const [quantity, setQuantity] = useState("1");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!barcodeInput.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await processScan(token, barcodeInput.trim(), action, parseInt(quantity) || 1);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ScanBarcode className="h-4 w-4" /> Barcode Scanner</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Input
                placeholder="Scan or enter barcode data..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                autoFocus
                className="font-mono"
              />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={action}
              onChange={(e) => setAction(e.target.value as any)}
            >
              <option value="view">View Product</option>
              <option value="stock_in">Stock In (+)</option>
              <option value="stock_out">Stock Out (−)</option>
              <option value="dispatch">Dispatch</option>
              <option value="receive">Receive</option>
            </select>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-20"
              />
              <Button onClick={handleScan} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
              </Button>
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {result && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium capitalize">{result.action} — Success</span>
              </div>
              {result.product && (
                <div className="text-sm space-y-1">
                  <p><strong>Product:</strong> {result.product.name}</p>
                  <p><strong>SKU:</strong> {result.product.sku}</p>
                  <p><strong>Price:</strong> ₹{result.product.price}</p>
                </div>
              )}
              {result.movement && (
                <div className="text-sm space-y-1 mt-2">
                  <p><strong>Movement:</strong> {result.movement.movementType}</p>
                  <p><strong>Old Qty:</strong> {result.movement.oldQuantity} → <strong>New Qty:</strong> {result.movement.newQuantity}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground">
        Supports USB scanners, Bluetooth scanners, and manual entry. Focus the input field and scan.
      </div>
    </div>
  );
}

// ─── BINS PANEL ──────────────────────────────────────────────────

function BinsPanel({ token }: { token: string }) {
  const [warehouses, setWarehouses] = useState<ErpWarehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    listErpWarehouses(token).then((wh) => {
      setWarehouses(wh);
      if (wh.length > 0) setSelectedWarehouse(wh[0].id || wh[0]._id || "");
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!selectedWarehouse) return;
    setLoading(true);
    getWarehouseBins(token, selectedWarehouse)
      .then((res) => { setBins(res.bins); setTotal(res.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, selectedWarehouse]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <label className="text-sm font-medium">Warehouse:</label>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
        >
          {warehouses.map((w, idx) => <option key={w._id || w.id || idx} value={w._id || w.id || ""}>{w.name}</option>)}
        </select>
        <Badge variant="outline">{total} bins</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : bins.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">No bins configured for this warehouse</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bins.map((b) => (
            <Card key={b._id} className="relative">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-mono text-sm font-bold">{b.binCode}</p>
                    <p className="text-xs text-muted-foreground">{b.rack} → {b.shelf} → {b.bin}</p>
                  </div>
                  <Badge variant={b.status === "available" ? "secondary" : b.status === "full" ? "destructive" : "outline"}>
                    {b.status}
                  </Badge>
                </div>
                <div className="text-xs space-y-1">
                  <p>Zone: <span className="capitalize">{b.zone}</span></p>
                  <p>Items: {b.capacity.currentItems} / {b.capacity.maxItems}</p>
                  <p>Products: {b.assignedProducts.length}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MOVEMENTS PANEL ─────────────────────────────────────────────

function MovementsPanel({ token }: { token: string }) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getMovementHistory(token, { movementType: typeFilter || undefined, page: p, limit: 20 });
      setMovements(res.movements);
      setTotal(res.total || 0);
      setPage(p);
    } catch {}
    setLoading(false);
  }, [token, typeFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="received">Received</option>
          <option value="sold">Sold</option>
          <option value="transferred">Transferred</option>
          <option value="returned">Returned</option>
          <option value="damaged">Damaged</option>
          <option value="adjusted">Adjusted</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => load(1)}><RefreshCw className="h-4 w-4" /></Button>
        <Badge variant="outline">{total} total</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : movements.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">No movements found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Product</th>
              <th className="text-left py-2">Type</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-left py-2">Old → New</th>
              <th className="text-left py-2">Reason</th>
              <th className="text-left py-2">By</th>
            </tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m._id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 text-xs">{new Date(m.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="py-2 truncate max-w-[120px]">{m.productId?.name || m.sku}</td>
                  <td className="py-2"><MovementBadge type={m.movementType} /></td>
                  <td className="py-2 text-right font-mono">{m.quantity}</td>
                  <td className="py-2 font-mono text-xs">{m.oldQuantity} → {m.newQuantity}</td>
                  <td className="py-2 truncate max-w-[150px] text-xs">{m.reason}</td>
                  <td className="py-2 text-xs truncate max-w-[80px]">{m.performedBy?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── AUDIT PANEL ─────────────────────────────────────────────────

function AuditPanel({ token }: { token: string }) {
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditSessions(token)
      .then((res) => setSessions(res.sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Physical Inventory Count Sessions</h3>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Audit</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : sessions.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">No audit sessions yet</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s._id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.countNumber} • {s.warehouseId?.name} • {new Date(s.scheduledDate).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <Badge variant={
                    s.status === "approved" ? "default" :
                    s.status === "completed" ? "secondary" :
                    s.status === "in_progress" ? "outline" : "secondary"
                  }>{s.status}</Badge>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3 text-xs">
                  <div><span className="text-muted-foreground">Total:</span> {s.summary.totalItems}</div>
                  <div><span className="text-muted-foreground">Counted:</span> {s.summary.countedItems}</div>
                  <div className="text-green-600"><CheckCircle2 className="inline h-3 w-3" /> {s.summary.matchedItems}</div>
                  <div className="text-red-600"><XCircle className="inline h-3 w-3" /> {s.summary.missingItems}</div>
                  <div><span className="text-muted-foreground">Accuracy:</span> {s.summary.accuracyPercentage}%</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, variant }: { title: string; value: number; icon: React.ComponentType<{ className?: string }>; variant?: "warning" }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", variant === "warning" ? "bg-orange-100 dark:bg-orange-900/30" : "bg-primary/10")}>
          <Icon className={cn("h-5 w-5", variant === "warning" ? "text-orange-600" : "text-primary")} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value.toLocaleString("en-IN")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MovementBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    received: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    sold: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    transferred: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    returned: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    damaged: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    adjusted: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    manual: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", colors[type] || colors.manual)}>
      {type}
    </span>
  );
}
