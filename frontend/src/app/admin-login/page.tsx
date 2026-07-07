import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, FileText, Sparkles } from "lucide-react";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-100/60 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-10 lg:py-16">
        <section className="relative overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,53,15,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(80,30,20,0.08),transparent_28%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] p-6 sm:p-8 lg:p-12">
            <div className="space-y-6">
              <Badge className="rounded-full bg-stone-200 text-stone-800 hover:bg-stone-200 w-fit border border-stone-300">
                Admin portal
              </Badge>
              <div className="space-y-4 max-w-2xl">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-stone-950 font-headline">
                  Sign in or apply for admin access
                </h1>
                <p className="text-base sm:text-lg text-stone-600 leading-8 max-w-xl">
                  Existing admins can log in to the portal. New applicants should submit their business and identity details for superadmin review.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="rounded-full h-12 px-6 bg-stone-950 text-white hover:bg-stone-800">
                  <Link href="/login?role=admin&next=/portal/admin&force=1">
                    Admin Login <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full h-12 px-6 border-stone-300 bg-white">
                  <Link href="/admin-login/apply">
                    Apply for Admin Access <FileText className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <ShieldCheck className="h-5 w-5 text-stone-700" />
                  <p className="mt-3 text-sm font-semibold text-stone-900">Superadmin review</p>
                  <p className="mt-1 text-sm text-stone-600">Requests are routed to the superadmin dashboard for approval.</p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <FileText className="h-5 w-5 text-stone-700" />
                  <p className="mt-3 text-sm font-semibold text-stone-900">Business details</p>
                  <p className="mt-1 text-sm text-stone-600">Add your company, address, and tax identity information.</p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <Sparkles className="h-5 w-5 text-stone-700" />
                  <p className="mt-3 text-sm font-semibold text-stone-900">No redirect loop</p>
                  <p className="mt-1 text-sm text-stone-600">The request form lives on its own page now.</p>
                </div>
              </div>
            </div>

            <Card className="rounded-[28px] border-stone-200 bg-stone-950 text-white shadow-2xl">
              <CardContent className="p-6 sm:p-8 space-y-4">
                <Badge className="rounded-full bg-white/10 text-white border-white/10 hover:bg-white/10 w-fit">
                  Quick path
                </Badge>
                <h2 className="text-2xl font-bold">Already approved?</h2>
                <p className="text-sm leading-6 text-white/75">
                  Use the login button to open the Google sign-in flow for an existing admin account.
                </p>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm text-white/80">
                  <p>1. Login with the approved admin email.</p>
                  <p>2. Submit an application if you do not yet have access.</p>
                  <p>3. Wait for superadmin approval in the dashboard.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
