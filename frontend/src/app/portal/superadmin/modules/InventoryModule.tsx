"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, RefreshCw, AlertTriangle, PlusCircle, MinusCircle, Warehouse as WarehouseIcon, ArrowLeftRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/india";
import {
  getInventoryReportFromBackend,
  adjustStockOnBackend,
  InventoryReport,
  InventoryEntry,
} from "@/lib/api/products";
import {
  listErpWarehouses,
  createErpWarehouse,
  transferErpStock,
  ErpWarehouse,
} from "@/lib/api/erp";

type Tab = "stock" | "warehouses";

export function InventoryModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("stock");
  const canManageWarehouse = has("inventory.warehouse.manage");
  const canTransfer = has("inventory.transfer");
  const showWarehouses = canManageWarehouse || canTransfer || has("inventory.view");

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b">
        <TabButton active={tab === "stock"} onClick={() => setTab("stock")} icon={Package}>
          Stock Levels
        </TabButton>
        {showWarehouses && (
          <TabButton active={tab === "warehouses"} onClick={() => setTab("warehouses")} icon={WarehouseIcon}>
            Warehouses &amp; Transfers
          </TabButton>
        )}
      </div>
      {tab === "stock" && <StockPanel token={token} has={has} />}
      {tab === "warehouses" && showWarehouses && (
        <WarehousesPanel token={token} canManage={canManageWarehouse} canTransfer={canTransfer} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function StockPanel({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});

  const canAdjust = has("inventory.adjust");

  const reload = () =>
    getInventoryReportFromBackend(token)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load inventory"));

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const adjust = async (entry: InventoryEntry, type: "add" | "remove") => {
    const key = `${entry.productId}:${entry.sku}`;
    const quantity = Number(qty[key] || 0);
    if (!quantity || quantity <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    try {
      setBusy(key);
      setError(null);
      await adjustStockOnBackend(token, entry.productId, {
        type,
        quantity,
        variantSku: entry.sku || undefined,
        reason: `ERP ${type} adjustment`,
      });
      setQty((q) => ({ ...q, [key]: "" }));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to adjust stock");
    } finally {
      setBusy(null);
    }
  };

  if (!report) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…
      </div>
    );
  }

  const s = report.summary;

  const renderRow = (entry: InventoryEntry) => {
    const key = `${entry.productId}:${entry.sku}`;
    return (
      <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">{entry.name}</p>
          <p className="text-xs text-muted-foreground">
            {entry.variantLabel || entry.sku || "—"} · reorder @ {entry.reorderPoint}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={entry.stock === 0 ? "destructive" : "secondary"}>{entry.stock} in stock</Badge>
          {canAdjust && (
            <>
              <Input
                type="number"
                min={1}
                value={qty[key] || ""}
                onChange={(e) => setQty((q) => ({ ...q, [key]: e.target.value }))}
                className="h-8 w-20"
                placeholder="qty"
              />
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={busy === key} onClick={() => adjust(entry, "add")}>
                {busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={busy === key} onClick={() => adjust(entry, "remove")}>
                <MinusCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Products" value={s.totalProducts.toLocaleString("en-IN")} />
        <Stat label="Variants" value={s.totalVariants.toLocaleString("en-IN")} />
        <Stat label="Units" value={s.totalUnits.toLocaleString("en-IN")} />
        <Stat label="Stock Value" value={formatINR(s.totalValue)} />
        <Stat label="Low Stock" value={String(s.lowStockCount)} warn={s.lowStockCount > 0} />
        <Stat label="Out of Stock" value={String(s.outOfStockCount)} warn={s.outOfStockCount > 0} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Low Stock ({report.lowStock.length})
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={reload} className="gap-1">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {report.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing low on stock. 🎉</p>
          ) : (
            report.lowStock.map(renderRow)
          )}
        </CardContent>
      </Card>

      {report.outOfStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-destructive" /> Out of Stock ({report.outOfStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{report.outOfStock.map(renderRow)}</CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}


/* ────────────────────────── Warehouses & Transfers Panel ────────────────────────── */

function WarehousesPanel({
  token,
  canManage,
  canTransfer,
}: {
  token: string;
  canManage: boolean;
  canTransfer: boolean;
}) {
  const [warehouses, setWarehouses] = useState<ErpWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [wh, setWh] = useState({ code: "", name: "", city: "", state: "", pincode: "" });

  // transfer form
  const [tx, setTx] = useState({ productId: "", variantSku: "", fromWarehouse: "", toWarehouse: "", quantity: "" });

  const reload = () => {
    setLoading(true);
    listErpWarehouses(token)
      .then(setWarehouses)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load warehouses"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const create = async () => {
    if (!wh.code.trim() || !wh.name.trim()) {
      setError("Warehouse code and name are required.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      await createErpWarehouse(token, wh);
      setMessage(`Warehouse "${wh.name}" created.`);
      setWh({ code: "", name: "", city: "", state: "", pincode: "" });
      setShowCreate(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create warehouse");
    } finally {
      setBusy(false);
    }
  };

  const transfer = async () => {
    if (!tx.productId.trim() || !tx.fromWarehouse || !tx.toWarehouse || !tx.quantity) {
      setError("Product ID, source, destination, and quantity are required for a transfer.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      await transferErpStock(token, {
        productId: tx.productId.trim(),
        variantSku: tx.variantSku.trim() || undefined,
        fromWarehouse: tx.fromWarehouse,
        toWarehouse: tx.toWarehouse,
        quantity: Number(tx.quantity),
        reason: "ERP manual transfer",
      });
      setMessage("Stock transferred successfully.");
      setTx({ productId: "", variantSku: "", fromWarehouse: "", toWarehouse: "", quantity: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to transfer stock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <WarehouseIcon className="h-4 w-4" /> Warehouses ({warehouses.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={reload} className="gap-1">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            {canManage && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowCreate((v) => !v)}>
                <Plus className="h-4 w-4" /> New
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showCreate && canManage && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Code (e.g. BLR1)" value={wh.code} onChange={(e) => setWh((w) => ({ ...w, code: e.target.value }))} />
                <Input placeholder="Name" value={wh.name} onChange={(e) => setWh((w) => ({ ...w, name: e.target.value }))} />
                <Input placeholder="City" value={wh.city} onChange={(e) => setWh((w) => ({ ...w, city: e.target.value }))} />
                <Input placeholder="State" value={wh.state} onChange={(e) => setWh((w) => ({ ...w, state: e.target.value }))} />
                <Input placeholder="Pincode" value={wh.pincode} onChange={(e) => setWh((w) => ({ ...w, pincode: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={create}>Create warehouse</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : warehouses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No warehouses yet.</p>
          ) : (
            warehouses.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {w.name} <code className="text-xs text-muted-foreground">{w.code}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[w.city, w.state, w.pincode].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <Badge variant={w.active ? "secondary" : "outline"}>{w.active ? "active" : "inactive"}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canTransfer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowLeftRight className="h-4 w-4" /> Transfer Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Product ID" value={tx.productId} onChange={(e) => setTx((t) => ({ ...t, productId: e.target.value }))} />
              <Input placeholder="Variant SKU (optional)" value={tx.variantSku} onChange={(e) => setTx((t) => ({ ...t, variantSku: e.target.value }))} />
              <select
                value={tx.fromWarehouse}
                onChange={(e) => setTx((t) => ({ ...t, fromWarehouse: e.target.value }))}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">From warehouse…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
              <select
                value={tx.toWarehouse}
                onChange={(e) => setTx((t) => ({ ...t, toWarehouse: e.target.value }))}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">To warehouse…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
              <Input placeholder="Quantity" type="number" min={1} value={tx.quantity} onChange={(e) => setTx((t) => ({ ...t, quantity: e.target.value }))} />
            </div>
            <Button size="sm" disabled={busy} onClick={transfer} className="gap-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
              Transfer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
