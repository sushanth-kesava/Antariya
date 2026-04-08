"use client";

import { useEffect, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, User, Shield, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { loginWithGoogleOnBackend } from "@/lib/api/auth";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated, persistAuthSession } from "@/lib/auth-session";

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"customer" | "admin">("customer");

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/");
    }
  }, [router]);

  const signup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const result = await loginWithGoogleOnBackend({
          googleAccessToken: tokenResponse.access_token,
          role,
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope,
          expiresIn: tokenResponse.expires_in,
        });

        if (result.pendingApproval) {
          toast({
            title: "Admin request submitted",
            description: result.message || "Your request is waiting for superadmin approval.",
          });
          router.push("/login");
          return;
        }

        if (!result.token || !result.user) {
          throw new Error("Signup completed without a usable auth session.");
        }

        persistAuthSession(result.token, result.user);
        router.replace("/");
        
      } catch (error) {
        toast({
          title: "Signup failed",
          description: error instanceof Error ? error.message : "We could not complete account setup. Please try again.",
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
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-12">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 space-y-8 bg-card">
            <div className="text-center w-full space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold font-headline">Create your Account</h1>
                <p className="text-muted-foreground text-sm font-medium">Join India&apos;s embroidery-first marketplace</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-bold text-center text-gray-700">Choose account type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("customer")}
                  className={`rounded-2xl border p-5 text-left transition-all ${role === "customer" ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 bg-gray-50"}`}
                >
                  <User className="h-8 w-8 text-secondary" />
                  <p className="mt-3 font-bold">Customer</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">Browse, shop, wishlist, and place orders.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`rounded-2xl border p-5 text-left transition-all ${role === "admin" ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 bg-gray-50"}`}
                >
                  <Shield className="h-8 w-8 text-primary" />
                  <p className="mt-3 font-bold">Admin</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">Request access to manage products, reviews, and orders.</p>
                </button>
              </div>
              {role === "admin" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 leading-relaxed">
                  Admin sign-up submits an approval request. Approved admins can log in from the main login page after review.
                </div>
              ) : null}
            </div>

            <Button 
              onClick={() => signup()} 
              disabled={loading}
              className="w-full h-14 rounded-full text-lg font-bold shadow-lg shadow-secondary/20 bg-secondary hover:bg-secondary/90 hover:scale-105 transition-all text-white"
            >
              {loading ? (
                <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Provisioning Account...</>
              ) : (
                "Continue securely with Google"
              )}
            </Button>
          </div>
          
          <div className="p-6 bg-muted/40 border-t border-border/50 text-center space-y-3">
              <p className="text-xs text-center text-muted-foreground px-6 font-medium leading-relaxed">
              By registering, you agree to our{" "}
                <Link href="/terms" className="underline underline-offset-4 hover:text-primary">India Terms of Service</Link>{" "}
              and{" "}
                <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">India Privacy Policy</Link>.
            </p>
            <p className="text-xs text-center text-muted-foreground px-6 leading-relaxed flex items-center justify-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Admin requests are reviewed by the superadmin before access is granted.
            </p>
            {role === "admin" ? (
              <p className="text-xs text-center text-muted-foreground px-6 leading-relaxed flex items-center justify-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5" /> Your request will be queued for superadmin approval before access is granted.
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground font-medium">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-bold hover:underline inline-flex items-center">
                Sign in <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
