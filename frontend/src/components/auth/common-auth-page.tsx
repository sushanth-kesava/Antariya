"use client";

import { useEffect, useMemo, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  getPortalPathForRole,
  isAuthenticated,
  normalizeAppRole,
  persistAuthSession,
  type AppRole,
  type AuthSessionUser,
} from "@/lib/auth-session";
import {
  loginWithCredentialsOnBackend,
  loginWithGoogleOnBackend,
  signupWithCredentialsOnBackend,
} from "@/lib/api/auth";

type AuthMode = "login" | "signup";

function sanitizeNextPath(path: string | null): string {
  const candidate = String(path || "").trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "";
  }

  return candidate;
}

function normalizeRole(input: string | null): AppRole {
  if (input === "admin" || input === "superadmin") {
    return input;
  }

  return "customer";
}

function buildAuthUrl(mode: AuthMode, role: AppRole, nextPath: string): string {
  const path = mode === "login" ? "/login" : "/signup";
  const params = new URLSearchParams();
  params.set("role", role);

  if (nextPath) {
    params.set("next", nextPath);
  }

  return `${path}?${params.toString()}`;
}

export default function CommonAuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const roleFromQuery = searchParams.get("role");
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get("next")), [searchParams]);
  const selectedRole = useMemo(() => normalizeRole(roleFromQuery), [roleFromQuery]);
  const selectedRoleForGoogle = selectedRole;
  const isSignup = mode === "signup";
  const blockedSuperadminSignup = isSignup && selectedRole === "superadmin";
  const isSuperadminCredentialsFlow = !isSignup && selectedRole === "superadmin";

  useEffect(() => {
    if (isAuthenticated()) {
      const storedRole = normalizeAppRole(localStorage.getItem("user_role"));
      router.replace(nextPath || getPortalPathForRole(storedRole));
    }
  }, [router, nextPath, selectedRole]);

  const finishAuth = (token: string, user: AuthSessionUser) => {
    persistAuthSession(token, user);
    router.replace(nextPath || getPortalPathForRole(user.role));
  };

  const googleAuth = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);

        const result = await loginWithGoogleOnBackend({
          googleAccessToken: tokenResponse.access_token,
          role: selectedRoleForGoogle,
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope,
          expiresIn: tokenResponse.expires_in,
        });

        if (result.pendingApproval) {
          toast({
            title: "Approval pending",
            description: result.message || "Your request is waiting for superadmin approval.",
          });
          router.replace(buildAuthUrl("login", selectedRole, nextPath));
          return;
        }

        if (!result.token || !result.user) {
          throw new Error("Authentication response was incomplete.");
        }

        finishAuth(result.token, result.user);
      } catch (error) {
        toast({
          title: "Authentication failed",
          description: error instanceof Error ? error.message : "We could not complete your request.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      toast({
        title: "Google sign-in failed",
        description: "Please try again or choose a different account.",
        variant: "destructive",
      });
    },
  });

  const handleCredentialsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast({
        title: "Missing fields",
        description: "Email and password are required.",
        variant: "destructive",
      });
      return;
    }

    if (isSignup && password.trim().length < 8) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    if (blockedSuperadminSignup) {
      toast({
        title: "Superadmin signup is disabled",
        description: "Use superadmin Google sign-in with an approved superadmin account.",
        variant: "destructive",
      });
      return;
    }

    if (isSuperadminCredentialsFlow) {
      toast({
        title: "Use Google for superadmin",
        description: "Superadmin access is available only through approved Google accounts.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const credentialsRole = selectedRole === "superadmin" ? undefined : selectedRole;
      const result = isSignup
        ? await signupWithCredentialsOnBackend({
            email: email.trim(),
            password: password.trim(),
            displayName: displayName.trim() || undefined,
            role: credentialsRole,
          })
        : await loginWithCredentialsOnBackend({
            email: email.trim(),
            password: password.trim(),
            role: credentialsRole,
          });

      if (result.pendingApproval) {
        toast({
          title: "Approval pending",
          description: result.message || "Your request is waiting for superadmin approval.",
        });
        router.replace(buildAuthUrl("login", selectedRole, nextPath));
        return;
      }

      if (!result.token || !result.user) {
        throw new Error("Authentication response was incomplete.");
      }

      finishAuth(result.token, result.user);
    } catch (error) {
      toast({
        title: isSignup ? "Signup failed" : "Login failed",
        description: error instanceof Error ? error.message : "Unable to continue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 md:p-10 space-y-6 bg-card">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl md:text-4xl font-bold font-headline tracking-tight">
                {isSignup ? "Create your account" : "Sign in to your portal"}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base">
                Accessing as <span className="font-semibold text-foreground capitalize">{selectedRole}</span>
              </p>
            </div>

            {blockedSuperadminSignup ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5" />
                Superadmin signup is disabled. Use superadmin login with Google on an approved account.
              </div>
            ) : null}

            {isSuperadminCredentialsFlow ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5" />
                Superadmin login is Google-only. Use the button below.
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
              {isSignup ? (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your full name"
                    disabled={loading}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading || blockedSuperadminSignup || isSuperadminCredentialsFlow}
                className="w-full h-12 rounded-full text-base font-bold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : isSignup ? (
                  "Continue with credentials"
                ) : (
                  "Login with credentials"
                )}
              </Button>
            </form>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              onClick={() => googleAuth()}
              disabled={loading}
              variant="outline"
              className="w-full h-12 rounded-full text-base font-bold"
            >
              Continue with Google
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              {isSignup ? "Already have an account?" : "Need an account?"}{" "}
              <Link
                href={buildAuthUrl(isSignup ? "login" : "signup", selectedRole, nextPath)}
                className="text-primary font-semibold hover:underline inline-flex items-center"
              >
                {isSignup ? "Sign in" : "Sign up"} <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
