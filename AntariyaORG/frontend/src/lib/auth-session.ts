export type AppRole = "customer" | "admin" | "superadmin";

export type AuthSessionUser = {
  id: string | null;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: AppRole;
};

export function normalizeAppRole(role: string | null | undefined): AppRole {
  const normalizedRole = String(role || "customer").trim().toLowerCase();

  // Unify admin and superadmin roles to `superadmin` in the frontend UI.
  // This makes the UI show a single elevated portal for both admin and superadmin.
  if (normalizedRole === "superadmin" || normalizedRole === "admin") {
    return "superadmin" as AppRole;
  }

  return "customer";
}

export function getPortalPathForRole(role: string | null | undefined): string {
  const normalizedRole = normalizeAppRole(role);

  if (normalizedRole === "superadmin") {
    return "/portal/superadmin";
  }

  return "/portal/customer";
}

export function persistAuthSession(token: string, user: AuthSessionUser) {
  const normalizedRole = normalizeAppRole(user.role);
  localStorage.setItem("app_auth_token", token);
  localStorage.setItem("google_auth_user", JSON.stringify(user));
  localStorage.setItem("user_role", normalizedRole);

  if (typeof document !== "undefined") {
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    const secureFlag = isHttps ? "; Secure" : "";
    document.cookie = `app_auth_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secureFlag}`;
    document.cookie = `user_role=${encodeURIComponent(normalizedRole)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secureFlag}`;
  }
}

export function clearAuthSession() {
  localStorage.removeItem("app_auth_token");
  localStorage.removeItem("google_auth_user");
  localStorage.removeItem("user_role");

  if (typeof document !== "undefined") {
    document.cookie = "app_auth_token=; Path=/; Max-Age=0; SameSite=Lax";
    document.cookie = "user_role=; Path=/; Max-Age=0; SameSite=Lax";
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("app_auth_token");
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}
