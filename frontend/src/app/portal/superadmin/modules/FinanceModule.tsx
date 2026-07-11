"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, Download, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/india";
import { getAdminDashboardFromBackend, AdminDashboardPayload } from "@/lib/api/orders";

export function FinanceModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [data, setData] = useState<AdminDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canExport = has("finance.reports.export");

  useEffect(() => {
    getAdminDashboardFromBackend(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load finance data"));
  }, [token]);

  const exportCsv = () => {
    if (!data) return;
    const s = data.summary;
    const rows = [
      ["Metric", "Value"],
      ["Total Revenue", s.totalRevenue],
      ["Total Orders", s.totalOrders],
      ["Average Order Value", s.averageOrderValue],
      ["Orders Today", s.todayOrders],
      ["Customers", s.customers],
      ["", ""],
      ["Status", "Count"],
      ...Object.entries(data.statusBreakdown),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `antariya-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Loading finance…
          </>
        )}
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wallet className="h-5 w-5" /> Financial Overview
          </h2>
          <p className="text-sm text-muted-foreground">Revenue and order economics at a glance.</p>
        </div>
        {canExport && (
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <BigStat label="Total Revenue" value={formatINR(s.totalRevenue)} accent />
        <BigStat label="Total Orders" value={s.totalOrders.toLocaleString("en-IN")} />
        <BigStat label="Avg Order Value" value={formatINR(s.averageOrderValue)} />
        <BigStat label="Orders Today" value={s.todayOrders.toLocaleString("en-IN")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Order Status Breakdown
          </CardTitle>
          <CardDescription>Distribution of all orders by fulfillment status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(data.statusBreakdown).map(([status, count]) => {
            const total = Object.values(data.statusBreakdown).reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{status}</span>
                  <span className="text-muted-foreground">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
