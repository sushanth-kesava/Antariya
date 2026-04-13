"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { CATEGORIES, Product } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  LayoutDashboard,
  PlusCircle,
  PackageCheck,
  AlertCircle,
  Loader2,
  MessageSquareWarning,
  ShieldCheck,
  ShieldX,
  Flag,
  History,
  Trash2,
  UploadCloud,
  Users,
  ShoppingCart,
  ClipboardCheck,
  Heart,
  X,
} from "lucide-react";
import {
  createProductOnBackend,
  deleteProductOnBackend,
  getProductsFromBackend,
  getReviewModerationActivityFromBackend,
  getReviewModerationQueueFromBackend,
  ModerationActivityItem,
  ModerationReview,
  ReviewModerationStatus,
  uploadProductImagesToBackend,
  updateReviewModerationOnBackend,
} from "@/lib/api/products";
import {
  AdminDashboardPayload,
  getAdminDashboardFromBackend,
  updateAdminOrderStatusOnBackend,
} from "@/lib/api/orders";
import { formatINR, formatIndianDate, formatIndianDateTime, normalizeCatalogPriceToINR } from "@/lib/india";
import { clearAuthSession, getPortalPathForRole, normalizeAppRole, persistAuthSession } from "@/lib/auth-session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.antariyaofficial.com/api";

type AdminView =
  | "operations-overview"
  | "add-new-product"
  | "my-company-catalog"
  | "review-moderation"
  | "moderation-activity";

