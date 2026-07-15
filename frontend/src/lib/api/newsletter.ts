import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export async function subscribeToNewsletter(
  email: string,
  name?: string,
  source = "footer"
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/newsletter/subscribe`, {
    credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, source }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to subscribe");
  }
  return { message: data.message || "Subscribed!" };
}
