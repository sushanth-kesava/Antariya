"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Ticket,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Calendar,
  Percent,
  IndianRupee,
  Truck,
  AlertCircle,
} from "lucide-react";
import {
  listAllCoupons,
  createCouponOnBackend,
  updateCouponOnBackend,
  deleteCouponOnBackend,
  Coupon,
  CouponDiscountType,
  CreateCouponPayload,
} from "@/lib/api/coupons";
import { useToast } from "@/hooks/use-toast";

type CouponsModuleProps = {
  token: string;
  has: (permission: string) => boolean;
};

const DISCOUNT_TYPES: { value: CouponDiscountType; label: string; icon: React.ReactNode }[] = [
  { value: "percentage", label: "Percentage", icon: <Percent className="h-4 w-4" /> },
  { value: "flat", label: "Flat Amount (₹)", icon: <IndianRupee className="h-4 w-4" /> },
  { value: "free_shipping", label: "Free Shipping", icon: <Truck className="h-4 w-4" /> },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function CouponsModule({ token, has }: CouponsModuleProps) {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<CreateCouponPayload>({
    code: "",
    title: "",
    description: "",
    discountType: "percentage",
    discountValue: 10,
    maxDiscount: undefined,
    minOrderValue: 0,
    validFrom: new Date().toISOString().slice(0, 16),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    maxUses: undefined,
    maxUsesPerUser: 1,
    showOnHero: false,
    heroBannerText: "",
    heroBannerColor: "#1a1a1a",
    freeDelivery: false,
    freeDelivery: false,
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  async function loadCoupons() {
    setLoading(true);
    try {
      const data = await listAllCoupons(token);
      setCoupons(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load coupons", variant: "destructive" });
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.code.trim() || !form.title.trim()) {
      toast({ title: "Missing fields", description: "Code and title are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: CreateCouponPayload = {
        ...form,
        code: form.code.toUpperCase().replace(/\s+/g, ""),
        // For flat type, convert ₹ to paise. Percentage stays as-is.
        discountValue: form.discountType === "flat" ? form.discountValue * 100 : form.discountValue,
        minOrderValue: (form.minOrderValue || 0) * 100, // Convert ₹ to paise
        maxDiscount: form.maxDiscount ? form.maxDiscount * 100 : undefined,
      };

      const result = await createCouponOnBackend(token, payload);
      if (result.success) {
        toast({ title: "Success", description: `Coupon "${payload.code}" created` });
        setShowForm(false);
        resetForm();
        loadCoupons();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create coupon", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleToggleActive(coupon: Coupon) {
    try {
      const result = await updateCouponOnBackend(token, coupon._id, { active: !coupon.active });
      if (result.success) {
        setCoupons((prev) => prev.map((c) => (c._id === coupon._id ? { ...c, active: !c.active } : c)));
        toast({ title: coupon.active ? "Deactivated" : "Activated", description: `Coupon ${coupon.code}` });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update coupon", variant: "destructive" });
    }
  }

  async function handleToggleHero(coupon: Coupon) {
    try {
      const result = await updateCouponOnBackend(token, coupon._id, { showOnHero: !coupon.showOnHero });
      if (result.success) {
        setCoupons((prev) => prev.map((c) => (c._id === coupon._id ? { ...c, showOnHero: !c.showOnHero } : c)));
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    try {
      const result = await deleteCouponOnBackend(token, coupon._id);
      if (result.success) {
        setCoupons((prev) => prev.filter((c) => c._id !== coupon._id));
        toast({ title: "Deleted", description: `Coupon ${coupon.code} removed` });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete coupon", variant: "destructive" });
    }
  }

  function resetForm() {
    setForm({
      code: "",
      title: "",
      description: "",
      discountType: "percentage",
      discountValue: 10,
      maxDiscount: undefined,
      minOrderValue: 0,
      validFrom: new Date().toISOString().slice(0, 16),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      maxUses: undefined,
      maxUsesPerUser: 1,
      showOnHero: false,
      heroBannerText: "",
      heroBannerColor: "#1a1a1a",
    });
  }

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "ANT";
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm((prev) => ({ ...prev, code }));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: `${code} copied to clipboard` });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6" /> Coupons & Offers
          </h2>
          <p className="text-muted-foreground mt-1">
            Create discount codes, manage offers, and display them on the homepage
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Coupon
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Create New Coupon</CardTitle>
            <CardDescription>Fill in the details to create a new discount code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Code & Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Coupon Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WELCOME15"
                    className="uppercase font-mono"
                  />
                  <Button variant="outline" size="sm" onClick={generateCode} type="button">
                    Generate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Welcome Discount"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. 15% off on your first order"
              />
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value as CouponDiscountType })}
                >
                  {DISCOUNT_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>
                  {form.discountType === "percentage" && "Discount Percentage (%)"}
                  {form.discountType === "flat" && "Flat Discount Amount (₹)"}
                  {form.discountType === "free_shipping" && "Value (not applicable)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={form.discountType === "percentage" ? 100 : 100000}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  disabled={form.discountType === "free_shipping"}
                />
              </div>
              {form.discountType === "percentage" && (
                <div className="space-y-2">
                  <Label>Max Discount Cap (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.maxDiscount || ""}
                    onChange={(e) => setForm({ ...form, maxDiscount: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="No cap"
                  />
                </div>
              )}
            </div>

            {/* Min Order & Usage */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Min Order Value (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.minOrderValue || ""}
                  onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })}
                  placeholder="0 = no minimum"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Quantity (items)</Label>
                <Input
                  type="number"
                  min={0}
                  value={(form as any).minQuantity || ""}
                  onChange={(e) => setForm({ ...form, minQuantity: Number(e.target.value) } as any)}
                  placeholder="0 = any quantity"
                />
              </div>
              <div className="space-y-2">
                <Label>Total Uses Limit</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.maxUses || ""}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label>Uses Per User</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.maxUsesPerUser}
                  onChange={(e) => setForm({ ...form, maxUsesPerUser: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Validity Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>
            </div>

            {/* Hero Banner Settings */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show on Homepage Hero Banner</p>
                  <p className="text-sm text-muted-foreground">Display this offer prominently on the homepage</p>
                </div>
                <Switch
                  checked={form.showOnHero}
                  onCheckedChange={(checked) => setForm({ ...form, showOnHero: checked })}
                />
              </div>
              {form.showOnHero && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Banner Text</Label>
                    <Input
                      value={form.heroBannerText || ""}
                      onChange={(e) => setForm({ ...form, heroBannerText: e.target.value })}
                      placeholder="e.g. 🎉 Use code WELCOME15 for 15% off!"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Banner Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={form.heroBannerColor || "#1a1a1a"}
                        onChange={(e) => setForm({ ...form, heroBannerColor: e.target.value })}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        value={form.heroBannerColor || "#1a1a1a"}
                        onChange={(e) => setForm({ ...form, heroBannerColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Free Delivery Toggle */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2"><Truck className="h-4 w-4" /> Free Delivery</p>
                  <p className="text-sm text-muted-foreground">Waive delivery charges when this coupon is applied</p>
                </div>
                <Switch
                  checked={form.freeDelivery || false}
                  onCheckedChange={(checked) => setForm({ ...form, freeDelivery: checked })}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Creating..." : "Create Coupon"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupons List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading coupons...</div>
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ticket className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No coupons yet. Create your first offer!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {coupons.map((coupon) => {
            const now = new Date();
            const isExpired = new Date(coupon.validUntil) < now;
            const isNotStarted = new Date(coupon.validFrom) > now;
            const usagePercent = coupon.maxUses ? Math.round((coupon.currentUses / coupon.maxUses) * 100) : null;

            return (
              <Card key={coupon._id} className={cn(!coupon.active && "opacity-60")}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Code & Info */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg font-bold tracking-wider">{coupon.code}</span>
                        <button onClick={() => copyCode(coupon.code)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-4 w-4" />
                        </button>
                        {coupon.active && !isExpired && !isNotStarted && (
                          <Badge variant="default" className="bg-green-600">Active</Badge>
                        )}
                        {isExpired && <Badge variant="destructive">Expired</Badge>}
                        {isNotStarted && <Badge variant="secondary">Scheduled</Badge>}
                        {!coupon.active && <Badge variant="outline">Disabled</Badge>}
                        {coupon.showOnHero && <Badge variant="secondary">🏠 Hero</Badge>}
                        {coupon.freeDelivery && <Badge variant="secondary">🚚 Free Delivery</Badge>}
                      </div>
                      <p className="font-medium">{coupon.title}</p>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>
                          {coupon.discountType === "percentage" && `${coupon.discountValue}% off`}
                          {coupon.discountType === "flat" && `${formatINR(coupon.discountValue)} off`}
                          {coupon.discountType === "free_shipping" && "Free Shipping"}
                          {coupon.maxDiscount && coupon.discountType === "percentage" && ` (max ${formatINR(coupon.maxDiscount)})`}
                        </span>
                        {coupon.minOrderValue > 0 && <span>• Min order: {formatINR(coupon.minOrderValue)}</span>}
                        <span>• {formatDate(coupon.validFrom)} — {formatDate(coupon.validUntil)}</span>
                        <span>• Used: {coupon.currentUses}{coupon.maxUses ? `/${coupon.maxUses}` : ""}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleHero(coupon)}
                        title={coupon.showOnHero ? "Hide from hero" : "Show on hero"}
                      >
                        {coupon.showOnHero ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Switch
                        checked={coupon.active}
                        onCheckedChange={() => handleToggleActive(coupon)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(coupon)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