export default function AdminPortalClient({ activeView }: { activeView: AdminView }) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [authToken, setAuthToken] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [moderationQueue, setModerationQueue] = useState<ModerationReview[]>([]);
  const [loadingModeration, setLoadingModeration] = useState(false);
  const [moderationStatus, setModerationStatus] = useState<ReviewModerationStatus | "all">("pending");
  const [moderationSearch, setModerationSearch] = useState("");
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderatingReviewId, setModeratingReviewId] = useState<string | null>(null);
  const [moderationActivity, setModerationActivity] = useState<ModerationActivityItem[]>([]);
  const [loadingModerationActivity, setLoadingModerationActivity] = useState(false);
  const [moderationActivityError, setModerationActivityError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<AdminDashboardPayload | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "Processing" | "Shipped" | "Delivered" | "Cancelled">("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [isDragOverImages, setIsDragOverImages] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: CATEGORIES[0],
    stock: "100",
    customizable: false,
    rating: "0",
  });

  const selectedImagePreviews = useMemo(
    () => selectedImageFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    [selectedImageFiles]
  );

  useEffect(() => {
    return () => {
      selectedImagePreviews.forEach((entry) => {
        URL.revokeObjectURL(entry.previewUrl);
      });
    };
  }, [selectedImagePreviews]);

  useEffect(() => {
    const validateAdminSession = async () => {
      const token = localStorage.getItem("app_auth_token");

      if (!token) {
        clearAuthSession();
        setLoadingCatalog(false);
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data?.success || !data?.user) {
          clearAuthSession();
          setLoadingCatalog(false);
          router.replace("/login");
          return;
        }

        const normalizedUser = {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
          photoURL: data.user.photoURL || null,
          role: normalizeAppRole(data.user.role),
        };

        const sessionToken =
          typeof data.token === "string" && data.token.trim().length > 0 ? data.token : token;

        persistAuthSession(sessionToken, normalizedUser);

        if (normalizedUser.role !== "admin") {
          setLoadingCatalog(false);
          router.replace(getPortalPathForRole(normalizedUser.role));
          return;
        }

        setAuthToken(sessionToken);
        setAdminUser(normalizedUser);
        const [products, adminDashboard] = await Promise.all([
          getProductsFromBackend({ dealerId: normalizedUser.id }),
          getAdminDashboardFromBackend(sessionToken),
        ]);
        setCatalog(products);
        setDashboardData(adminDashboard);
        try {
          setLoadingModeration(true);
          const reviews = await getReviewModerationQueueFromBackend(sessionToken, { status: "pending" });
          setModerationQueue(reviews);
        } catch (moderationLoadError) {
          console.error("Failed to preload moderation queue", moderationLoadError);
          setModerationError("Moderation queue could not be loaded right now. You can retry below.");
        } finally {
          setLoadingModeration(false);
        }

        try {
          setLoadingModerationActivity(true);
          const activity = await getReviewModerationActivityFromBackend(sessionToken, 20);
          setModerationActivity(activity);
        } catch (activityLoadError) {
          console.error("Failed to preload moderation activity", activityLoadError);
          setModerationActivityError("Moderation activity could not be loaded right now.");
        } finally {
          setLoadingModerationActivity(false);
        }

        setLoadingCatalog(false);
        setAuthChecked(true);
      } catch {
        clearAuthSession();
        setLoadingCatalog(false);
        router.replace("/login");
      }
    };

    void validateAdminSession();
  }, [router]);

  const loadModerationQueue = async (status = moderationStatus, search = moderationSearch) => {
    if (!authToken) {
      return;
    }

    try {
      setModerationError(null);
      setLoadingModeration(true);
      const reviews = await getReviewModerationQueueFromBackend(authToken, {
        status,
        search,
      });
      setModerationQueue(reviews);
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : "Failed to load moderation queue.");
    } finally {
      setLoadingModeration(false);
    }
  };

  const loadDashboard = async () => {
    if (!authToken) {
      return;
    }

    try {
      setDashboardError(null);
      setLoadingDashboard(true);
      const payload = await getAdminDashboardFromBackend(authToken);
      setDashboardData(payload);
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Failed to load admin dashboard.");
    } finally {
      setLoadingDashboard(false);
    }
  };

  const handleOrderStatusUpdate = async (orderId: string, status: "Processing" | "Shipped" | "Delivered" | "Cancelled") => {
    if (!authToken) {
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      const updatedOrder = await updateAdminOrderStatusOnBackend(authToken, orderId, status);

      setDashboardData((current) => {
        if (!current) {
          return current;
        }

        const updatedRecentOrders = current.recentOrders.map((order) => (order.id === orderId ? updatedOrder : order));

        const nextBreakdown = { ...current.statusBreakdown };
        const previousOrder = current.recentOrders.find((order) => order.id === orderId);

        if (previousOrder) {
          nextBreakdown[previousOrder.status as keyof typeof nextBreakdown] = Math.max(
            0,
            (nextBreakdown[previousOrder.status as keyof typeof nextBreakdown] || 0) - 1
          );
        }

        nextBreakdown[status] = (nextBreakdown[status] || 0) + 1;

        return {
          ...current,
          recentOrders: updatedRecentOrders,
          statusBreakdown: nextBreakdown,
        };
      });
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Failed to update order status.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const loadModerationActivity = async () => {
    if (!authToken) {
      return;
    }

    try {
      setModerationActivityError(null);
      setLoadingModerationActivity(true);
      const activity = await getReviewModerationActivityFromBackend(authToken, 20);
      setModerationActivity(activity);
    } catch (err) {
      setModerationActivityError(err instanceof Error ? err.message : "Failed to load moderation activity.");
    } finally {
      setLoadingModerationActivity(false);
    }
  };

  const handleModerationAction = async (reviewId: string, moderationStatus: ReviewModerationStatus) => {
    if (!authToken) {
      return;
    }

    try {
      setModerationError(null);
      setModeratingReviewId(reviewId);

      const wantsNote = moderationStatus === "hidden" || moderationStatus === "flagged";
      const moderationNote = wantsNote
        ? window.prompt("Optional moderation note (visible to admins only):", "")?.trim() || undefined
        : undefined;

      await updateReviewModerationOnBackend(authToken, reviewId, {
        moderationStatus,
        moderationNote,
      });

      await loadModerationQueue();
      await loadModerationActivity();
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : "Failed to update moderation status.");
    } finally {
      setModeratingReviewId(null);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleImageFileSelect = (incomingFiles: FileList | File[]) => {
    const nextFiles = Array.from(incomingFiles).filter((file) => file.type.startsWith("image/"));

    if (nextFiles.length === 0) {
      setError("Please upload valid image files.");
      return;
    }

    setError(null);
    setSelectedImageFiles((current) => {
      const deduped = [...current];

      for (const file of nextFiles) {
        const exists = deduped.some(
          (item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
        );

        if (!exists) {
          deduped.push(file);
        }

        if (deduped.length >= 6) {
          break;
        }
      }

      if (current.length + nextFiles.length > 6) {
        setError("You can upload up to 6 images only.");
      }

      return deduped.slice(0, 6);
    });
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImageFiles((current) => current.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedImageFiles.length === 0) {
      setError("Please upload at least one product image.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const uploadedImages = await uploadProductImagesToBackend(authToken, selectedImageFiles);

      if (uploadedImages.length === 0) {
        throw new Error("Image upload failed. Please try again.");
      }

      const created = await createProductOnBackend(authToken, {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        image: uploadedImages[0],
        images: uploadedImages,
        category: formData.category,
        stock: parseInt(formData.stock, 10),
        customizable: formData.customizable,
        rating: parseFloat(formData.rating),
      });

      setCatalog((current) => [created, ...current]);
      setSuccess(true);
      
      // Reset form but keep category
      setFormData({
        name: "",
        description: "",
        price: "",
        category: formData.category,
        stock: "100",
        customizable: false,
        rating: "0",
      });
      setSelectedImageFiles([]);
      
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error adding product:", err);
      setError(err.message || "Failed to add product.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (confirm("Are you sure you want to delete this product from your catalog?")) {
        await deleteProductOnBackend(authToken, id);
        setCatalog((current) => current.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete product.");
    }
  };

  const visibleOrders = (dashboardData?.recentOrders || []).filter((order) => {
    const matchesStatus = orderStatusFilter === "all" ? true : order.status === orderStatusFilter;
    const searchValue = orderSearch.trim().toLowerCase();
    const matchesSearch =
      searchValue.length === 0
        ? true
        : [order.id, order.userEmail || "", order.status, ...(order.items || []).map((item) => item.name || "")]
            .join(" ")
            .toLowerCase()
            .includes(searchValue);

    return matchesStatus && matchesSearch;
  });

  const navItems: Array<{ key: AdminView; label: string; icon: any }> = [
    { key: "operations-overview", label: "Operations Overview", icon: LayoutDashboard },
    { key: "add-new-product", label: "Add New Product", icon: PlusCircle },
    { key: "my-company-catalog", label: "My Company Catalog", icon: PackageCheck },
    { key: "review-moderation", label: "Review Moderation", icon: MessageSquareWarning },
    { key: "moderation-activity", label: "Moderation Activity", icon: History },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 py-8 gap-8">
        
        {/* Admin Sidebar */}
        <aside className="w-full lg:w-72 space-y-4">
          <div className="bg-primary border shadow-lg rounded-2xl p-6 space-y-6 text-primary-foreground">
            <div className="flex items-center gap-4">
              <div>
                <p className="font-bold text-lg leading-tight">Admin Portal</p>
                <p className="text-sm font-medium text-primary-foreground/80 mt-1">{adminUser?.displayName || "Super Administrator"}</p>
              </div>
            </div>
            <div className="space-y-1 pt-4 border-t border-white/20">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.key;

                return (
                  <Button
                    key={item.key}
                    asChild
                    variant="ghost"
                    className={`w-full justify-start gap-3 hover:bg-white/10 hover:text-white ${isActive ? "bg-white/10 font-bold" : ""}`}
                  >
                    <Link href={`/portal/admin/${item.key}`}>
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 max-w-3xl">
          {activeView === "operations-overview" ? (
          <div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-gray-900 mb-4">Operations Overview</h2>
            <Card className="rounded-[32px] border-gray-100 shadow-sm bg-white">
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Live Business Snapshot</CardTitle>
                  <CardDescription>Admin metrics inspired by customer dashboard depth, focused on store operations.</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 rounded-xl"
                  onClick={() => loadDashboard()}
                  disabled={loadingDashboard}
                >
                  {loadingDashboard ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardError ? (
                  <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{dashboardError}</div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Revenue</p>
                    <p className="text-2xl font-black text-emerald-900 mt-1 flex items-center gap-2">
                      {formatINR(Number(dashboardData?.summary.totalRevenue || 0))}
                    </p>
                    <p className="text-sm text-emerald-700 mt-1">AOV {formatINR(Number(dashboardData?.summary.averageOrderValue || 0))}</p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">Orders</p>
                    <p className="text-2xl font-black text-blue-900 mt-1 flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      {dashboardData?.summary.totalOrders || 0}
                    </p>
                    <p className="text-sm text-blue-700 mt-1">{dashboardData?.summary.todayOrders || 0} placed today</p>
                  </div>

                  <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-violet-700 font-semibold">Customers</p>
                    <p className="text-2xl font-black text-violet-900 mt-1 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {dashboardData?.summary.customers || 0}
                    </p>
                    <p className="text-sm text-violet-700 mt-1">Active shopper accounts</p>
                  </div>

                  <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-rose-700 font-semibold">Attention Needed</p>
                    <p className="text-2xl font-black text-rose-900 mt-1 flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5" />
                      {(dashboardData?.summary.lowStockProducts || 0) + (dashboardData?.summary.pendingReviews || 0)}
                    </p>
                    <p className="text-sm text-rose-700 mt-1">
                      {dashboardData?.summary.lowStockProducts || 0} low stock, {dashboardData?.summary.pendingReviews || 0} pending reviews
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                    <div className="flex flex-col gap-3 mb-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-800">Recent Orders</p>
                        <span className="text-xs text-gray-500">Latest 8</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <select
                          title="Order status filter"
                          aria-label="Order status filter"
                          value={orderStatusFilter}
                          onChange={(event) => setOrderStatusFilter(event.target.value as typeof orderStatusFilter)}
                          className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="all">All statuses</option>
                          <option value="Processing">Processing</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                        <Input
                          placeholder="Search by order, customer, item"
                          value={orderSearch}
                          onChange={(event) => setOrderSearch(event.target.value)}
                          className="h-10 rounded-xl border-gray-200 bg-white"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-10 rounded-xl"
                          onClick={() => {
                            setOrderStatusFilter("all");
                            setOrderSearch("");
                          }}
                        >
                          Clear Filters
                        </Button>
                      </div>
                    </div>

                    {!dashboardData?.recentOrders?.length ? (
                      <p className="text-sm text-muted-foreground">No orders yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {visibleOrders.slice(0, 5).map((order) => (
                          <div key={order.id} className="rounded-xl border border-white bg-white px-3 py-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{order.userEmail || "Customer"}</p>
                              <p className="text-xs text-gray-500">{formatIndianDateTime(order.createdAt)} • {order.items?.length || 0} items</p>
                            </div>
                            <div className="flex flex-col items-end gap-2 text-right">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{formatINR(Number(order.total || 0))}</p>
                                <p className="text-xs text-gray-500">{order.status}</p>
                              </div>
                              <select
                                title={`Update order ${order.id} status`}
                                aria-label={`Update order ${order.id} status`}
                                value={order.status}
                                onChange={(event) => handleOrderStatusUpdate(order.id, event.target.value as any)}
                                disabled={updatingOrderId === order.id}
                                className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="Processing">Processing</option>
                                <option value="Shipped">Shipped</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </div>
                          </div>
                        ))}
                        {visibleOrders.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-muted-foreground text-center">
                            No orders match the current filters.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-800">Order Status Mix</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-gray-100">
                        <span>Processing</span>
                        <span className="font-bold">{dashboardData?.statusBreakdown.Processing || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-gray-100">
                        <span>Shipped</span>
                        <span className="font-bold">{dashboardData?.statusBreakdown.Shipped || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-gray-100">
                        <span>Delivered</span>
                        <span className="font-bold">{dashboardData?.statusBreakdown.Delivered || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-gray-100">
                        <span>Cancelled</span>
                        <span className="font-bold">{dashboardData?.statusBreakdown.Cancelled || 0}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Customer Intent</p>
                      <p className="text-lg font-black text-gray-900 mt-1 flex items-center gap-2">
                        <Heart className="h-4 w-4 text-rose-500" />
                        {dashboardData?.summary.wishlistItems || 0}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Products currently wishlisted</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          ) : null}

          {activeView === "add-new-product" ? (
          <Card className="rounded-[32px] border-gray-100 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-8">
              <CardTitle className="text-3xl font-black font-headline tracking-tight text-gray-900">Add New Product</CardTitle>
              <CardDescription className="text-gray-500 text-base">
                Fill out the details below to push a new premium product directly to the customer marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              
              {success && (
                <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-700 font-medium">
                  <PackageCheck className="h-6 w-6 text-green-500" />
                  Product successfully added! It is now live in the marketplace.
                </div>
              )}
              
              {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 font-medium">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Name & Basic Desc */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Product Name <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      className="h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-lg" 
                      placeholder="e.g. Royal Zardosi Thread Set"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Detailed Description <span className="text-red-500">*</span></label>
                    <textarea 
                      required 
                      className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white p-4 text-base focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                      rows={4}
                      placeholder="Describe the quality and specs of the product..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                </div>

                {/* Pricing & Stock */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Price (in INR) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                      <Input 
                        required 
                        type="number" 
                        step="0.01" 
                        className="pl-8 h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-lg font-bold" 
                        placeholder="0.00"
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Initial Stock <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      type="number" 
                      className="h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-lg" 
                      value={formData.stock}
                      onChange={e => setFormData({...formData, stock: e.target.value})}
                    />
                  </div>
                </div>

                {/* Image Upload & Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Product Images <span className="text-red-500">*</span></label>
                    <div
                      className={`rounded-2xl border-2 border-dashed p-5 transition-all cursor-pointer ${isDragOverImages ? "border-primary bg-primary/5" : "border-gray-200 bg-gray-50 hover:border-primary/50"}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragOverImages(true);
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        setIsDragOverImages(false);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsDragOverImages(false);
                        handleImageFileSelect(event.dataTransfer.files);
                      }}
                      onClick={() => {
                        const input = document.getElementById("admin-product-images") as HTMLInputElement | null;
                        input?.click();
                      }}
                    >
                      <input
                        id="admin-product-images"
                        type="file"
                        accept="image/*"
                        multiple
                        title="Upload product images"
                        className="hidden"
                        onChange={(event) => {
                          if (event.target.files) {
                            handleImageFileSelect(event.target.files);
                          }
                          event.currentTarget.value = "";
                        }}
                      />

                      <div className="flex items-center gap-3 text-gray-700">
                        <div className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Drag and drop images here</p>
                          <p className="text-xs text-muted-foreground">or click to browse. Up to 6 images.</p>
                        </div>
                      </div>

                      {selectedImagePreviews.length > 0 ? (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {selectedImagePreviews.map(({ file, previewUrl }, index) => (
                            <div key={`${file.name}-${file.lastModified}`} className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
                              <img src={previewUrl} alt={file.name} className="h-20 w-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeSelectedImage(index);
                                }}
                                aria-label="Remove image"
                                title="Remove image"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Marketplace Category <span className="text-red-500">*</span></label>
                    <select 
                      title="Marketplace Category"
                      aria-label="Marketplace Category"
                      className="w-full h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white px-4 text-base font-medium outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Configurations */}
                <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <label className="block text-base font-bold text-gray-900">Customizable Base</label>
                    <p className="text-sm text-gray-500">Enable this if the item can be sent to the scratch-build studio.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      title="Customizable Base"
                      aria-label="Customizable Base"
                      className="sr-only peer" 
                      checked={formData.customizable}
                      onChange={e => setFormData({...formData, customizable: e.target.checked})}
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="pt-8">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Publishing to Store...
                      </>
                    ) : (
                      "Publish Product"
                    )}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>
          ) : null}

          {/* Catalog Management Section */}
          {activeView === "my-company-catalog" ? (
          <div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-gray-900 mb-4">My Company Catalog</h2>
            <div className="space-y-4">
              {loadingCatalog ? (
                <div className="p-8 text-center text-muted-foreground bg-white rounded-[32px] border border-gray-100 shadow-sm">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /> Loading your products...
                </div>
              ) : catalog && catalog.length > 0 ? (
                catalog.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 shadow-sm rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted relative">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-500">{formatINR(normalizeCatalogPriceToINR(Number(product.price || 0)))} • {product.category} • In stock: {product.stock}</p>
                      </div>
                    </div>
                    <div>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground bg-white rounded-[32px] border border-gray-100 shadow-sm">
                  No products in your catalog yet. Start adding above!
                </div>
              )}
            </div>
          </div>
          ) : null}

          {activeView === "review-moderation" ? (
          <div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-gray-900 mb-4">Review Moderation</h2>
            <Card className="rounded-[32px] border-gray-100 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <MessageSquareWarning className="h-5 w-5 text-amber-600" />
                  Moderation Queue
                </CardTitle>
                <CardDescription>Approve, hide, or flag customer reviews to keep your catalog trustworthy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    title="Review status filter"
                    aria-label="Review status filter"
                    value={moderationStatus}
                    onChange={(e) => setModerationStatus(e.target.value as ReviewModerationStatus | "all")}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="hidden">Hidden</option>
                    <option value="flagged">Flagged</option>
                  </select>
                  <Input
                    placeholder="Search by title, review text, or user"
                    value={moderationSearch}
                    onChange={(e) => setModerationSearch(e.target.value)}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white"
                  />
                  <Button
                    type="button"
                    onClick={() => loadModerationQueue()}
                    disabled={loadingModeration}
                    className="h-11 rounded-xl"
                    variant="secondary"
                  >
                    {loadingModeration ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh Queue"}
                  </Button>
                </div>

                {moderationError ? (
                  <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{moderationError}</div>
                ) : null}

                {loadingModeration ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading reviews...
                  </div>
                ) : moderationQueue.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">No reviews found for this filter.</div>
                ) : (
                  <div className="space-y-3">
                    {moderationQueue.map((review) => (
                      <div key={review.id} className="border border-gray-200 rounded-2xl p-4 bg-gray-50/40">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-gray-500">{review.productName} • {review.productCategory || "General"}</p>
                            <h3 className="font-bold text-gray-900">{review.title}</h3>
                            <p className="text-sm text-gray-500">By {review.userName} ({review.userEmail}) • {formatIndianDate(review.createdAt)}</p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700 font-semibold uppercase">{review.moderationStatus}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{review.comment}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="rounded-lg"
                            onClick={() => handleModerationAction(review.id, "approved")}
                            disabled={moderatingReviewId === review.id}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="rounded-lg"
                            onClick={() => handleModerationAction(review.id, "hidden")}
                            disabled={moderatingReviewId === review.id}
                          >
                            <ShieldX className="h-4 w-4 mr-1" /> Hide
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="rounded-lg"
                            onClick={() => handleModerationAction(review.id, "flagged")}
                            disabled={moderatingReviewId === review.id}
                          >
                            <Flag className="h-4 w-4 mr-1" /> Flag
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          ) : null}

          {activeView === "moderation-activity" ? (
          <div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-gray-900 mb-4">Moderation Activity</h2>
            <Card className="rounded-[32px] border-gray-100 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-xl">
                  <span className="flex items-center gap-2">
                    <History className="h-5 w-5 text-slate-700" /> Recent Actions
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 rounded-xl"
                    onClick={() => loadModerationActivity()}
                    disabled={loadingModerationActivity}
                  >
                    {loadingModerationActivity ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                  </Button>
                </CardTitle>
                <CardDescription>Audit trail of the latest review moderation changes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {moderationActivityError ? (
                  <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{moderationActivityError}</div>
                ) : null}

                {loadingModerationActivity ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading moderation activity...
                  </div>
                ) : moderationActivity.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">No moderation activity yet.</div>
                ) : (
                  moderationActivity.map((item) => (
                    <div key={`${item.id}-${item.moderatedAt || item.createdAt}`} className="rounded-2xl border border-gray-200 bg-gray-50/40 p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{item.productName}</p>
                          <p className="text-sm text-gray-500">Review: {item.title}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700 font-semibold uppercase">
                          {item.moderationStatus}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <p>
                          Action by <span className="font-semibold text-gray-800">{item.moderatorName}</span>{" "}
                          on {formatIndianDateTime(item.moderatedAt || item.createdAt)}
                        </p>
                        {item.moderationNote ? (
                          <p className="mt-1 rounded-lg bg-white px-3 py-2 border border-gray-200">Note: {item.moderationNote}</p>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
          ) : null}

        </main>
      </div>
    </div>
  );
}
