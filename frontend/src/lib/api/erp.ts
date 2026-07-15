import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type ErpPermission = {
  key: string;
  module: string;
  label: string;
  description: string;
};

export type ErpModule = {
  key: string;
  label: string;
  icon: string;
  permissions: { key: string; label: string; description: string }[];
};

export type ErpPermissionCatalog = {
  wildcard: string;
  modules: ErpModule[];
  permissions: ErpPermission[];
};

export type ErpRole = {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  system: boolean;
  locked: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ErpActor = {
  id: string | null;
  email: string | null;
  displayName: string | null;
  role: string | null;
  roleKey: string | null;
  isSuperadmin: boolean;
  permissions: string[];
};

export type ErpAuditEntry = {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  module: string | null;
  permissionUsed: string | null;
  targetType: string | null;
  targetLabel: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  status: "success" | "failure";
  createdAt: string;
};

export type ErpAuditPage = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  entries: ErpAuditEntry[];
};

export type ErpUserAccessUpdate = {
  email: string;
  source: "user" | "admin_profile";
  roleKey: string | null;
  customPermissions: string[];
  deniedPermissions: string[];
  effectivePermissions: string[];
};

export type ErpErrorEntry = {
  id: string;
  message: string;
  name: string;
  statusCode: number;
  stack: string | null;
  method: string | null;
  path: string | null;
  ip: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  count: number;
  lastSeenAt: string;
  createdAt: string;
};

export type ErpErrorPage = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unresolved: number;
  entries: ErpErrorEntry[];
};

export type ErpRateLimitRule = {
  id: string;
  key: string;
  label: string;
  description: string;
  windowMs: number;
  max: number;
  enabled: boolean;
  scope: string;
  system: boolean;
  updatedAt?: string;
};

export type ErpRateLimitActivity = Record<
  string,
  { blocked: number; allowed: number; lastBlockedAt: string | null }
>;

function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || fallback);
  }
  return data as T;
}

export async function getPermissionCatalog(token: string): Promise<ErpPermissionCatalog> {
  const response = await fetch(`${API_BASE_URL}/erp/permissions`, { credentials: "include", headers: authHeaders(token) });
  const data = await parse<{ wildcard: string; modules: ErpModule[]; permissions: ErpPermission[] }>(
    response,
    "Failed to load permission catalog"
  );
  return { wildcard: data.wildcard, modules: data.modules, permissions: data.permissions };
}

export async function getMyAccess(token: string): Promise<ErpActor> {
  const response = await fetch(`${API_BASE_URL}/erp/me`, { credentials: "include", headers: authHeaders(token) });
  const data = await parse<{ actor: ErpActor }>(response, "Failed to load your access profile");
  return data.actor;
}

export async function listRoles(token: string): Promise<ErpRole[]> {
  const response = await fetch(`${API_BASE_URL}/erp/roles`, { credentials: "include", headers: authHeaders(token) });
  const data = await parse<{ roles: ErpRole[] }>(response, "Failed to load roles");
  return data.roles;
}

