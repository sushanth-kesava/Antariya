const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

export type SuperadminRequestType = "admin_approval" | "superadmin_access" | "feature_request";
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
  requestedByRole: "customer" | "admin" | "superadmin";
  targetEmail: string | null;
  targetName: string | null;
  title: string;
  message: string;
  requestedScopes: string[];
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