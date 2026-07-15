"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api/base-url";
import {
  clearAuthSession,
  getPortalPathForRole,
  normalizeAppRole,
  persistAuthSession,
} from "@/lib/auth-session";
import { getMyAccess, ErpActor } from "@/lib/api/erp";
import { ErpShell } from "./ErpShell";

const API_BASE_URL = getApiBaseUrl();

export default function SuperAdminPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState("");
  const [user, setUser] = useState<{
    id: string | null;
    email: string;
    displayName: string;
    photoURL: string | null;
    role: string;
  } | null>(null);
  const [actor, setActor] = useState<ErpActor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const token = localStorage.getItem("app_auth_token");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok || !data?.success || !data?.user) {
          router.replace("/login");
          return;
        }

        const normalizedUser = {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
          photoURL: data.user.photoURL || null,
          role: normalizeAppRole(data.user.role),
        };

        const sessionToken =
          typeof data.token === "string" && data.token.trim().length > 0 ? data.token : token;

        persistAuthSession(sessionToken, normalizedUser);

        if (normalizedUser.role !== "superadmin") {
          if (normalizedUser.role) {
            router.replace(getPortalPathForRole(normalizedUser.role));
          } else {
            router.replace("/login");
          }
          return;
        }

        setAuthToken(sessionToken);
        setUser(normalizedUser);

        try {
          const access = await getMyAccess(sessionToken);
          setActor(access);
        } catch {
          // Fallback: superadmin implicitly has the wildcard.
          setActor({
            id: normalizedUser.id,
            email: normalizedUser.email,
            displayName: normalizedUser.displayName,
            role: "superadmin",
            roleKey: "superadmin",
            isSuperadmin: true,
            permissions: ["*"],
          });
        }
      } catch (sessionError) {
        clearAuthSession();
        setError(sessionError instanceof Error ? sessionError.message : "Failed to load session.");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    void loadSession();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading ERP portal…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!authToken || !user || !actor) {
    return null;
  }

  return <ErpShell token={authToken} user={user} actor={actor} />;
}
