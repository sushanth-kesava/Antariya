"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
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
  // Track whether setUser was called externally (e.g. by login page's finishAuth).
  // If so, skip the /auth/me re-validation to avoid race conditions.
  const freshLoginRef = useRef(false);

  const handleSetUser = (newUser: AuthSessionUser | null) => {
    if (newUser) {
      freshLoginRef.current = true;
    }
    setUser(newUser);
    // If user is being set externally, we're no longer loading
    if (newUser) {
      setLoading(false);
    }
  };

  async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delay = 2000): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, options);
        if (res.ok || i === retries) return res;
      } catch (err) {
        if (i === retries) throw err;
      }
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error("fetchWithRetry exhausted");
  }

  useEffect(() => {
    // If the login page already authenticated and set the user, skip re-validation
    if (freshLoginRef.current) {
      freshLoginRef.current = false;
      return;
    }

    const token = localStorage.getItem("app_auth_token");
    if (!token) {
      clearAuthSession();
      setLoading(false);
      return;
    }

    fetchWithRetry(`${getApiBaseUrl()}/auth/me`, { credentials: "include", headers: { Authorization: `Bearer ${token}` } })
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

  return <AuthContext.Provider value={{ user, loading, setUser: handleSetUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
