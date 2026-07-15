"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Product } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  LayoutDashboard,
  PlusCircle,
  PackageCheck,
  AlertCircle,
  CheckCircle2,
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
  Pencil,
} from "lucide-react";
import {
  createProductOnBackend,
  deleteProductOnBackend,
  getProductsFromBackend,
  getInventoryReportFromBackend,
  InventoryReport,
  adjustStockOnBackend,
  getStockHistoryFromBackend,
  StockAdjustmentEntry,
  exportInventoryCsvFromBackend,
  importInventoryCsvToBackend,
  getReviewModerationActivityFromBackend,
  getReviewModerationQueueFromBackend,
  getMarketplaceLayoutFromBackend,
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
import { useInventoryUpdates } from "@/hooks/use-inventory-updates";
import { useInventoryAlerts } from "@/hooks/use-inventory-alerts";
import { getApiBaseUrl } from "@/lib/api/base-url";
import { formatINR, formatIndianDate, formatIndianDateTime, normalizeCatalogPriceToINR } from "@/lib/india";
import { PRODUCT_ATTRIBUTES } from "@/lib/categories";
import { MultiSelectCreatable } from "@/components/multi-select-creatable";
import { clearAuthSession, getPortalPathForRole, normalizeAppRole, persistAuthSession } from "@/lib/auth-session";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const API_BASE_URL = getApiBaseUrl();

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
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [stockHistory, setStockHistory] = useState<StockAdjustmentEntry[]>([]);
  const [adjustForm, setAdjustForm] = useState<{ productId: string; variantSku: string; type: "add" | "remove" | "set"; quantity: string; reason: string }>({
    productId: "",
    variantSku: "",
    type: "add",
    quantity: "",
    reason: "",
  });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustMessage, setAdjustMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Quick stock-only editor (per catalog row). Kept separate from the full
  // adjust form above so the row action stays focused on updating stock.
  const [stockEditProduct, setStockEditProduct] = useState<any | null>(null);
  const [stockEditVariantSku, setStockEditVariantSku] = useState<string>("");
  const [stockEditValue, setStockEditValue] = useState<string>("");
  const [stockEditSaving, setStockEditSaving] = useState(false);
  const [stockEditError, setStockEditError] = useState<string | null>(null);
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
  const [marketplaceCategories, setMarketplaceCategories] = useState<string[]>([]);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [pendingModerationAction, setPendingModerationAction] = useState<{ reviewId: string; status: ReviewModerationStatus } | null>(null);
  const [moderationNoteInput, setModerationNoteInput] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    stock: "100",
    customizable: false,
    rating: "0",
  });

  // Multi-select attribute values (Size/Color/Gender/Neck/Pattern) -> variant axes.
  const [attrValues, setAttrValues] = useState<Record<string, string[]>>({
    size: [],
    color: [],
    gender: [],
    neckType: [],
    pattern: [],
  });

  type VariantRow = {
    key: string;
    sku: string;
    size: string;
    color: string;
    gender: string;
    neckType: string;
    pattern: string;
    price: string;
    stock: string;
  };
  const [variants, setVariants] = useState<VariantRow[]>([]);

  // --- Real-time inventory (staff) --------------------------------------
  // Live low-stock + verification alerts pushed to the admin role room.
  const { lowStock: liveLowStock, alert: liveAlert } = useInventoryAlerts("admin");
  // Any inventory:update refreshes the inventory report so the dashboard
  // figures (available/low/out) stay current without a manual reload. We
  // debounce via a ref timer to coalesce bursts.
  const inventoryRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useInventoryUpdates({
    role: "admin",
    onUpdate: () => {
      if (!authToken) return;
      if (inventoryRefreshTimer.current) clearTimeout(inventoryRefreshTimer.current);
      inventoryRefreshTimer.current = setTimeout(() => {
        void loadInventory();
      }, 800);
    },
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

        // Unblock the page as soon as auth is confirmed. Essential data (products,
        // dashboard) and secondary data (categories, moderation) load in the
        // background so a single slow endpoint can no longer freeze the portal.
        setAuthChecked(true);

        // Essential data — fills the dashboard/catalog, but does not gate the shell.
        getProductsFromBackend({ dealerId: normalizedUser.id })
          .then((productsResponse) => setCatalog(productsResponse.products))
          .catch((productsError) => {
            console.error("Failed to load catalog", productsError);
          })
          .finally(() => setLoadingCatalog(false));

        setLoadingDashboard(true);
        getAdminDashboardFromBackend(sessionToken)
          .then((adminDashboard) => setDashboardData(adminDashboard))
          .catch((dashboardLoadError) => {
            console.error("Failed to load admin dashboard", dashboardLoadError);
            setDashboardError("Dashboard data could not be loaded right now. Use Refresh to retry.");
          })
          .finally(() => setLoadingDashboard(false));

        setLoadingInventory(true);
        getInventoryReportFromBackend(sessionToken)
          .then((report) => setInventory(report))
          .catch((inventoryError) => console.error("Failed to load inventory", inventoryError))
          .finally(() => setLoadingInventory(false));

        getStockHistoryFromBackend(sessionToken)
          .then((history) => setStockHistory(history))
          .catch((historyError) => console.error("Failed to load stock history", historyError));

        // Marketplace categories (background).
        getMarketplaceLayoutFromBackend("admin")
          .then((layout) => {
            if (layout.success && "categories" in layout) {
              setMarketplaceCategories(layout.categories);
              setFormData((current) => ({
                ...current,
                category: current.category || layout.categories[0] || "",
              }));
            }
          })
          .catch((layoutError) => {
            console.error("Failed to load marketplace categories", layoutError);
            setMarketplaceCategories([]);
          });

        // Moderation queue (background — must not block the portal).
        setLoadingModeration(true);
        getReviewModerationQueueFromBackend(sessionToken, { status: "pending" })
          .then((reviews) => setModerationQueue(reviews))
          .catch((moderationLoadError) => {
            console.error("Failed to preload moderation queue", moderationLoadError);
            setModerationError("Moderation queue could not be loaded right now. You can retry below.");
          })
          .finally(() => setLoadingModeration(false));

        // Moderation activity (background).
        setLoadingModerationActivity(true);
        getReviewModerationActivityFromBackend(sessionToken, 20)
          .then((activity) => setModerationActivity(activity))
          .catch((activityLoadError) => {
            console.error("Failed to preload moderation activity", activityLoadError);
            setModerationActivityError("Moderation activity could not be loaded right now.");
          })
          .finally(() => setLoadingModerationActivity(false));
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

  const loadInventory = async () => {
    if (!authToken) return;
    try {
      setLoadingInventory(true);
      const report = await getInventoryReportFromBackend(authToken);
      setInventory(report);
    } catch (err) {
      console.error("Failed to load inventory", err);
    } finally {
      setLoadingInventory(false);
    }
  };

  const loadCatalog = async () => {
    if (!authToken) return;
    try {
      setLoadingCatalog(true);
      const productsResponse = await getProductsFromBackend({ dealerId: adminUser?.id });
      setCatalog(productsResponse.products);
    } catch (err) {
      console.error("Failed to reload catalog", err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadStockHistory = async () => {
    if (!authToken) return;
    try {
      const history = await getStockHistoryFromBackend(authToken);
      setStockHistory(history);
    } catch (err) {
      console.error("Failed to load stock history", err);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setAdjustMessage(null);
    const quantity = parseInt(adjustForm.quantity, 10);
    if (!adjustForm.productId) {
      setAdjustMessage({ type: "error", text: "Please select a product." });
      return;
    }
    if (!Number.isFinite(quantity)) {
      setAdjustMessage({ type: "error", text: "Enter a valid quantity." });
      return;
    }
    const selectedProduct = catalog.find((p) => p.id === adjustForm.productId);
    const productHasVariants = Boolean(selectedProduct?.variants && selectedProduct.variants.length > 0);
    if (productHasVariants && !adjustForm.variantSku) {
      setAdjustMessage({ type: "error", text: "This product has variants. Please select which variant to adjust." });
      return;
    }
    try {
      setAdjusting(true);
      const { product } = await adjustStockOnBackend(authToken, adjustForm.productId, {
        type: adjustForm.type,
        quantity,
        variantSku: adjustForm.variantSku || undefined,
        reason: adjustForm.reason || undefined,
      });
      // Reflect updated stock in the catalog list.
      setCatalog((current) => current.map((item) => (item.id === product.id ? product : item)));
      setAdjustForm((current) => ({ ...current, quantity: "", reason: "" }));
      setAdjustMessage({ type: "success", text: "Stock updated successfully." });
      void loadCatalog();
      void loadStockHistory();
      void loadInventory();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Failed to adjust stock.";
      if (/product not found/i.test(raw)) {
        await loadCatalog();
        setAdjustForm((current) => ({ ...current, productId: "", variantSku: "" }));
        setAdjustMessage({ type: "error", text: "That product was out of sync, so I reloaded your live catalog. Please re-select the product and try again." });
      } else {
        setAdjustMessage({ type: "error", text: raw });
      }
    } finally {
      setAdjusting(false);
    }
  };

  const openStockEditor = (product: any) => {
    const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;
    const firstSku = hasVariants ? (product.variants[0]?.sku || "") : "";
    const initialStock = hasVariants
      ? Number(product.variants[0]?.stock ?? 0)
      : Number(product.stock ?? 0);
    setStockEditProduct(product);
    setStockEditVariantSku(firstSku);
    setStockEditValue(String(initialStock));
    setStockEditError(null);
  };

  const closeStockEditor = () => {
    setStockEditProduct(null);
    setStockEditVariantSku("");
    setStockEditValue("");
    setStockEditError(null);
  };

  // When switching the selected variant, reflect that variant's current stock.
  const handleStockEditVariantChange = (sku: string) => {
    setStockEditVariantSku(sku);
    const variant = stockEditProduct?.variants?.find((v: any) => v.sku === sku);
    if (variant) setStockEditValue(String(Number(variant.stock ?? 0)));
  };

  const handleStockEditSave = async () => {
    if (!authToken || !stockEditProduct) return;
    const newStock = parseInt(stockEditValue, 10);
    if (!Number.isFinite(newStock) || newStock < 0) {
      setStockEditError("Enter a valid stock quantity (0 or more).");
      return;
    }
    const hasVariants = Array.isArray(stockEditProduct.variants) && stockEditProduct.variants.length > 0;
    if (hasVariants && !stockEditVariantSku) {
      setStockEditError("Select which variant to update.");
      return;
    }
    try {
      setStockEditSaving(true);
      setStockEditError(null);
      // "set" writes the exact new stock level via the transactional service.
      const { product } = await adjustStockOnBackend(authToken, stockEditProduct.id, {
        type: "set",
        quantity: newStock,
        variantSku: hasVariants ? stockEditVariantSku : undefined,
        reason: "Manual stock edit (catalog)",
      });
      setCatalog((current) => current.map((item) => (item.id === product.id ? product : item)));
      setAdjustMessage({ type: "success", text: "Stock updated successfully." });
      void loadCatalog();
      void loadStockHistory();
      void loadInventory();
      closeStockEditor();
    } catch (err) {
      setStockEditError(err instanceof Error ? err.message : "Failed to update stock.");
    } finally {
      setStockEditSaving(false);
    }
  };

  const handleExportCsv = async () => {
    if (!authToken) return;
    try {
      const csv = await exportInventoryCsvFromBackend(authToken);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "antariya-inventory.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setAdjustMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to export CSV." });
    }
  };

  const handleImportCsv = (file: File | undefined) => {
    if (!file || !authToken) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const csv = typeof reader.result === "string" ? reader.result : "";
        const result = await importInventoryCsvToBackend(authToken, csv);
        setAdjustMessage({ type: "success", text: `Imported ${result.updated} row(s).${result.errors.length ? ` ${result.errors.length} skipped.` : ""}` });
        void loadInventory();
        void loadStockHistory();
        const productsResponse = await getProductsFromBackend({ dealerId: adminUser?.id });
        setCatalog(productsResponse.products);
      } catch (err) {
        setAdjustMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to import CSV." });
      }
    };
    reader.readAsText(file);
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

  const handleModerationAction = (reviewId: string, moderationStatus: ReviewModerationStatus) => {
    const wantsNote = moderationStatus === "hidden" || moderationStatus === "flagged";
    if (wantsNote) {
      setPendingModerationAction({ reviewId, status: moderationStatus });
      setModerationNoteInput("");
      setNoteDialogOpen(true);
    } else {
      void submitModerationAction(reviewId, moderationStatus, undefined);
    }
  };

  const submitModerationAction = async (reviewId: string, moderationStatus: ReviewModerationStatus, moderationNote: string | undefined) => {
    if (!authToken) return;
    try {
      setModerationError(null);
      setModeratingReviewId(reviewId);
      await updateReviewModerationOnBackend(authToken, reviewId, { moderationStatus, moderationNote });
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

        if (deduped.length >= 10) {
          break;
        }
      }

      if (current.length + nextFiles.length > 10) {
        setError("You can upload up to 10 images only.");
      }

      return deduped.slice(0, 10);
    });
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImageFiles((current) => current.filter((_, idx) => idx !== index));
  };

  // Cartesian product of the selected attribute axes -> one row per combination.
  const generateVariants = () => {
    const axes = PRODUCT_ATTRIBUTES.map((attr) => ({
      key: attr.key,
      values: attrValues[attr.key]?.length ? attrValues[attr.key] : [""],
    }));

    let combos: Record<string, string>[] = [{}];
    for (const axis of axes) {
      const next: Record<string, string>[] = [];
      for (const combo of combos) {
        for (const val of axis.values) {
          next.push({ ...combo, [axis.key]: val });
        }
      }
      combos = next;
    }

    // Preserve existing values for combos that already exist.
    const existingByKey = new Map(variants.map((row) => [row.key, row]));

    const skuBase = (formData.name || "SKU")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 12) || "SKU";

    const rows: VariantRow[] = combos.map((combo) => {
      const key = ["size", "color", "gender", "neckType", "pattern"].map((k) => combo[k] || "").join("|");
      const existing = existingByKey.get(key);
      const skuSuffix = [combo.size, combo.color, combo.gender, combo.neckType, combo.pattern]
        .filter(Boolean)
        .map((part) => String(part).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 4))
        .join("-");
      return {
        key,
        sku: existing?.sku || (skuSuffix ? `${skuBase}-${skuSuffix}` : skuBase),
        size: combo.size || "",
        color: combo.color || "",
        gender: combo.gender || "",
        neckType: combo.neckType || "",
        pattern: combo.pattern || "",
        price: existing?.price ?? (formData.price || ""),
        stock: existing?.stock ?? "0",
      };
    });

    setVariants(rows);
  };

  const updateVariantField = (key: string, field: "sku" | "price" | "stock", value: string) => {
    setVariants((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  };

  const totalVariantStock = variants.reduce((sum, row) => sum + (parseInt(row.stock, 10) || 0), 0);

  const selectedAxisCount = PRODUCT_ATTRIBUTES.reduce(
    (product, attr) => product * (attrValues[attr.key]?.length || 1),
    1
  );

  // Compress an image in the browser so it fits under the backend's 50MB limit.
  // Downscales to a max dimension and re-encodes as JPEG, stepping quality down
  // until the file is under the target size. Returns the original if it's already small.
  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // must match backend MAX_PRODUCT_IMAGE_SIZE_BYTES
  const COMPRESS_TARGET_BYTES = 45 * 1024 * 1024; // aim comfortably under the limit

  const compressImage = (file: File): Promise<File> =>
    new Promise((resolve) => {
      // Skip tiny files and non-raster types (e.g. SVG) — return as-is.
      if (file.size <= COMPRESS_TARGET_BYTES || !file.type.startsWith("image/") || file.type === "image/svg+xml") {
        resolve(file);
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDimension = 2000;
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const tryQuality = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              if (blob.size <= MAX_UPLOAD_BYTES || quality <= 0.4) {
                const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
                resolve(new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() }));
              } else {
                tryQuality(quality - 0.15);
              }
            },
            "image/jpeg",
            quality
          );
        };
        tryQuality(0.85);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });

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
      // Compress large images client-side so they fit under the 50MB backend limit.
      const preparedImages = await Promise.all(selectedImageFiles.map((file) => compressImage(file)));

      const stillTooLarge = preparedImages.find((file) => file.size > MAX_UPLOAD_BYTES);
      if (stillTooLarge) {
        setError(`"${stillTooLarge.name}" is still larger than 50MB after compression. Please use a smaller image.`);
        setLoading(false);
        return;
      }

      const uploadedImages = await uploadProductImagesToBackend(authToken, preparedImages);

      if (uploadedImages.length === 0) {
        throw new Error("Image upload failed. Please try again.");
      }

      const created = await createProductOnBackend(authToken, {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        price: parseFloat(formData.price),
        image: uploadedImages[0],
        images: uploadedImages,
        sizes: attrValues.size,
        colors: attrValues.color,
        genders: attrValues.gender,
        neckTypes: attrValues.neckType,
        patterns: attrValues.pattern,
        variants: variants.map((row) => ({
          sku: row.sku,
          size: row.size,
          color: row.color,
          gender: row.gender,
          neckType: row.neckType,
          pattern: row.pattern,
          price: parseFloat(row.price) || 0,
          stock: parseInt(row.stock, 10) || 0,
        })),
        stock: variants.length > 0
          ? variants.reduce((sum, row) => sum + (parseInt(row.stock, 10) || 0), 0)
          : parseInt(formData.stock, 10),
        customizable: formData.customizable,
        rating: parseFloat(formData.rating),
      });

      setCatalog((current) => [created, ...current]);
      setSuccess(true);
      
      // Reset form but keep category
      setFormData({
        name: "",
        description: "",
        category: formData.category,
        price: "",
        stock: "100",
        customizable: false,
        rating: "0",
      });
      setSelectedImageFiles([]);
      setAttrValues({ size: [], color: [], gender: [], neckType: [], pattern: [] });
      setVariants([]);

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error adding product:", err);
      const message = typeof err?.message === "string" ? err.message : "Failed to add product.";

      if (message.toLowerCase().includes("unknown api key") || message.toLowerCase().includes("cloudinary")) {
        setError("Image upload service is not configured on the backend yet. The product was not saved. Please try again after the backend is updated.");
        return;
      }

      setError(message || "Failed to add product.");
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
      {(liveLowStock || liveAlert) && (
        <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 pt-4 space-y-2">
          {liveLowStock && liveLowStock.count > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-center justify-between gap-3">
              <span>
                <strong>{liveLowStock.count}</strong> item{liveLowStock.count === 1 ? "" : "s"} at or below reorder point
                {liveLowStock.alerts?.[0] ? ` — e.g. ${liveLowStock.alerts[0].productName}${liveLowStock.alerts[0].variantSku ? ` (${liveLowStock.alerts[0].variantSku})` : ""} · ${liveLowStock.alerts[0].available} left` : ""}
              </span>
              <Button type="button" variant="secondary" size="sm" className="h-8 rounded-lg" onClick={() => loadInventory()}>Review</Button>
            </div>
          )}
          {liveAlert && liveAlert.issueCount > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 text-red-900 px-4 py-3 text-sm">
              <strong>Inventory verification:</strong> {liveAlert.issueCount} issue{liveAlert.issueCount === 1 ? "" : "s"} detected ({liveAlert.kind}). Check the ledger for details.
            </div>
          )}
        </div>
      )}
      
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
        <main className="flex-1 max-w-5xl">
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

                {/* Inventory Snapshot */}
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold">Inventory Snapshot</p>
                      <p className="text-xs text-muted-foreground">Stock on hand, value, and low-stock alerts.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={handleExportCsv}>
                        Export CSV
                      </Button>
                      <label className="h-9 rounded-xl border border-border bg-background px-3 flex items-center text-sm font-medium cursor-pointer hover:bg-muted">
                        Import CSV
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) => { handleImportCsv(e.target.files?.[0]); e.currentTarget.value = ""; }}
                        />
                      </label>
                      <Button type="button" variant="secondary" className="h-9 rounded-xl" onClick={() => loadInventory()} disabled={loadingInventory}>
                        {loadingInventory ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">On Hand</p>
                      <p className="text-xl font-black mt-1">{inventory?.summary.totalUnits ?? 0}</p>
                      <p className="text-[11px] text-muted-foreground">units</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Inventory Value</p>
                      <p className="text-xl font-black mt-1">{formatINR(Number(inventory?.summary.totalValue || 0))}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Low Stock</p>
                      <p className="text-xl font-black mt-1 text-amber-800">{inventory?.summary.lowStockCount ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-rose-700 font-semibold">Out of Stock</p>
                      <p className="text-xl font-black mt-1 text-rose-800">{inventory?.summary.outOfStockCount ?? 0}</p>
                    </div>
                  </div>

                  {inventory && (inventory.lowStock.length > 0 || inventory.outOfStock.length > 0) ? (
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {[...inventory.outOfStock, ...inventory.lowStock].map((entry, idx) => (
                        <div key={`${entry.productId}-${entry.sku}-${idx}`} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{entry.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.sku ? entry.sku : "No variant"}{entry.variantLabel ? ` · ${entry.variantLabel}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${entry.stock <= 0 ? "text-rose-600" : "text-amber-600"}`}>
                              {entry.stock <= 0 ? "Out of stock" : `${entry.stock} left`}
                            </p>
                            <p className="text-[11px] text-muted-foreground">reorder at {entry.reorderPoint}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{loadingInventory ? "Loading inventory…" : "All stock levels are healthy."}</p>
                  )}
                </div>

                {/* Stock Management */}
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm font-bold mb-1">Stock Management</p>
                  <p className="text-xs text-muted-foreground mb-3">Manually add, remove, or set stock. Every change is logged below.</p>

                  <form onSubmit={handleAdjustStock} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Product</label>
                      <select
                        title="Product"
                        aria-label="Product"
                        value={adjustForm.productId}
                        onChange={(e) => setAdjustForm((c) => ({ ...c, productId: e.target.value, variantSku: "" }))}
                        className="w-full h-10 rounded-xl border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select…</option>
                        {catalog.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Variant</label>
                      <select
                        title="Variant"
                        aria-label="Variant"
                        value={adjustForm.variantSku}
                        onChange={(e) => setAdjustForm((c) => ({ ...c, variantSku: e.target.value }))}
                        className="w-full h-10 rounded-xl border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                        disabled={!adjustForm.productId}
                      >
                        {(() => {
                          const sel = catalog.find((p) => p.id === adjustForm.productId);
                          const hasVar = Boolean(sel?.variants && sel.variants.length > 0);
                          return (
                            <>
                              <option value="" disabled={hasVar}>
                                {hasVar ? "Select a variant…" : "Whole product"}
                              </option>
                              {(sel?.variants || []).map((v) => (
                                <option key={v.sku} value={v.sku}>{v.sku || [v.size, v.color].filter(Boolean).join(" ")}</option>
                              ))}
                            </>
                          );
                        })()}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Action</label>
                      <select
                        title="Action"
                        aria-label="Action"
                        value={adjustForm.type}
                        onChange={(e) => setAdjustForm((c) => ({ ...c, type: e.target.value as "add" | "remove" | "set" }))}
                        className="w-full h-10 rounded-xl border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="add">Add</option>
                        <option value="remove">Remove</option>
                        <option value="set">Set to</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Qty</label>
                      <Input
                        type="number"
                        value={adjustForm.quantity}
                        onChange={(e) => setAdjustForm((c) => ({ ...c, quantity: e.target.value }))}
                        className="h-10 rounded-xl border-border bg-background text-sm"
                      />
                    </div>
                    <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                      <div className="md:col-span-5">
                        <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Reason (optional)</label>
                        <Input
                          value={adjustForm.reason}
                          onChange={(e) => setAdjustForm((c) => ({ ...c, reason: e.target.value }))}
                          placeholder="e.g. New shipment received, damaged units removed…"
                          className="h-10 rounded-xl border-border bg-background text-sm"
                        />
                      </div>
                      <Button type="submit" disabled={adjusting} className="h-10 rounded-xl">
                        {adjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  </form>
                  {adjustMessage && (
                    <div
                      role="status"
                      aria-live="polite"
                      className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                        adjustMessage.type === "success"
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-red-200 bg-red-50 text-red-800"
                      }`}
                    >
                      {adjustMessage.type === "success" ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      )}
                      <span>{adjustMessage.text}</span>
                    </div>
                  )}

                  {stockHistory.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Recent stock changes</p>
                      <div className="max-h-56 overflow-auto divide-y divide-border rounded-xl border border-border">
                        {stockHistory.slice(0, 20).map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {entry.productName}{entry.variantSku ? ` · ${entry.variantSku}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {entry.type} · {entry.reason || "no reason"} · {entry.performedByEmail}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${entry.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {entry.quantity >= 0 ? "+" : ""}{entry.quantity}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{entry.previousStock} → {entry.newStock}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                          <p className="text-xs text-muted-foreground">or click to browse. Up to 10 images. If cloud upload is unavailable, the backend will handle the images another way.</p>
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
                    <label className="block text-sm font-bold text-gray-700 mb-2">Product Attributes &amp; Variants</label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Select multiple values per attribute (or type your own, e.g. a custom color). Then generate the variant matrix and set stock per combination.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PRODUCT_ATTRIBUTES.map((attr) => (
                        <MultiSelectCreatable
                          key={attr.key}
                          label={attr.label}
                          options={attr.options}
                          value={attrValues[attr.key] || []}
                          onChange={(next) => setAttrValues((current) => ({ ...current, [attr.key]: next }))}
                        />
                      ))}
                    </div>

                    {/* Variant generator */}
                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-muted-foreground">
                        {selectedAxisCount > 1 ? (
                          <span>This will create <span className="font-bold text-foreground">{selectedAxisCount}</span> variant{selectedAxisCount === 1 ? "" : "s"}.</span>
                        ) : (
                          <span>Select attribute values above to build variants.</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 rounded-xl"
                        onClick={generateVariants}
                        disabled={selectedAxisCount <= 1}
                      >
                        Generate {selectedAxisCount} Variant{selectedAxisCount === 1 ? "" : "s"}
                      </Button>
                    </div>

                    {variants.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-border overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                          <p className="text-sm font-semibold">Variants ({variants.length})</p>
                          <p className="text-xs text-muted-foreground">Total stock: <span className="font-bold text-foreground">{totalVariantStock}</span></p>
                        </div>
                        <div className="max-h-[36rem] overflow-auto divide-y divide-border">
                          {variants.map((row) => {
                            const labelParts = [row.size, row.color, row.gender, row.neckType, row.pattern].filter(Boolean);
                            return (
                              <div key={row.key} className="px-4 py-3 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {labelParts.length > 0 ? labelParts.map((part, idx) => (
                                    <span key={idx} className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-xs font-medium">{part}</span>
                                  )) : (
                                    <span className="text-xs text-muted-foreground">Default</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-2">
                                  <div>
                                    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">SKU</label>
                                    <Input
                                      value={row.sku}
                                      onChange={(e) => updateVariantField(row.key, "sku", e.target.value)}
                                      className="h-9 rounded-lg border-border bg-background text-sm font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Price (₹)</label>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={row.price}
                                      onChange={(e) => updateVariantField(row.key, "price", e.target.value)}
                                      className="h-9 rounded-lg border-border bg-background text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Stock</label>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={row.stock}
                                      onChange={(e) => updateVariantField(row.key, "stock", e.target.value)}
                                      className="h-9 rounded-lg border-border bg-background text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openStockEditor(product)} className="gap-1.5 text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg">
                        <Pencil className="h-4 w-4" />
                        Edit stock
                      </Button>
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

            <Dialog open={Boolean(stockEditProduct)} onOpenChange={(open) => { if (!open) closeStockEditor(); }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Update stock</DialogTitle>
                  <DialogDescription>
                    {stockEditProduct?.name ? `Set the available stock for “${stockEditProduct.name}”.` : "Set the available stock for this product."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {Array.isArray(stockEditProduct?.variants) && stockEditProduct.variants.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Variant</label>
                      <select
                        value={stockEditVariantSku}
                        onChange={(e) => handleStockEditVariantChange(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {stockEditProduct.variants.map((v: any) => {
                          const label = [v.size, v.color, v.gender, v.neckType, v.pattern].filter(Boolean).join(" / ") || v.sku;
                          return (
                            <option key={v.sku} value={v.sku}>
                              {label} (current: {Number(v.stock ?? 0)})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">New stock quantity</label>
                    <Input
                      type="number"
                      min={0}
                      value={stockEditValue}
                      onChange={(e) => setStockEditValue(e.target.value)}
                      placeholder="e.g. 25"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">This sets the exact available stock. Every change is recorded in the inventory ledger.</p>
                  </div>

                  {stockEditError && (
                    <p className="text-sm text-red-600">{stockEditError}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={closeStockEditor} disabled={stockEditSaving}>Cancel</Button>
                  <Button onClick={() => void handleStockEditSave()} disabled={stockEditSaving} className="gap-2">
                    {stockEditSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save stock"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Moderation Note</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Optional note visible to admins only..."
            value={moderationNoteInput}
            onChange={(e) => setModerationNoteInput(e.target.value)}
            className="rounded-xl"
            rows={3}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button
              className="rounded-full"
              onClick={() => {
                setNoteDialogOpen(false);
                if (pendingModerationAction) {
                  void submitModerationAction(
                    pendingModerationAction.reviewId,
                    pendingModerationAction.status,
                    moderationNoteInput.trim() || undefined
                  );
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
