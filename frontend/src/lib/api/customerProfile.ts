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
  createdAt: string;
  updatedAt: string;
};

export async function getCustomerProfileFromBackend(token: string): Promise<CustomerProfileData> {
  const res = await fetch(`${API_BASE_URL}/customer/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || "Failed to load profile");
  return data.profile as CustomerProfileData;
}

export async function updateCustomerProfileOnBackend(
  token: string,
  updates: Partial<Pick<CustomerProfileData, "displayName" | "phone" | "gender" | "dateOfBirth" | "preferences">>
): Promise<CustomerProfileData> {
  const res = await fetch(`${API_BASE_URL}/customer/profile`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || "Failed to update profile");
  return data.profile as CustomerProfileData;
}

export async function addAddressOnBackend(
  token: string,
  address: Omit<CustomerAddress, "_id">
): Promise<CustomerAddress[]> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/address`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(address),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || "Failed to add address");
  return data.addresses as CustomerAddress[];
}

export async function removeAddressOnBackend(token: string, addressId: string): Promise<CustomerAddress[]> {
  const res = await fetch(`${API_BASE_URL}/customer/profile/address/${addressId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || "Failed to remove address");
  return data.addresses as CustomerAddress[];
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
