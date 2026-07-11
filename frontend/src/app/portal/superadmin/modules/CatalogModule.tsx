"use client";

import { useEffect, useState } from "react";
import { Loader2, Star, Check, EyeOff, Flag, RefreshCw, Tags, Eye, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/india";
import {
  getReviewModerationQueueFromBackend,
  updateReviewModerationOnBackend,
  ModerationReview,
  ReviewModerationStatus,
} from "@/lib/api/products";
import {
  listErpProducts,
  updateErpProduct,
  setErpProductPublished,
  ErpProductRow,
} from "@/lib/api/erp";

type Tab = "products" | "reviews";

export function CatalogModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("products");
  const canViewProducts = has("catalog.view");
  const canModerate = has("catalog.reviews.moderate");

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b">
        {canViewProducts && (
          <TabButton active={tab === "products"} onClick={() => setTab("products")} icon={Tags}>
            Products
          </TabButton>
        )}
        {canModerate && (
          <TabButton active={tab === "reviews"} onClick={() => setTab("reviews")} icon={Star}>
            Review Moderation
          </TabButton>
        )}
      </div>

      {tab === "products" && canViewProducts && (
        <ProductsPanel token={token} canEdit={has("catalog.edit")} canPublish={has("catalog.publish")} />
      )}
      {tab === "reviews" && canModerate && <ReviewsPanel token={token} />}
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

/* ────────────────────────── Products Panel ────────────────────────── */

type EditDraft = { name: string; price: string; category: string; description: string };

function ProductsPanel({
  token,
  canEdit,
  canPublish,
}: {
  token: string;
  canEdit: boolean;
  canPublish: boolean;
}) {
  const [products, setProducts] = useState<ErpProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ name: "", price: "", category: "", description: "" });

  const reload = () => {
    setLoading(true);
    listErpProducts(token, { limit: 50, search: search.trim() || undefined })
      .then((res) => setProducts(res.products))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load products"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const startEdit = (p: ErpProductRow) => {
    setEditing(p.id);
    setDraft({ name: p.name, price: String(p.price), category: p.category, description: "" });
  };

  const saveEdit = async (p: ErpProductRow) => {
    try {
      setBusyId(p.id);
      setError(null);
      const payload: Record<string, unknown> = {
        name: draft.name.trim(),
        category: draft.category.trim(),
      };
      const price = Number(draft.price);
      if (Number.isFinite(price) && price >= 0) payload.price = price;
      if (draft.description.trim()) payload.description = draft.description.trim();
      await updateErpProduct(token, p.id, payload);
      setEditing(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save product");
    } finally {
      setBusyId(null);
    }
  };

  const togglePublish = async (p: ErpProductRow) => {
    try {
      setBusyId(p.id);
      setError(null);
      await setErpProductPublished(token, p.id, !p.published);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change publish state");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4" /> Product Catalog
        </CardTitle>
        <CardDescription>Edit product details and control storefront visibility.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && reload()}
              className="pl-9"
            />
          </div>
          <Button size="sm" variant="outline" onClick={reload} className="gap-1">
            <RefreshCw className="h-4 w-4" /> Search
          </Button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No products found.</p>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="rounded-md border p-3">
                {editing === p.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name" />
                      <Input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="Price" type="number" />
                      <Input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="Category" />
                      <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="New description (optional)" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busyId === p.id} onClick={() => saveEdit(p)} className="gap-1">
                        {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {p.name} · {formatINR(p.price)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.category || "—"} · {p.stock} in stock
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.published ? "secondary" : "outline"} className={p.published ? "text-green-600" : "text-muted-foreground"}>
                        {p.published ? "published" : "hidden"}
                      </Badge>
                      {canPublish && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={busyId === p.id} onClick={() => togglePublish(p)}>
                          {p.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {p.published ? "Unpublish" : "Publish"}
                        </Button>
                      )}
                      {canEdit && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => startEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────── Reviews Panel ────────────────────────── */

const FILTERS: { key: ReviewModerationStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "hidden", label: "Hidden" },
  { key: "flagged", label: "Flagged" },
];

function ReviewsPanel({ token }: { token: string }) {
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [filter, setFilter] = useState<ReviewModerationStatus | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    getReviewModerationQueueFromBackend(token, { status: filter })
      .then(setReviews)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load reviews"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  const moderate = async (review: ModerationReview, status: ReviewModerationStatus) => {
    try {
      setBusyId(review.id);
      setError(null);
      await updateReviewModerationOnBackend(token, review.id, { moderationStatus: status });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to moderate review");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4" /> Review Moderation
        </CardTitle>
        <CardDescription>Approve, hide, or flag customer reviews before they appear.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={reload} className="ml-auto gap-1">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No reviews in this view.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {r.title || "(no title)"} <span className="text-amber-500">{"★".repeat(Math.round(r.rating))}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.productName} · {r.userName || r.userEmail} · {new Date(r.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <Badge variant="outline">{r.moderationStatus || "pending"}</Badge>
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={busyId === r.id} onClick={() => moderate(r, "approved")}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={busyId === r.id} onClick={() => moderate(r, "hidden")}>
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-destructive" disabled={busyId === r.id} onClick={() => moderate(r, "flagged")}>
                    <Flag className="h-3.5 w-3.5" /> Flag
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
