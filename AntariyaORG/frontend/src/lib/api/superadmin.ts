import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type SuperadminRequestType = "admin_approval" | "feature_request" | "superadmin_access";
export type SuperadminRequestStatus = "pending" | "approved" | "rejected";

export type SuperAdminDashboardSummary = {
  totalCustomers: number;
  totalAdmins: number;
  totalSuperAdmins: number;
  totalOrders: number;
  totalRevenue: number;
  pendingRequests: number;
  lowStockProducts: number;
  pendingReviews: number;
  wishlistItems: number;
};

export type SuperAdminProfile = {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: "admin" | "superadmin";
  active: boolean;
  loginCount: number;
  lastAdminLoginAt: string | null;
  createdAt: string;
};

export type SuperAdminCustomerProfile = {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: "customer";
  createdAt: string;
  updatedAt: string;
};

export type SuperAdminAccessRequest = {
  id: string;
  requestType: SuperadminRequestType;
  status: SuperadminRequestStatus;
  requestedById: string;
  requestedByEmail: string;
  requestedByRole: "public" | "customer" | "admin" | "superadmin";
  targetEmail: string | null;
  targetName: string | null;
  title: string;
  message: string;
  requestedScopes: string[];
  applicationDetails: {
    fullName: string | null;
    email: string | null;
    phoneNumber: string | null;
    businessName: string | null;
    businessType: string | null;
    businessAddress: string | null;
    website: string | null;
    panNumber: string | null;
    aadharNumber: string | null;
    gstNumber: string | null;
    notes: string | null;
  } | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SuperAdminDashboardPayload = {
  summary: SuperAdminDashboardSummary;
  adminProfiles: SuperAdminProfile[];
  customerProfiles: SuperAdminCustomerProfile[];
  accessRequests: SuperAdminAccessRequest[];
  portalClassificationAudit: PortalClassificationAudit;
};

export type PortalClassificationAuditAccount = {
  email: string;
  source: "user" | "admin_profile";
  currentRole: "customer" | "admin" | "superadmin";
  registeredPortal: "customer" | "admin" | "superadmin";
  active: boolean;
  mismatch: boolean;
  reason: string;
};

export type PortalClassificationAudit = {
  totalAccounts: number;
  mismatches: number;
  accounts: PortalClassificationAuditAccount[];
};

export type ManagedRole = "customer" | "admin";

export type SuperAdminManagedAccount = {
  email: string;
  role: ManagedRole;
  source: "user" | "admin_profile";
  active: boolean;
};

export async function getSuperAdminDashboardFromBackend(token: string): Promise<SuperAdminDashboardPayload> {
  const response = await fetch(`${API_BASE_URL}/superadmin/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load superadmin dashboard");
  }

  return {
    summary: data.summary as SuperAdminDashboardSummary,
    adminProfiles: (data.adminProfiles || []) as SuperAdminProfile[],
    customerProfiles: (data.customerProfiles || []) as SuperAdminCustomerProfile[],
    accessRequests: (data.accessRequests || []) as SuperAdminAccessRequest[],
    portalClassificationAudit: (data.portalClassificationAudit || {
      totalAccounts: 0,
      mismatches: 0,
      accounts: [],
    }) as PortalClassificationAudit,
  };
}

export async function createAccessRequestOnBackend(
  token: string,
  payload: {
    requestType: SuperadminRequestType;
    title: string;
    message: string;
    targetEmail?: string;
    targetName?: string;
    requestedScopes?: string[];
    applicationDetails?: SuperAdminAccessRequest["applicationDetails"];
  }
): Promise<SuperAdminAccessRequest> {
  const response = await fetch(`${API_BASE_URL}/superadmin/access-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to submit access request");
  }

  return data.request as SuperAdminAccessRequest;
}

export async function submitAdminApplicationOnBackend(payload: {
  fullName: string;
  email: string;
  phoneNumber: string;
  businessName: string;
  businessType: string;
  businessAddress: string;
  website?: string;
  panNumber: string;
  aadharNumber: string;
  gstNumber?: string;
  notes?: string;
}): Promise<SuperAdminAccessRequest> {
  const response = await fetch(`${API_BASE_URL}/superadmin/admin-applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to submit admin application");
  }

  return data.request as SuperAdminAccessRequest;
}

export async function reviewAccessRequestOnBackend(
  token: string,
  requestId: string,
  status: "approved" | "rejected",
  reviewNote?: string
): Promise<SuperAdminAccessRequest> {
  const response = await fetch(`${API_BASE_URL}/superadmin/access-requests/${requestId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status, reviewNote }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to review access request");
  }

  return data.request as SuperAdminAccessRequest;
}

export async function updateUserRoleOnBackend(
  token: string,
  payload: {
    email: string;
    role: ManagedRole;
  }
): Promise<SuperAdminManagedAccount> {
  const response = await fetch(`${API_BASE_URL}/superadmin/users/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to update user role");
  }

  return data.account as SuperAdminManagedAccount;
}