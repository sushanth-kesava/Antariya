"use client";

import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Loader2, Store, User } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"customer" | "admin">("customer");

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then((res) => res.json());

        const googleUser = {
          displayName: userInfo.name,
          email: userInfo.email,
          photoURL: userInfo.picture,
        };
        
        // Save the session and force the selected role via login override
        localStorage.setItem("google_auth_user", JSON.stringify(googleUser));
        localStorage.setItem("user_role", role);

        if (role === "admin") {
          router.push("/portal/admin");
        } else {
          router.push("/portal/customer");
        }
        
      } catch (error) {
        console.error("Login Error:", error);
      } finally {
        setLoading(false);
      }
    },
    onError: () => console.error("Login Failed"),
  });

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 space-y-8 bg-card">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold font-headline">Welcome Back</h1>
                <p className="text-muted-foreground text-sm font-medium">Log in to your StitchMart account</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-bold text-center text-gray-700">Select your portal:</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setRole("customer")}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${role === "customer" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
                >
                  <User className="h-6 w-6 mb-2" />
                  <span className="font-bold text-sm">Customer</span>
                </button>
                <button 
                  onClick={() => setRole("admin")}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${role === "admin" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
                >
                  <Store className="h-6 w-6 mb-2" />
                  <span className="font-bold text-sm">Admin / Dealer</span>
                </button>
              </div>
            </div>

            <Button 
              onClick={() => login()} 
              disabled={loading}
              className="w-full h-14 rounded-full text-lg font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all text-white"
            >
              {loading ? (
                <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Authenticating...</>
              ) : (
                "Sign in with Google"
              )}
            </Button>
          </div>
          <div className="p-6 bg-muted/40 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary font-bold hover:underline inline-flex items-center">
                Sign up here <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
