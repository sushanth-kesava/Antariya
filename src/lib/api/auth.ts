export type AppRole = "customer" | "admin" | "superadmin";

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
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Authentication failed");
  }

  return data as AuthResponse;
}
