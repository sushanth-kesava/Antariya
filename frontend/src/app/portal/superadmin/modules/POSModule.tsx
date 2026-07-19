"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Store, BarChart3, Search, Plus, Minus, Trash2, ShoppingCart, Receipt, RefreshCw, ScanBarcode, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPOSDashboard, searchPOSProducts, createPOSSale, getPOSInvoices, type POSDashboard, type POSInvoice, type POSProduct } from "@/lib/api/pos";

import { getApiBaseUrl } from "@/lib/api/base-url";
const API_BASE = getApiBaseUrl();

type Tab = "billing" | "invoices" | "dashboard";

type CartItem = { productId: string; name: string; variantSku: string; size: string; color: string; quantity: number; unitPrice: number; stock: number };

export function POSModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("billing");
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b pb-px">
        <TabBtn active={tab === "billing"} onClick={() => setTab("billing")} icon={ShoppingCart}>New Sale</TabBtn>
        <TabBtn active={tab === "invoices"} onClick={() => setTab("invoices")} icon={Receipt}>Invoices</TabBtn>
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={BarChart3}>Dashboard</TabBtn>
      </div>
      {tab === "billing" && <BillingPanel token={token} />}
      {tab === "invoices" && <InvoicesPanel token={token} />}
      {tab === "dashboard" && <DashPanel token={token} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}><Icon className="h-4 w-4" />{children}</button>;
}

// ─── BILLING (main POS screen) ──────────────────────────────────

