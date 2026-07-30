import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

// ─── Types ───────────────────────────────────────────────────────────────────

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  parentId: string | null;
  ancestors: { id: string | null; name: string; slug: string }[];
  path: string;
  level: number;
  order: number;
  active: boolean;
  showInNav: boolean;
  productCount: number;
  children?: CategoryNode[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateCategoryPayload = {
  name: string;
  description?: string;
  icon?: string;
  parentId?: string | null;
  order?: number;
  active?: boolean;
  showInNav?: boolean;
};

// ─── Public reads ─────────────────────────────────────────────────────────────

/** Fetch the nested category tree (roots with `children`). */
export async function getCategoryTree(opts?: { navOnly?: boolean; activeOnly?: boolean }): Promise<CategoryNode[]> {
  try {
    const params = new URLSearchParams();
    if (opts?.navOnly) params.set("nav", "1");
    if (opts?.activeOnly) params.set("active", "1");
    const qs = params.toString();
    const response = await fetch(`${API_BASE_URL}/categories${qs ? `?${qs}` : ""}`, {
      credentials: "include",
    });
    const data = await response.json();
    return data.success ? (data.tree || []) : [];
  } catch {
    return [];
  }
}

/** Flat list of all categories (optionally filtered by search term). */
export async function listCategoriesFlat(search?: string): Promise<CategoryNode[]> {
  try {
    const params = new URLSearchParams({ flat: "1" });
    if (search) params.set("search", search);
    const response = await fetch(`${API_BASE_URL}/categories?${params.toString()}`, {
      credentials: "include",
    });
    const data = await response.json();
    return data.success ? (data.categories || []) : [];
  } catch {
    return [];
  }
}

/** Products within a category subtree (self + descendants). */
export async function getCategoryProducts(slug: string) {
  const response = await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(slug)}/products`, {
    credentials: "include",
  });
  const data = await response.json();
  return data.success ? { category: data.category, products: data.products } : { category: null, products: [] };
}

// ─── Admin CRUD ────────────────────────────────────────────────────────────────

export async function createCategoryOnBackend(token: string, payload: CreateCategoryPayload) {
  const response = await fetch(`${API_BASE_URL}/categories`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function updateCategoryOnBackend(token: string, id: string, updates: Partial<CreateCategoryPayload>) {
  const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
  return response.json();
}

export async function deleteCategoryOnBackend(token: string, id: string, cascade = false) {
  const response = await fetch(`${API_BASE_URL}/categories/${id}${cascade ? "?cascade=1" : ""}`, {
    method: "DELETE",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}