export async function createRole(
  token: string,
  payload: { key: string; name: string; description?: string; permissions?: string[] }
): Promise<ErpRole> {
  const response = await fetch(`${API_BASE_URL}/erp/roles`, {
    credentials: "include",
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parse<{ role: ErpRole }>(response, "Failed to create role");
  return data.role;
}

export async function updateRole(
  token: string,
  roleId: string,
  payload: { name?: string; description?: string; permissions?: string[] }
): Promise<ErpRole> {
  const response = await fetch(`${API_BASE_URL}/erp/roles/${roleId}`, {
    credentials: "include",
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parse<{ role: ErpRole }>(response, "Failed to update role");
  return data.role;
}

export async function deleteRole(token: string, roleId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/erp/roles/${roleId}`, {
    credentials: "include",
    method: "DELETE",
    headers: authHeaders(token),
  });
  await parse<{ success: boolean }>(response, "Failed to delete role");
}

export async function updateUserPermissions(
  token: string,
  payload: {
    email: string;
    roleKey?: string;
    customPermissions?: string[];
    deniedPermissions?: string[];
  }
): Promise<ErpUserAccessUpdate> {
  const response = await fetch(`${API_BASE_URL}/erp/users/permissions`, {
    credentials: "include",
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parse<{ account: ErpUserAccessUpdate }>(response, "Failed to update user permissions");
  return data.account;
}

export async function listAuditLog(
  token: string,
  params: { page?: number; limit?: number; module?: string; action?: string; actorEmail?: string } = {}
): Promise<ErpAuditPage> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.module) query.set("module", params.module);
  if (params.action) query.set("action", params.action);
  if (params.actorEmail) query.set("actorEmail", params.actorEmail);

  const qs = query.toString();
  const response = await fetch(`${API_BASE_URL}/erp/audit${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: authHeaders(token),
  });
  return parse<ErpAuditPage>(response, "Failed to load audit log");
}


export async function listErrorLogs(
  token: string,
  params: { page?: number; limit?: number; resolved?: boolean; statusCode?: number; path?: string } = {}
): Promise<ErpErrorPage> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.resolved !== undefined) query.set("resolved", String(params.resolved));
  if (params.statusCode) query.set("statusCode", String(params.statusCode));
  if (params.path) query.set("path", params.path);
  const qs = query.toString();
  const response = await fetch(`${API_BASE_URL}/erp/errors${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: authHeaders(token),
  });
  return parse<ErpErrorPage>(response, "Failed to load error logs");
}

export async function updateErrorLog(token: string, errorId: string, resolved: boolean): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/erp/errors/${errorId}`, {
    credentials: "include",
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify({ resolved }),
  });
  await parse<{ success: boolean }>(response, "Failed to update error entry");
}

export async function purgeErrorLogs(token: string, scope: "resolved" | "all" = "resolved"): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/erp/errors?scope=${scope}`, {
    credentials: "include",
    method: "DELETE",
    headers: authHeaders(token),
  });
  const data = await parse<{ deleted: number }>(response, "Failed to purge error logs");
  return data.deleted;
}

export async function listRateLimits(
  token: string
): Promise<{ rules: ErpRateLimitRule[]; activity: ErpRateLimitActivity }> {
  const response = await fetch(`${API_BASE_URL}/erp/rate-limits`, { credentials: "include", headers: authHeaders(token) });
  const data = await parse<{ rules: ErpRateLimitRule[]; activity: ErpRateLimitActivity }>(
    response,
    "Failed to load rate limits"
  );
  return { rules: data.rules, activity: data.activity };
}

export async function updateRateLimit(
  token: string,
  ruleId: string,
  payload: { windowMs?: number; max?: number; enabled?: boolean }
): Promise<ErpRateLimitRule> {
  const response = await fetch(`${API_BASE_URL}/erp/rate-limits/${ruleId}`, {
    credentials: "include",
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parse<{ rule: ErpRateLimitRule }>(response, "Failed to update rate limit");
  return data.rule;
}


/* ── Orders: refunds ── */
export async function refundOrderOnErp(
  token: string,
  orderId: string,
  payload: { amount?: number; reason?: string } = {}
): Promise<{ refund: { id: string; status: string; amount: number } | null }> {
  const response = await fetch(`${API_BASE_URL}/erp/orders/${orderId}/refund`, {
    credentials: "include",
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  return parse<{ refund: { id: string; status: string; amount: number } | null }>(
    response,
    "Failed to process refund"
  );
}

/* ── Catalog: product edit / publish ── */
export type ErpProductRow = {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  stock: number;
  published: boolean;
  createdAt: string;
};

export type ErpProductPage = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  products: ErpProductRow[];
};

export async function listErpProducts(
  token: string,
  params: { page?: number; limit?: number; search?: string } = {}
): Promise<ErpProductPage> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  const qs = query.toString();
  const response = await fetch(`${API_BASE_URL}/erp/products${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: authHeaders(token),
  });
  return parse<ErpProductPage>(response, "Failed to load products");
}

export async function updateErpProduct(
  token: string,
  productId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/erp/products/${productId}`, {
    credentials: "include",
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  await parse<{ success: boolean }>(response, "Failed to update product");
}

export async function setErpProductPublished(
  token: string,
  productId: string,
  published: boolean
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/erp/products/${productId}/publish`, {
    credentials: "include",
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify({ published }),
  });
  await parse<{ success: boolean }>(response, "Failed to change publish state");
}

/* ── Inventory: warehouses & transfers ── */
export type ErpWarehouse = {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  pincode: string;
  priority: number;
  active: boolean;
};

export async function listErpWarehouses(token: string): Promise<ErpWarehouse[]> {
  const response = await fetch(`${API_BASE_URL}/erp/warehouses`, { credentials: "include", headers: authHeaders(token) });
  const data = await parse<{ warehouses: ErpWarehouse[] }>(response, "Failed to load warehouses");
  return data.warehouses;
}

