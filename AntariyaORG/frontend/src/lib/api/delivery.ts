import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type DeliveryAvailability = {
  success: boolean;
  available?: boolean;
  message: string;
  pincode?: string;
  district?: string;
  state?: string;
  codSupported?: boolean;
  prepaidSupported?: boolean;
  eta?: string;
  shipping?: string;
  estimatedDispatchDate?: string;
  lastMilePartner?: string;
  returnEligible?: boolean;
};

export async function checkDeliveryByPincode(pincode: string): Promise<DeliveryAvailability> {
  const response = await fetch(`${API_BASE_URL}/delivery/check?pincode=${encodeURIComponent(pincode)}`);
  const data = (await response.json()) as DeliveryAvailability;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to check delivery availability");
  }

  return data;
}
