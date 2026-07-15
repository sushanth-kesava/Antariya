import { getApiBaseUrl } from "./base-url";

const API_BASE_URL = getApiBaseUrl();

export type CustomerAddress = {
  _id: string;
  label: string;
  addressType?: "Home" | "Office" | "Other";
  line1: string;
  line2: string;
  landmark?: string;
  city: string;
  state: string;
  country?: string;
  pincode: string;
  alternatePhone?: string;
  deliveryInstructions?: string;
  isDefault: boolean;
};

export type CustomerProfileData = {
  _id: string;
  userId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  dateOfBirth: string | null;
  addresses: CustomerAddress[];
  preferences: {
    categories: string[];
    newsletter: boolean;
    smsAlerts: boolean;
    whatsappOptIn?: boolean;
  };
  membershipTier: "new" | "silver" | "gold" | "platinum";
  totalOrders: number;
  totalSpend: number;
  lastOrderAt: string | null;
  profileComplete: boolean;
  lastProfileEditAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getCustomerProfileFromBackend(token: string): Promise<CustomerProfileData> {
  const res = await fetch(`${API_BASE_URL}/customer/profile`, {
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || "Failed to load profile");
  return data.profile as CustomerProfileData;
}

export type UpdateProfileResult =
  | { success: true; profile: CustomerProfileData }
  | { success: false; message: string; code?: string; daysRemaining?: number };

export async function updateCustomerProfileOnBackend(
  token: string,
  updates: Partial<Pick<CustomerProfileData, "displayName" | "gender" | "dateOfBirth" | "preferences">>
): Promise<UpdateProfileResult> {
  const res = await fetch(`${API_BASE_URL}/customer/profile`, {
    credentials: "include",
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, message: data.message || "Failed to update profile", code: data.code, daysRemaining: data.daysRemaining };
  }
  return { success: true, profile: data.profile as CustomerProfileData };
}

export type AddressInput = {
  addressType: "Home" | "Office" | "Other";
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  country?: string;
  pincode: string;
  alternatePhone?: string;
  deliveryInstructions?: string;
  isDefault?: boolean;
};

export type AddressResult =
  | { success: true; addresses: CustomerAddress[] }
  | { success: false; message: string; code?: string };

export async function addAddressOnBackend(token: string, address: AddressInput): Promise<AddressResult> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/address`, {
    credentials: "include",
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(address),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, message: data.message || "Failed to add address", code: data.code };
  }
  return { success: true, addresses: data.addresses as CustomerAddress[] };
}

export async function updateAddressOnBackend(token: string, addressId: string, address: AddressInput): Promise<AddressResult> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/address/${addressId}`, {
    credentials: "include",
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(address),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, message: data.message || "Failed to update address", code: data.code };
  }
  return { success: true, addresses: data.addresses as CustomerAddress[] };
}

export async function setDefaultAddressOnBackend(token: string, addressId: string): Promise<AddressResult> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/address/${addressId}/default`, {
    credentials: "include",
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, message: data.message || "Failed to set default address" };
  }
  return { success: true, addresses: data.addresses as CustomerAddress[] };
}

export async function removeAddressOnBackend(token: string, addressId: string): Promise<AddressResult> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/address/${addressId}`, {
    credentials: "include",
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, message: data.message || "Failed to remove address" };
  }
  return { success: true, addresses: data.addresses as CustomerAddress[] };
}


export type CompleteProfilePayload = {
  fullName: string;
  email?: string;
  phone: string;
  dateOfBirth?: string | null;
  gender?: "male" | "female" | "other" | null;
  address: {
    line1: string;
    line2?: string;
    landmark?: string;
    country: string;
    state: string;
    city: string;
    pincode: string;
  };
  useSamePhone: boolean;
  alternatePhone?: string;
  addressType: "Home" | "Office" | "Other";
  deliveryInstructions?: string;
  whatsappOptIn: boolean;
  promotionalEmails: boolean;
};

export type CompleteProfileResult =
  | { success: true; profile: CustomerProfileData }
  | { success: false; message: string; errors?: Record<string, string> };

export async function completeProfileOnBackend(
  token: string,
  payload: CompleteProfilePayload
): Promise<CompleteProfileResult> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/complete`, {
    credentials: "include",
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, message: data.message || "Failed to complete profile", errors: data.errors };
  }
  return { success: true, profile: data.profile as CustomerProfileData };
}


export type AdminBusinessDetails = {
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  businessAddress?: string | null;
  website?: string | null;
  panNumber?: string | null;
  aadharNumber?: string | null;
  gstNumber?: string | null;
  notes?: string | null;
  status?: string;
  submittedAt?: string;
  reviewedAt?: string | null;
};

export async function getBusinessDetailsFromBackend(token: string): Promise<AdminBusinessDetails | null> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/business`, {
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) return null;
  return (data.business as AdminBusinessDetails) || null;
}


export async function updateBusinessDetailsOnBackend(
  token: string,
  updates: Partial<Pick<AdminBusinessDetails,
    "businessName" | "businessType" | "businessAddress" | "website" | "panNumber" | "aadharNumber" | "gstNumber" | "notes">>
): Promise<{ success: boolean; message?: string; business?: AdminBusinessDetails }> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/business`, {
    credentials: "include",
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, message: data.message || "Failed to update business details" };
  }
  return { success: true, message: data.message, business: data.business as AdminBusinessDetails };
}