export async function createErpWarehouse(
  token: string,
  payload: { code: string; name: string; city?: string; state?: string; pincode?: string; priority?: number }
): Promise<{ id: string; code: string; name: string }> {
  const response = await fetch(`${API_BASE_URL}/erp/warehouses`, {
    credentials: "include",
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parse<{ warehouse: { id: string; code: string; name: string } }>(
    response,
    "Failed to create warehouse"
  );
  return data.warehouse;
}

export async function transferErpStock(
  token: string,
  payload: {
    productId: string;
    variantSku?: string;
    fromWarehouse: string;
    toWarehouse: string;
    quantity: number;
    reason?: string;
  }
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/erp/inventory/transfer`, {
    credentials: "include",
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  await parse<{ success: boolean }>(response, "Failed to transfer stock");
}


/* ────────────────────────── Communications / Email ────────────────────────── */

export type ErpEmailTemplate = {
  id: string;
  key: string;
  name: string;
  subject: string;
  html: string;
  description: string;
  placeholders: string[];
  system: boolean;
  updatedAt?: string;
};

export type ErpEmailCampaign = {
  id: string;
  name: string;
  subject: string;
  audience: string;
  recipientCount: number;
  status: string;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ErpAudienceCounts = {
  audiences: { all_customers: number; newsletter: number; waitlist: number; admins: number };
  mailConfigured: boolean;
};

export type ErpSubscriber = {
  id: string;
  email: string;
  name: string;
  source: string;
  status: string;
  createdAt: string;
};

export type ErpSubscriberPage = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  subscribed: number;
  subscribers: ErpSubscriber[];
};

export type ErpEmailLogEntry = {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: "sent" | "failed" | "skipped";
  attempts: number;
  error: string | null;
  createdAt: string;
};

export type ErpEmailLogPage = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  failed: number;
  logs: ErpEmailLogEntry[];
};

/* Templates */
export async function listEmailTemplates(token: string): Promise<ErpEmailTemplate[]> {
  const r = await fetch(`${API_BASE_URL}/erp/comms/templates`, { credentials: "include", headers: authHeaders(token) });
  const d = await parse<{ templates: ErpEmailTemplate[] }>(r, "Failed to load templates");
  return d.templates;
}

export async function createEmailTemplate(
  token: string,
  payload: { name: string; subject: string; html: string; description?: string; key?: string }
): Promise<ErpEmailTemplate> {
  const r = await fetch(`${API_BASE_URL}/erp/comms/templates`, {
    credentials: "include",
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const d = await parse<{ template: ErpEmailTemplate }>(r, "Failed to create template");
  return d.template;
}

export async function updateEmailTemplate(
  token: string,
  templateId: string,
  payload: Partial<{ name: string; subject: string; html: string; description: string }>
): Promise<ErpEmailTemplate> {
  const r = await fetch(`${API_BASE_URL}/erp/comms/templates/${templateId}`, {
    credentials: "include",
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const d = await parse<{ template: ErpEmailTemplate }>(r, "Failed to update template");
  return d.template;
}

export async function deleteEmailTemplate(token: string, templateId: string): Promise<void> {
  const r = await fetch(`${API_BASE_URL}/erp/comms/templates/${templateId}`, {
    credentials: "include",
    method: "DELETE",
    headers: authHeaders(token),
  });
  await parse<{ success: boolean }>(r, "Failed to delete template");
}

/* Campaigns */
export async function getAudienceCounts(token: string): Promise<ErpAudienceCounts> {
  const r = await fetch(`${API_BASE_URL}/erp/comms/audiences`, { credentials: "include", headers: authHeaders(token) });
  return parse<ErpAudienceCounts>(r, "Failed to load audiences");
}

export async function listEmailCampaigns(token: string): Promise<ErpEmailCampaign[]> {
  const r = await fetch(`${API_BASE_URL}/erp/comms/campaigns`, { credentials: "include", headers: authHeaders(token) });
  const d = await parse<{ campaigns: ErpEmailCampaign[] }>(r, "Failed to load campaigns");
  return d.campaigns;
}

export async function sendEmailCampaign(
  token: string,
  payload: { name: string; subject: string; html: string; audience: string; customList?: string[] }
): Promise<ErpEmailCampaign> {
  const r = await fetch(`${API_BASE_URL}/erp/comms/campaigns`, {
    credentials: "include",
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const d = await parse<{ campaign: ErpEmailCampaign }>(r, "Failed to send campaign");
  return d.campaign;
}

/* Subscribers */
export async function listSubscribers(
  token: string,
  params: { page?: number; limit?: number; status?: string; search?: string } = {}
): Promise<ErpSubscriberPage> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  const r = await fetch(`${API_BASE_URL}/erp/comms/subscribers${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: authHeaders(token),
  });
  return parse<ErpSubscriberPage>(r, "Failed to load subscribers");
}

export async function removeSubscriber(token: string, subscriberId: string): Promise<void> {
  const r = await fetch(`${API_BASE_URL}/erp/comms/subscribers/${subscriberId}`, {
    credentials: "include",
    method: "DELETE",
    headers: authHeaders(token),
  });
  await parse<{ success: boolean }>(r, "Failed to remove subscriber");
}

/* Email logs */
export async function listEmailLogs(
  token: string,
  params: { page?: number; limit?: number; status?: string; type?: string; to?: string } = {}
): Promise<ErpEmailLogPage> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.status) q.set("status", params.status);
  if (params.type) q.set("type", params.type);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  const r = await fetch(`${API_BASE_URL}/erp/comms/logs${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: authHeaders(token),
  });
  return parse<ErpEmailLogPage>(r, "Failed to load email logs");
}