function BillingPanel({ token }: { token: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<POSProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState("none");
  const [processing, setProcessing] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<POSInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try { const r = await searchPOSProducts(token, searchQuery); setSearchResults(r); } catch {}
    setSearching(false);
  };

  const addToCart = (product: POSProduct, variant?: POSProduct["variants"][0]) => {
    const key = `${product._id}-${variant?.sku || ''}`;
    const existing = cart.findIndex(c => `${c.productId}-${c.variantSku}` === key);
    if (existing >= 0) {
      const updated = [...cart]; updated[existing].quantity += 1; setCart(updated);
    } else {
      setCart([...cart, { productId: product._id, name: product.name, variantSku: variant?.sku || '', size: variant?.size || '', color: variant?.color || '', quantity: 1, unitPrice: variant?.price || product.price, stock: variant?.stock || product.stock }]);
    }
  };

  const updateQty = (idx: number, delta: number) => {
    const updated = [...cart]; updated[idx].quantity = Math.max(1, updated[idx].quantity + delta); setCart(updated);
  };
  const removeItem = (idx: number) => { setCart(cart.filter((_, i) => i !== idx)); };

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const discount = discountType === 'flat' ? (parseFloat(discountValue) || 0) : discountType === 'percentage' ? (subtotal * (parseFloat(discountValue) || 0) / 100) : 0;
  const total = subtotal - discount;
  const paid = parseFloat(amountPaid) || total;
  const change = paid > total ? paid - total : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) { setError("Add items to cart"); return; }
    setProcessing(true); setError(null);
    try {
      const invoice = await createPOSSale(token, {
        items: cart.map(c => ({ productId: c.productId, variantSku: c.variantSku, quantity: c.quantity, unitPrice: c.unitPrice, size: c.size, color: c.color })),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        paymentMethod,
        amountPaid: paid,
        discountType: discountType !== 'none' ? discountType : undefined,
        discountValue: discountType !== 'none' ? parseFloat(discountValue) || 0 : undefined,
      });
      setLastInvoice(invoice);
      setCart([]); setCustomerName(""); setCustomerPhone(""); setAmountPaid(""); setDiscountValue(""); setDiscountType("none");
    } catch (e: any) { setError(e.message); }
    setProcessing(false);
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Product search + results */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1"><ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search product or scan barcode..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} className="pl-10" autoFocus /></div>
          <Button onClick={handleSearch} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
        </div>

        {searchResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {searchResults.map(p => (
              <Card key={p._id} className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{fmt(p.price)} • Stock: {p.stock}</p>
                    </div>
                  </div>
                  {p.variants?.length > 0 ? (
                    <div className="flex gap-1 mt-2 flex-wrap">{p.variants.filter(v => v.sku).map(v => (
                      <Button key={v.sku} size="sm" variant="outline" className="h-7 text-xs" onClick={() => addToCart(p, v)}>
                        {[v.size, v.color].filter(Boolean).join('/') || v.sku} — {fmt(v.price || p.price)}
                      </Button>
                    ))}</div>
                  ) : (
                    <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => addToCart(p)}><Plus className="h-3 w-3 mr-1" />Add</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Last invoice success */}
        {lastInvoice && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4 text-center">
              <p className="text-green-700 font-bold text-lg">✅ Sale Complete!</p>
              <p className="font-mono text-sm">{lastInvoice.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">{fmt(lastInvoice.totalAmount)} • {lastInvoice.paymentMethod.toUpperCase()}</p>
              {lastInvoice.changeGiven > 0 && <p className="text-sm font-medium">Change: {fmt(lastInvoice.changeGiven)}</p>}
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setLastInvoice(null)}>New Sale</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: Cart + Checkout */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Cart ({cart.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cart.length === 0 ? <p className="text-center text-muted-foreground text-sm py-4">Scan or search to add items</p> :
              cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm border-b pb-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-xs">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{[item.size, item.color].filter(Boolean).join(' / ')} {item.variantSku && `(${item.variantSku})`}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQty(idx, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQty(idx, 1)}><Plus className="h-3 w-3" /></Button>
                    <span className="text-xs font-mono w-14 text-right">{fmt(item.unitPrice * item.quantity)}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeItem(idx)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>

        {cart.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Customer */}
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="text-xs h-8" />
                <Input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="text-xs h-8" />
              </div>
              {/* Discount */}
              <div className="flex gap-2">
                <select className="border rounded px-2 py-1 text-xs bg-background" value={discountType} onChange={e => setDiscountType(e.target.value)}>
                  <option value="none">No Discount</option><option value="flat">Flat ₹</option><option value="percentage">% Off</option>
                </select>
                {discountType !== 'none' && <Input type="number" placeholder="Value" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="text-xs h-8 w-20" />}
              </div>
              {/* Payment */}
              <select className="w-full border rounded px-2 py-1 text-xs bg-background" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="mixed">Mixed</option>
              </select>
              {paymentMethod === 'cash' && <Input type="number" placeholder={`Amount paid (₹${total})`} value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="text-xs h-8" />}

              {/* Totals */}
              <div className="border-t pt-2 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(discount)}</span></div>}
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{fmt(total)}</span></div>
                {paymentMethod === 'cash' && change > 0 && <div className="flex justify-between text-blue-600"><span>Change</span><span>{fmt(change)}</span></div>}
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button className="w-full" size="lg" onClick={handleCheckout} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Receipt className="h-4 w-4 mr-2" />}
                Complete Sale — {fmt(total)}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── INVOICES ────────────────────────────────────────────────────

function InvoicesPanel({ token }: { token: string }) {
  const [invoices, setInvoices] = useState<POSInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getPOSInvoices(token, {}).then(r => setInvoices(r.invoices)).catch(() => {}).finally(() => setLoading(false)); }, [token]);
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const downloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    const res = await fetch(`${API_BASE}/pos/invoices/${invoiceId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${invoiceNumber}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return invoices.length === 0 ? <p className="text-center text-muted-foreground py-4">No invoices yet</p> : (
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Invoice #</th><th className="text-left py-2">Customer</th><th className="text-left py-2">Items</th><th className="text-right py-2">Total</th><th className="text-left py-2">Payment</th><th className="text-left py-2">Date</th><th className="text-right py-2">PDF</th></tr></thead>
      <tbody>{invoices.map(inv => (
        <tr key={inv._id} className="border-b last:border-0 hover:bg-muted/50">
          <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
          <td className="py-2">{inv.customerName}</td>
          <td className="py-2">{inv.items.length} items</td>
          <td className="py-2 text-right font-bold">{fmt(inv.totalAmount)}</td>
          <td className="py-2"><Badge variant="outline" className="capitalize text-xs">{inv.paymentMethod}</Badge></td>
          <td className="py-2 text-xs">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</td>
          <td className="py-2 text-right"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadPdf(inv._id, inv.invoiceNumber)} title="Download Invoice PDF"><Download className="h-4 w-4" /></Button></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────

function DashPanel({ token }: { token: string }) {
  const [stats, setStats] = useState<POSDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getPOSDashboard(token).then(setStats).catch(() => {}).finally(() => setLoading(false)); }, [token]);
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!stats) return <p className="text-center text-muted-foreground">Failed to load</p>;
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Today's Revenue</p><p className="text-2xl font-bold text-green-600">{fmt(stats.todayRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Today's Orders</p><p className="text-2xl font-bold">{stats.todayOrders}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Month Revenue</p><p className="text-2xl font-bold">{fmt(stats.monthRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Month Orders</p><p className="text-2xl font-bold">{stats.monthOrders}</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-sm">Top Products (This Month)</CardTitle></CardHeader><CardContent>
        {stats.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet</p> :
          <ul className="space-y-2">{stats.topProducts.map(p => <li key={p._id} className="flex justify-between text-sm"><span>{p._id}</span><div className="flex gap-2"><Badge variant="secondary">{p.totalQty} sold</Badge><span className="font-mono text-xs">{fmt(p.totalRevenue)}</span></div></li>)}</ul>}
      </CardContent></Card>
    </div>
  );
}
