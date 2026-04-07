import type { AppRole } from "@/lib/auth-session";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

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
