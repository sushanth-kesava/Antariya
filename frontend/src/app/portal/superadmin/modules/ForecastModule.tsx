"use client";
import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Package, AlertTriangle, BarChart3, Brain, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getForecastDashboard, type ForecastDashboard } from "@/lib/api/forecast";

export function ForecastModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [data, setData] = useState<ForecastDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getForecastDashboard(token).then(setData).catch(() => {}).finally(() => setLoading(false)); }, [token]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <p className="text-center text-muted-foreground">Failed to load forecast data</p>;

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const growth = data.revenue.growth;

  return (
    <div className="space-y-6">
      {/* Revenue Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue (30d)</p><p className="text-2xl font-bold">{fmt(data.revenue.current)}</p><p className={cn("text-xs mt-1", growth >= 0 ? "text-green-600" : "text-red-600")}>{growth >= 0 ? "↑" : "↓"} {Math.abs(growth)}% vs prev</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Next Month Forecast</p><p className="text-2xl font-bold text-blue-600">{fmt(data.revenue.forecast)}</p><p className="text-xs text-muted-foreground mt-1">AI projected</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Orders (30d)</p><p className="text-2xl font-bold">{data.orders.current}</p><p className="text-xs text-muted-foreground mt-1">Prev: {data.orders.previous}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" />Stockout Risk</p><p className="text-2xl font-bold text-red-600">{data.stockoutRisk.length}</p><p className="text-xs text-muted-foreground mt-1">products at risk</p></CardContent></Card>
      </div>

      {/* Stockout Risk (most critical) */}
      {data.stockoutRisk.length > 0 && (
        <Card className="border-red-200">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Stockout Risk — Reorder Now</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Product</th><th className="text-right py-2">Current Stock</th><th className="text-right py-2">Daily Sales</th><th className="text-right py-2">Days Left</th><th className="text-right py-2">Reorder Qty</th></tr></thead>
              <tbody>{data.stockoutRisk.map(p => (
                <tr key={p.productId} className="border-b last:border-0">
                  <td className="py-2">{p.name} <span className="text-xs text-muted-foreground">({p.sku})</span></td>
                  <td className="py-2 text-right">{p.currentStock}</td>
                  <td className="py-2 text-right">{p.dailySales}/day</td>
                  <td className="py-2 text-right"><Badge variant={p.daysUntilStockout <= 7 ? "destructive" : "secondary"}>{p.daysUntilStockout}d</Badge></td>
                  <td className="py-2 text-right font-bold text-blue-600">{p.suggestedReorder}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Selling */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Best Sellers (90d)</CardTitle></CardHeader>
          <CardContent>
            {data.topSelling.length === 0 ? <p className="text-sm text-muted-foreground">No sales data</p> :
              <ul className="space-y-2">{data.topSelling.slice(0, 7).map(p => (
                <li key={p.productId} className="flex justify-between text-sm">
                  <span className="truncate max-w-[200px]">{p.name}</span>
                  <div className="flex gap-2"><Badge variant="secondary">{p.totalQty} sold</Badge><span className="text-green-600 font-mono text-xs">{fmt(p.totalRevenue)}</span></div>
                </li>
              ))}</ul>}
          </CardContent>
        </Card>

        {/* Dead Stock */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> Dead Stock (no sales 60d+)</CardTitle></CardHeader>
          <CardContent>
            {data.deadStock.length === 0 ? <p className="text-sm text-muted-foreground">No dead stock 🎉</p> :
              <ul className="space-y-2">{data.deadStock.map((p, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="truncate max-w-[200px]">{p.name}</span>
                  <Badge variant="outline">{p.stock} in stock</Badge>
                </li>
              ))}</ul>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Performance */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Category Performance (90d)</CardTitle></CardHeader>
          <CardContent>
            {data.categoryPerformance.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> :
              <ul className="space-y-2">{data.categoryPerformance.map(c => (
                <li key={c._id} className="flex justify-between text-sm">
                  <span className="capitalize">{c._id || 'Uncategorized'}</span>
                  <span className="font-mono text-xs">{fmt(c.totalRevenue)}</span>
                </li>
              ))}</ul>}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly Trend (6m)</CardTitle></CardHeader>
          <CardContent>
            {data.monthlyTrend.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> :
              <ul className="space-y-2">{data.monthlyTrend.map(m => (
                <li key={m._id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{m._id}</span>
                  <div className="flex gap-3"><span className="font-mono text-xs">{fmt(m.revenue)}</span><Badge variant="outline">{m.orders} orders</Badge></div>
                </li>
              ))}</ul>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
