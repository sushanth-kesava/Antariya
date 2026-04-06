"use client";

import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { loginWithGoogleOnBackend } from "@/lib/api/auth";
import { useToast } from "@/hooks/use-toast";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const result = await loginWithGoogleOnBackend({
          googleAccessToken: tokenResponse.access_token,
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope,
          expiresIn: tokenResponse.expires_in,
        });

        if (!result.token || !result.user) {
          throw new Error("Authentication response was incomplete.");
        }

        localStorage.setItem("app_auth_token", result.token);
        localStorage.setItem("google_auth_user", JSON.stringify(result.user));
        localStorage.setItem("user_role", result.user.role);

        if (result.user.role === "superadmin") {
          router.push("/portal/superadmin");
        } else if (result.user.role === "admin") {
          router.push("/portal/admin");
        } else {
          router.push("/");
        }
      } catch (error) {
        toast({
          title: "Superadmin login failed",
          description: error instanceof Error ? error.message : "This account is not approved for superadmin access.",
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

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 space-y-8 bg-card">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold font-headline">Super Admin Access</h1>
                <p className="text-muted-foreground text-sm font-medium">Full platform control across admin and customer systems</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center space-y-2">
              <p className="text-sm font-bold text-gray-700">Escalated approval required</p>
              <p className="text-xs text-muted-foreground leading-relaxed">This login is only available for pre-approved super-admin accounts.</p>
            </div>

            <Button
              onClick={() => login()}
              disabled={loading}
              className="w-full h-14 rounded-full text-lg font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all text-white"
            >
              {loading ? (
                <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Authenticating...</>
              ) : (
                "Sign in as Super Admin"
              )}
            </Button>
          </div>

          <div className="p-6 bg-muted/40 border-t border-border/50 text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              Need admin access?{" "}
              <Link href="/admin-login" className="text-primary font-bold hover:underline inline-flex items-center">
                Go to admin login <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              Need an approval request?{" "}
              <Link href="/portal/admin" className="text-primary font-bold hover:underline inline-flex items-center">
                Submit from admin portal <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
