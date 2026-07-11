"use client";

import { useEffect, useState } from "react";
import { Loader2, ShoppingCart, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/india";
import {
  getAdminDashboardFromBackend,
  updateAdminOrderStatusOnBackend,
  AdminDashboardPayload,
  Order,
} from "@/lib/api/orders";
import { refundOrderOnErp } from "@/lib/api/erp";

const STATUSES = ["Processing", "Shipped", "Delivered", "Cancelled"] as const;

const STATUS_STYLES: Record<string, string> = {
  Processing: "text-amber-600",
  Shipped: "text-blue-600",
  Delivered: "text-green-600",
  Cancelled: "text-destructive",
};

export function OrdersModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [data, setData] = useState<AdminDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canOverride = has("orders.status.override") || has("orders.cancel");
  const canRefund = has("orders.refund");

  const reload = () =>
    getAdminDashboardFromBackend(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load orders"));

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const changeStatus = async (order: Order, status: string) => {
    try {
      setBusyId(order.id);
      setError(null);
      await updateAdminOrderStatusOnBackend(token, order.id, status as Order["status"]);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  };

  const refund = async (order: Order) => {
    const input = window.prompt(
      `Refund order #${order.id.slice(-6).toUpperCase()} (total ${formatINR(order.total)}).\n` +
        `Enter an amount for a partial refund, or leave blank for a FULL refund:`,
      ""
    );
    if (input === null) return; // cancelled
    const amount = input.trim() ? Number(input.trim()) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      setError("Enter a valid refund amount.");
      return;
    }
    try {
      setBusyId(order.id);
      setError(null);
      await refundOrderOnErp(token, order.id, { amount, reason: "ERP refund" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refund order");
    } finally {
      setBusyId(null);
    }
  };

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
      </div>
    );
  }

  const { summary, recentOrders, statusBreakdown } = data;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total Orders" value={summary.totalOrders.toLocaleString("en-IN")} />
        <Stat label="Revenue" value={formatINR(summary.totalRevenue)} />
        <Stat label="Avg Order" value={formatINR(summary.averageOrderValue)} />
        <Stat label="Today" value={summary.todayOrders.toLocaleString("en-IN")} />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Badge key={s} variant="outline" className="gap-1">
            <span className={STATUS_STYLES[s]}>●</span>
            {s}: {statusBreakdown[s] ?? 0}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" /> Recent Orders
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={reload} className="gap-1">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      #{order.id.slice(-6).toUpperCase()} · {formatINR(order.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.userEmail || "—"} · {new Date(order.createdAt).toLocaleDateString("en-IN")} ·{" "}
                      {order.items.length} item(s) · {order.paymentMethod?.toUpperCase() || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={STATUS_STYLES[order.status] || ""}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
                {(canOverride || canRefund) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {canOverride &&
                      STATUSES.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={order.status === s ? "default" : "outline"}
                        disabled={busyId === order.id || order.status === s}
                        onClick={() => changeStatus(order, s)}
                        className="h-7 px-2 text-xs"
                      >
                        {busyId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : s}
                      </Button>
                      ))}
                    {canRefund && order.status !== "Refunded" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === order.id}
                        onClick={() => refund(order)}
                        className="h-7 gap-1 px-2 text-xs text-destructive"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Refund
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
