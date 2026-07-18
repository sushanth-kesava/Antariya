"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Wallet,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getFinanceDashboard,
  getFinanceTransactions,
  getExpenses,
  type FinanceDashboard,
  type FinanceTransaction,
  type FinanceExpense,
} from "@/lib/api/finance";

type Tab = "overview" | "transactions" | "expenses";

export function FinanceModuleV2({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b pb-px">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} icon={BarChart3}>Overview</TabBtn>
        <TabBtn active={tab === "transactions"} onClick={() => setTab("transactions")} icon={CreditCard}>Transactions</TabBtn>
        <TabBtn active={tab === "expenses"} onClick={() => setTab("expenses")} icon={Receipt}>Expenses</TabBtn>
      </div>

      {tab === "overview" && <OverviewPanel token={token} />}
      {tab === "transactions" && <TransactionsPanel token={token} />}
      {tab === "expenses" && <ExpensesPanel token={token} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
      <Icon className="h-4 w-4" />{children}
    </button>
  );
}

// ─── OVERVIEW ────────────────────────────────────────────────────

function OverviewPanel({ token }: { token: string }) {
  const [stats, setStats] = useState<FinanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFinanceDashboard(token).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!stats) return <p className="text-center text-muted-foreground">Failed to load</p>;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinCard title="Revenue (30d)" value={fmt(stats.revenue)} icon={TrendingUp} variant="success" />
        <FinCard title="Expenses (30d)" value={fmt(stats.expenses)} icon={TrendingDown} variant="danger" />
        <FinCard title="Net Profit" value={fmt(stats.profit)} icon={DollarSign} variant={stats.profit >= 0 ? "success" : "danger"} />
        <FinCard title="Profit Margin" value={`${stats.profitMargin}%`} icon={BarChart3} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Receivables</p><p className="text-lg font-bold text-orange-600">{fmt(stats.receivables)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Payables</p><p className="text-lg font-bold text-red-600">{fmt(stats.payables)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">GST Payable</p><p className="text-lg font-bold">{fmt(stats.gstPayable)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Output GST</p><p className="text-lg font-bold text-green-600">{fmt(stats.outputGst)}</p><p className="text-xs text-muted-foreground mt-1">Input: {fmt(stats.inputGst)}</p></CardContent></Card>
      </div>

      {/* Monthly Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            {stats.monthlyRevenue.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
              <div className="space-y-2">
                {stats.monthlyRevenue.map(m => (
                  <div key={m._id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{m._id}</span>
                    <span className="font-medium text-green-600">{fmt(m.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Expenses by Category</CardTitle></CardHeader>
          <CardContent>
            {stats.expenseByCategory.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
              <div className="space-y-2">
                {stats.expenseByCategory.map(e => (
                  <div key={e._id} className="flex justify-between text-sm">
                    <span className="capitalize">{e._id?.replace(/_/g, ' ') || 'Other'}</span>
                    <span className="font-medium">{fmt(e.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Transactions</CardTitle></CardHeader>
        <CardContent>
          {stats.recentTransactions.length === 0 ? <p className="text-sm text-muted-foreground">No transactions yet</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Party</th>
                  <th className="text-right py-2">Amount</th>
                  <th className="text-left py-2">Status</th>
                </tr></thead>
                <tbody>
                  {stats.recentTransactions.map(t => (
                    <tr key={t._id} className="border-b last:border-0">
                      <td className="py-2 text-xs">{new Date(t.createdAt).toLocaleDateString("en-IN")}</td>
                      <td className="py-2"><Badge variant="outline" className="capitalize text-xs">{t.type.replace(/_/g, ' ')}</Badge></td>
                      <td className="py-2 truncate max-w-[120px]">{t.partyName || '—'}</td>
                      <td className="py-2 text-right font-mono font-medium">{fmt(t.netAmount)}</td>
                      <td className="py-2"><PaymentBadge status={t.paymentStatus} /></td>
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

// ─── TRANSACTIONS PANEL ──────────────────────────────────────────

function TransactionsPanel({ token }: { token: string }) {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getFinanceTransactions(token, { type: typeFilter || undefined, page: p });
      setTransactions(res.transactions);
      setTotal(res.total);
      setPage(p);
    } catch {}
    setLoading(false);
  }, [token, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="invoice">Invoice</option>
          <option value="payment_received">Payment Received</option>
          <option value="purchase_bill">Purchase Bill</option>
          <option value="vendor_payment">Vendor Payment</option>
          <option value="expense">Expense</option>
          <option value="refund">Refund</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => load(1)}><RefreshCw className="h-4 w-4" /></Button>
        <Badge variant="outline">{total} total</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : transactions.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">No transactions found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">#</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Party</th>
              <th className="text-right py-2">Amount</th>
              <th className="text-right py-2">Paid</th>
              <th className="text-right py-2">Balance</th>
              <th className="text-left py-2">Status</th>
            </tr></thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t._id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 text-xs">{new Date(t.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="py-2 font-mono text-xs">{t.transactionNumber}</td>
                  <td className="py-2 capitalize text-xs">{t.type.replace(/_/g, ' ')}</td>
                  <td className="py-2 truncate max-w-[120px]">{t.partyName || '—'}</td>
                  <td className="py-2 text-right font-mono">{fmt(t.netAmount)}</td>
                  <td className="py-2 text-right font-mono text-green-600">{fmt(t.paidAmount)}</td>
                  <td className="py-2 text-right font-mono text-red-600">{t.balanceAmount > 0 ? fmt(t.balanceAmount) : '—'}</td>
                  <td className="py-2"><PaymentBadge status={t.paymentStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── EXPENSES PANEL ──────────────────────────────────────────────

function ExpensesPanel({ token }: { token: string }) {
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [catFilter, setCatFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExpenses(token, { category: catFilter || undefined });
      setExpenses(res.expenses);
      setTotal(res.total);
    } catch {}
    setLoading(false);
  }, [token, catFilter]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          <option value="travel">Travel</option>
          <option value="salary">Salary</option>
          <option value="rent">Rent</option>
          <option value="marketing">Marketing</option>
          <option value="packaging">Packaging</option>
          <option value="utilities">Utilities</option>
          <option value="logistics">Logistics</option>
          <option value="raw_materials">Raw Materials</option>
          <option value="miscellaneous">Miscellaneous</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
        <Badge variant="outline">{total} total</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : expenses.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">No expenses recorded</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Category</th>
              <th className="text-left py-2">Description</th>
              <th className="text-left py-2">Paid To</th>
              <th className="text-right py-2">Amount</th>
              <th className="text-left py-2">Method</th>
            </tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e._id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 text-xs">{new Date(e.expenseDate).toLocaleDateString("en-IN")}</td>
                  <td className="py-2"><Badge variant="secondary" className="capitalize text-xs">{e.category.replace(/_/g, ' ')}</Badge></td>
                  <td className="py-2 truncate max-w-[200px]">{e.description}</td>
                  <td className="py-2 truncate max-w-[100px]">{e.paidTo || '—'}</td>
                  <td className="py-2 text-right font-mono font-medium">{fmt(e.netAmount)}</td>
                  <td className="py-2 capitalize text-xs">{e.paymentMethod?.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────

function FinCard({ title, value, icon: Icon, variant }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; variant?: "success" | "danger" }) {
  const colors = { success: "text-green-600", danger: "text-red-600", default: "text-foreground" };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("h-4 w-4", colors[variant || "default"])} />
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
        <p className={cn("text-xl font-bold", colors[variant || "default"])}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    partial: "bg-yellow-100 text-yellow-700",
    pending: "bg-gray-100 text-gray-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-gray-200 text-gray-500",
    refunded: "bg-blue-100 text-blue-700",
  };
  return <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", colors[status] || colors.pending)}>{status}</span>;
}
