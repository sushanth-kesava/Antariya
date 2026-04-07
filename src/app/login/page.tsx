"use client";

import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { BRAND_LOGO_URL, Navbar } from "@/components/navbar";
import { loginWithGoogleOnBackend } from "@/lib/api/auth";
import { useToast } from "@/hooks/use-toast";
import { getPortalPathForRole, persistAuthSession } from "@/lib/auth-session";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"customer" | "admin">("customer");

  const handleAuthFailure = (error: unknown) => {
    const description = error instanceof Error ? error.message : "We could not complete sign in. Please try again.";
    const waitingForApproval = description.toLowerCase().includes("approval");

    toast({
      title: waitingForApproval ? "Approval pending" : "Login failed",
      description,
      variant: "destructive",
    });
  };

  const handleGoogleSignIn = () => {
    if (loading) {
      return;
    }
    login();
  };

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const result = await loginWithGoogleOnBackend({
          googleAccessToken: tokenResponse.access_token,
          role: selectedRole,
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope,
          expiresIn: tokenResponse.expires_in,
        });

        if (!result.token || !result.user) {
          throw new Error("Authentication response was incomplete.");
        }

        persistAuthSession(result.token, result.user);
        router.replace(getPortalPathForRole(result.user.role));
      } catch (error) {
        handleAuthFailure(error);
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

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 md:p-10 space-y-8 bg-card">
            <div className="text-center space-y-5">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <img src={BRAND_LOGO_URL} alt="Antariya icon" className="h-14 w-14 rounded-xl object-cover" />
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold font-headline tracking-tight">Welcome Back</h1>
                <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto leading-relaxed">
                  Continue with Google to access your Antariya India account. Choose customer or admin and we route you to the right portal.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold tracking-wide text-gray-600 text-center">Select login type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setSelectedRole("customer")}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${selectedRole === "customer" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 bg-gray-50 text-gray-700"}`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setSelectedRole("admin")}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${selectedRole === "admin" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 bg-gray-50 text-gray-700"}`}
                >
                  Admin
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white border border-gray-100 px-3 py-3 text-center space-y-1">
                <Sparkles className="h-4 w-4 mx-auto text-primary" />
                <p className="text-xs font-semibold text-gray-700">Role-aware routing</p>
              </div>
              <div className="rounded-xl bg-white border border-gray-100 px-3 py-3 text-center space-y-1">
                <ShieldCheck className="h-4 w-4 mx-auto text-primary" />
                <p className="text-xs font-semibold text-gray-700">Secure session token</p>
              </div>
              <div className="rounded-xl bg-white border border-gray-100 px-3 py-3 text-center space-y-1">
                <ArrowRight className="h-4 w-4 mx-auto text-primary" />
                <p className="text-xs font-semibold text-gray-700">Instant dashboard redirect</p>
              </div>
            </div>

            <Button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-14 rounded-full text-lg font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all text-white"
            >
              {loading ? (
                <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Authenticating...</>
              ) : (
                `Continue with Google (${selectedRole})`
              )}
            </Button>

            <div className="grid grid-cols-1 gap-2 text-xs text-center">
              <Link href="/signup" className="rounded-xl border border-gray-200 bg-gray-50 py-2.5 font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                Create account
              </Link>
            </div>
          </div>
          <div className="p-6 bg-muted/40 border-t border-border/50 text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              Access checks happen on every sign-in. Unapproved admin requests will remain blocked until superadmin review.
            </p>
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to secure account verification and India-region session validation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
