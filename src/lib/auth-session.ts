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

  if (normalizedRole === "admin" || normalizedRole === "superadmin") {
    return normalizedRole;
  }

  return "customer";
}

export function getPortalPathForRole(role: string | null | undefined): string {
  const normalizedRole = normalizeAppRole(role);

  if (normalizedRole === "superadmin") {
    return "/portal/superadmin";
  }

  if (normalizedRole === "admin") {
    return "/portal/admin";
  }

  return "/portal/customer";
}

export function persistAuthSession(token: string, user: AuthSessionUser) {
  localStorage.setItem("app_auth_token", token);
  localStorage.setItem("google_auth_user", JSON.stringify(user));
  localStorage.setItem("user_role", normalizeAppRole(user.role));
}

export function clearAuthSession() {
  localStorage.removeItem("app_auth_token");
  localStorage.removeItem("google_auth_user");
  localStorage.removeItem("user_role");
}
