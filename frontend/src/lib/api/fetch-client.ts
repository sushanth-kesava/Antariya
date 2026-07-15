import { getApiBaseUrl } from "@/lib/api/base-url";
import { getAuthToken } from "@/lib/auth-session";

/**
 * Centralized fetch client for all Antariya API calls.
 *
 * Why this exists:
 * - The frontend (Hostinger) and backend (Render) are on DIFFERENT origins.
 * - We MUST send `credentials: "include"` on every request so the HttpOnly
 *   auth cookie is sent cross-origin.
 * - We also attach the [REDACTED_TOKEN] header as a fallback for backward compat.
 * - Centralizes error handling and base URL resolution.
 */

export type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    if (data && typeof data === "object" && "code" in data) {
      this.code = (data as { code?: string }).code;
    }
  }
}

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Override the auth token (e.g. for admin-only calls) */
  token?: string | null;
  /** Skip auth header entirely */
  noAuth?: boolean;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
};

/**
 * Make an authenticated API call.
 *
 * Usage:
 *   const data = await apiFetch<OrderResponse>("/orders/my");
 *   const result = await apiFetch("/orders", { method: "POST", body: { items } });
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    token,
    noAuth = false,
    timeout = 30000,
  } = options;

  const baseUrl = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  // Build headers
  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  // Add Content-Type for JSON bodies
  if (body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  // Add auth token (from param or localStorage fallback)
  if (!noAuth) {
    const authToken = token ?? getAuthToken();
    if (authToken) {
      requestHeaders["Authorization"] = `Bearer ${authToken}`;
    }
  }

  // Setup abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include", // CRITICAL: sends HttpOnly cookies cross-origin
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.", 408);
    }

    throw new ApiError(
      `Unable to reach the server. Please check your connection.`,
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // Parse response
  let data: T | null = null;

  try {
    const text = await response.text();
    if (text) {
      data = JSON.parse(text) as T;
    }
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? (data as { message?: string }).message
        : null) || `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

/**
 * Convenience wrappers
 */
export const api = {
  get: <T = unknown>(path: string, opts?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "GET" }),

  post: <T = unknown>(path: string, body?: unknown, opts?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "POST", body }),

  put: <T = unknown>(path: string, body?: unknown, opts?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "PUT", body }),

  patch: <T = unknown>(path: string, body?: unknown, opts?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "PATCH", body }),

  delete: <T = unknown>(path: string, opts?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "DELETE" }),
};
