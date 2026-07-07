import { getApiBaseUrl } from "./base-url";

const API_BASE_URL = getApiBaseUrl();

export type CustomerAddress = {
  _id: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
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
