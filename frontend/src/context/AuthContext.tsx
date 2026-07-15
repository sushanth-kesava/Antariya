"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { clearAuthSession, normalizeAppRole, persistAuthSession, type AuthSessionUser } from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api/base-url";

type AuthContextValue = {
  user: AuthSessionUser | null;
  loading: boolean;
  setUser: (user: AuthSessionUser | null) => void;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, setUser: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("app_auth_token");
    if (!token) {
      clearAuthSession();
      setLoading(false);
      return;
    }

    fetch(`${getApiBaseUrl()}/auth/me`, { credentials: "include", headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data?.user) {
          const normalized: AuthSessionUser = {
            id: data.user.id,
            email: data.user.email,
            displayName: data.user.displayName,
            photoURL: data.user.photoURL || null,
            role: normalizeAppRole(data.user.role),
          };
          const sessionToken = typeof data.token === "string" && data.token.trim() ? data.token : token;
          persistAuthSession(sessionToken, normalized);
          setUser(normalized);
        } else {
          clearAuthSession();
        }
      })
      .catch(() => clearAuthSession())
      .finally(() => setLoading(false));
  }, []);

  return <AuthContext.Provider value={{ user, loading, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
