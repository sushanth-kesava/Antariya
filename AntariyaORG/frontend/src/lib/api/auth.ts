import type { AppRole } from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api/base-url";

type GoogleAuthPayload = {
  googleAccessToken: string;
  role?: AppRole;
  tokenType?: string;
  scope?: string;
  expiresIn?: number;
};

type AuthResponse = {
  success: boolean;
  message: string;
  token?: string;
  pendingApproval?: boolean;
  request?: {
    id: string;
    status: string;
  };
  user?: {
    id: string | null;
    email: string;
    displayName: string;
    photoURL: string | null;
    role: AppRole;
  };
};

type CredentialsSignupPayload = {
  email: string;
  password: string;
  displayName?: string;
  role?: AppRole;
};

type CredentialsLoginPayload = {
  email: string;
  password: string;
  role?: AppRole;
};

const API_BASE_URL = getApiBaseUrl();

export async function loginWithGoogleOnBackend(payload: GoogleAuthPayload): Promise<AuthResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const networkError = error instanceof Error ? error.message : "Network request failed";
    throw new Error(
      `Unable to reach authentication server (${API_BASE_URL}). Please verify backend is running and reachable. ${networkError}`
    );
  }

  let data: AuthResponse | null = null;
  try {
    data = (await response.json()) as AuthResponse;
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `Authentication failed with status ${response.status}.`);
  }

  return data;
}

async function postAuthRequest(path: string, payload: Record<string, unknown>): Promise<AuthResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const networkError = error instanceof Error ? error.message : "Network request failed";
    throw new Error(
      `Unable to reach authentication server (${API_BASE_URL}). Please verify backend is running and reachable. ${networkError}`
    );
  }

  let data: AuthResponse | null = null;
  try {
    data = (await response.json()) as AuthResponse;
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `Authentication failed with status ${response.status}.`);
  }

  return data;
}

export async function signupWithCredentialsOnBackend(payload: CredentialsSignupPayload): Promise<AuthResponse> {
  return postAuthRequest("/auth/signup", payload as Record<string, unknown>);
}

export async function loginWithCredentialsOnBackend(payload: CredentialsLoginPayload): Promise<AuthResponse> {
  return postAuthRequest("/auth/login", payload as Record<string, unknown>);
}
