"use client";

import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Loader2, Store, User } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { loginWithGoogleOnBackend } from "@/lib/api/auth";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"customer" | "admin">("customer");

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

        localStorage.setItem("app_auth_token", result.token);
        localStorage.setItem("google_auth_user", JSON.stringify(result.user));
        localStorage.setItem("user_role", result.user.role);

        router.push("/");
        
      } catch (error) {
        console.error("Signup Error:", error);
      } finally {
        setLoading(false);
      }
    },
    onError: () => console.error("Signup Failed"),
  });

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-12">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 space-y-8 bg-card">
            <div className="text-center w-full space-y-4">
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mx-auto text-secondary">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold font-headline">Create your Account</h1>
                <p className="text-muted-foreground text-sm font-medium">Join the largest embroidery marketplace in India</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-bold text-center text-gray-700">I am joining as a:</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setRole("customer")}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${role === "customer" ? "border-secondary bg-secondary/5 text-secondary scale-[1.02] shadow-sm" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
                >
                  <User className="h-8 w-8 mb-3" />
                  <span className="font-bold">Customer</span>
                  <span className="text-[10px] text-muted-foreground mt-1">I want to buy products</span>
                </button>
                <button 
                  onClick={() => setRole("admin")}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${role === "admin" ? "border-secondary bg-secondary/5 text-secondary scale-[1.02] shadow-sm" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
                >
                  <Store className="h-8 w-8 mb-3" />
                  <span className="font-bold">Company / Admin</span>
                  <span className="text-[10px] text-muted-foreground mt-1">I want to sell items</span>
                </button>
              </div>
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
              <Link href="/terms" className="underline underline-offset-4 hover:text-primary">Terms of Service</Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">Privacy Policy</Link>.
            </p>
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
