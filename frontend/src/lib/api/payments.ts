import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type CreateRazorpayOrderInput = {
  amount: number;
  currency?: string;
  receipt?: string;
};

export type CreateRazorpayOrderResponse = {
  order_id: string;
  amount: number;
  currency: string;
};

export type VerifyPaymentPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export async function createRazorpayOrderOnBackend(
  token: string,
  payload: CreateRazorpayOrderInput
): Promise<CreateRazorpayOrderResponse> {
  const response = await fetch(`${API_BASE_URL}/create-order`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to create Razorpay order");
  }

  return {
    order_id: String(data.order_id),
    amount: Number(data.amount || 0),
    currency: String(data.currency || "INR"),
  };
}

export async function verifyRazorpayPaymentOnBackend(token: string, payload: VerifyPaymentPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/verify-payment`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Payment verification failed");
  }
}
