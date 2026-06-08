"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { submitAdminApplicationOnBackend } from "@/lib/api/superadmin";
import { ArrowLeft, Loader2, ShieldCheck, Building2 } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";

type FormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  businessName: string;
  businessType: string;
  businessAddress: string;
  website: string;
  panNumber: string;
  aadharNumber: string;
  gstNumber: string;
  notes: string;
};

const initialFormState: FormState = {
  fullName: "",
  email: "",
  phoneNumber: "",
  businessName: "",
  businessType: "",
  businessAddress: "",
  website: "",
  panNumber: "",
  aadharNumber: "",
  gstNumber: "",
  notes: "",
};

export default function AdminApplicationPage() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const requiredFields = [
      form.fullName.trim(),
      form.email.trim(),
      form.phoneNumber.trim(),
      form.businessName.trim(),
      form.businessType.trim(),
      form.businessAddress.trim(),
      form.panNumber.trim(),
      form.aadharNumber.trim(),
    ];

    if (requiredFields.some((value) => !value)) {
      setError("Please complete all required fields before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await submitAdminApplicationOnBackend({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        businessName: form.businessName.trim(),
        businessType: form.businessType.trim(),
        businessAddress: form.businessAddress.trim(),
        website: form.website.trim() || undefined,
        panNumber: form.panNumber.trim().toUpperCase(),
        aadharNumber: form.aadharNumber.trim(),
        gstNumber: form.gstNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });

      setSubmitted(true);
      setForm(initialFormState);
      toast({
        title: "Application submitted",
        description: "Your admin request is now waiting in the superadmin dashboard.",
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-amber-50/50 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-10 lg:py-16">
        <div className="mb-5 flex items-center gap-3 text-sm text-stone-500">
          <Button asChild variant="ghost" className="rounded-full px-3 text-stone-700 hover:bg-stone-100">
            <Link href="/superadmin-login">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to superadmin login
            </Link>
          </Button>
          <span className="hidden sm:inline">Superadmin access application</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr]">
          <Card className="rounded-[30px] border-stone-200 shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
            <CardHeader className="space-y-3">
              <Badge className="rounded-full bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-100 w-fit">
                Superadmin application
              </Badge>
              <CardTitle className="text-3xl sm:text-4xl font-black tracking-tight text-stone-950">
                Apply for superadmin access
              </CardTitle>
              <CardDescription className="text-base text-stone-600 max-w-2xl">
                Submit your business and identity details for superadmin review. This request will appear in the superadmin dashboard as a pending elevated-access application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 space-y-4">
                  <div className="flex items-center gap-3 text-emerald-900">
                    <ShieldCheck className="h-6 w-6" />
                    <p className="text-lg font-bold">Application submitted successfully</p>
                  </div>
                  <p className="text-sm text-emerald-900/80 leading-6">
                    The superadmin team can now review your request, verify the submitted details, and approve the admin role when appropriate.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button asChild className="rounded-full bg-stone-950 text-white hover:bg-stone-800">
                      <Link href="/superadmin-login">Return to superadmin login</Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-emerald-200 text-emerald-900"
                      onClick={() => setSubmitted(false)}
                    >
                      Submit another application
                    </Button>
                  </div>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input id="fullName" value={form.fullName} onChange={handleChange("fullName")} placeholder="Applicant name" required disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={handleChange("email")} placeholder="you@example.com" required disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone number</Label>
                      <Input id="phoneNumber" value={form.phoneNumber} onChange={handleChange("phoneNumber")} placeholder="+91 98765 43210" required disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business name</Label>
                      <Input id="businessName" value={form.businessName} onChange={handleChange("businessName")} placeholder="Company / brand name" required disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business type</Label>
                      <Input id="businessType" value={form.businessType} onChange={handleChange("businessType")} placeholder="Manufacturer, dealer, studio, etc." required disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website or store link</Label>
                      <Input id="website" value={form.website} onChange={handleChange("website")} placeholder="https://..." disabled={submitting} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessAddress">Business address</Label>
                    <Textarea
                      id="businessAddress"
                      value={form.businessAddress}
                      onChange={handleChange("businessAddress")}
                      placeholder="Full business address"
                      required
                      disabled={submitting}
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="panNumber">PAN card number</Label>
                      <Input id="panNumber" value={form.panNumber} onChange={handleChange("panNumber")} placeholder="ABCDE1234F" required disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aadharNumber">Aadhar number</Label>
                      <Input id="aadharNumber" value={form.aadharNumber} onChange={handleChange("aadharNumber")} placeholder="12-digit Aadhar number" required disabled={submitting} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="gstNumber">GST number</Label>
                      <Input id="gstNumber" value={form.gstNumber} onChange={handleChange("gstNumber")} placeholder="Optional GST number" disabled={submitting} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Additional notes</Label>
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={handleChange("notes")}
                      placeholder="Anything else the superadmin should know"
                      disabled={submitting}
                      rows={4}
                    />
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-6">
                    These details are submitted for superadmin review and approval. Keep the information accurate so the request can be verified quickly.
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-full bg-stone-950 text-white hover:bg-stone-800" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                      </>
                    ) : (
                      "Submit superadmin application"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[28px] border-stone-200 bg-white shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-900">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">What gets reviewed</p>
                    <p className="text-sm text-stone-600">Business identity, contact details, and tax identifiers.</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600 leading-6">
                  Your request will be saved as a pending superadmin access request and shown in the superadmin dashboard for manual approval.
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-stone-200 bg-stone-950 text-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Login for approved admins</CardTitle>
                <CardDescription className="text-white/70">
                  If your admin account is already approved, use the login route instead of reapplying.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full rounded-full bg-white text-stone-950 hover:bg-stone-100">
                  <Link href="/login?role=admin&next=/portal/superadmin&force=1">Go to admin login</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}