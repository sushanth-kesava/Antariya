"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Check, ChevronsUpDown, Search, MapPin, User as UserIcon, Truck, Bell } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { getAuthToken } from "@/lib/auth-session";
import { INDIAN_STATES } from "@/lib/india-states";
import { checkDeliveryByPincode } from "@/lib/api/delivery";
import {
  completeProfileOnBackend,
  getCustomerProfileFromBackend,
  type CompleteProfilePayload,
} from "@/lib/api/customerProfile";

const DRAFT_KEY = "antariya_profile_draft_v1";
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;

type AddressType = "Home" | "Office" | "Other";
type Gender = "male" | "female" | "other" | "";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  line1: string;
  line2: string;
  landmark: string;
  country: string;
  state: string;
  city: string;
  pincode: string;
  useSamePhone: boolean;
  alternatePhone: string;
  addressType: AddressType;
  deliveryInstructions: string;
  whatsappOptIn: boolean;
  promotionalEmails: boolean;
};

const INITIAL: FormState = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  line1: "",
  line2: "",
  landmark: "",
  country: "India",
  state: "",
  city: "",
  pincode: "",
  useSamePhone: true,
  alternatePhone: "",
  addressType: "Home",
  deliveryInstructions: "",
  whatsappOptIn: false,
  promotionalEmails: true,
};

// Digits-only, drop a leading +91 / 0 so validation sees the bare 10 digits.
function normalizePhone(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function Req() {
  return <span className="text-destructive" aria-hidden="true"> *</span>;
}

export default function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const nextPath = useMemo(() => {
    const raw = String(searchParams.get("next") || "").trim();
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/portal/customer";
  }, [searchParams]);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [pinLoading, setPinLoading] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [stateQuery, setStateQuery] = useState("");
  const submittedRef = useRef(false);
  const hydratedRef = useRef(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  // --- Hydrate: prefill from account + existing profile, and restore draft ---
  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();

    const hydrate = async () => {
      const base: FormState = { ...INITIAL };
      if (user?.email) base.email = user.email;
      if (user?.displayName) base.fullName = user.displayName;

      // Merge any existing profile values (so returning users see their data).
      if (token) {
        try {
          const profile = await getCustomerProfileFromBackend(token);
          if (profile) {
            base.fullName = profile.displayName || base.fullName;
            base.email = profile.email || base.email;
            base.phone = profile.phone || "";
            base.gender = (profile.gender as Gender) || "";
            base.dateOfBirth = profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "";
            const def = profile.addresses?.find((a) => a.isDefault) || profile.addresses?.[0];
            if (def) {
              base.line1 = def.line1 || "";
              base.line2 = def.line2 || "";
              base.landmark = def.landmark || "";
              base.country = def.country || "India";
              base.state = def.state || "";
              base.city = def.city || "";
              base.pincode = def.pincode || "";
              base.addressType = (def.addressType as AddressType) || "Home";
              base.deliveryInstructions = def.deliveryInstructions || "";
            }
            base.whatsappOptIn = Boolean(profile.preferences?.whatsappOptIn);
            base.promotionalEmails = profile.preferences?.newsletter !== false;
          }
        } catch {
          /* non-fatal — fall back to account values */
        }
      }

      // A saved draft (unsubmitted) takes precedence so a refresh preserves input.
      try {
        const draftRaw = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_KEY) : null;
        if (draftRaw) {
          const draft = JSON.parse(draftRaw) as Partial<FormState>;
          Object.assign(base, draft);
        }
      } catch {
        /* ignore malformed draft */
      }

      if (!cancelled) {
        setForm(base);
        setLoadingProfile(false);
        hydratedRef.current = true;
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // --- Persist a draft on every change (after hydration) so refresh is safe ---
  useEffect(() => {
    if (!hydratedRef.current || submittedRef.current) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* storage may be unavailable — non-fatal */
    }
  }, [form]);

  // --- Autofocus the first empty required field once loaded ------------------
  useEffect(() => {
    if (loadingProfile) return;
    const order: Array<[keyof FormState, string]> = [
      ["fullName", "cp-fullName"],
      ["phone", "cp-phone"],
      ["line1", "cp-line1"],
      ["state", "cp-state-trigger"],
      ["city", "cp-city"],
      ["pincode", "cp-pincode"],
    ];
    for (const [key, id] of order) {
      if (!String(form[key] || "").trim()) {
        const el = document.getElementById(id);
        if (el) {
          el.focus();
          break;
        }
      }
    }
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingProfile]);

  // --- Auto-detect state/city from PIN code ----------------------------------
  useEffect(() => {
    const pin = form.pincode.trim();
    if (!PINCODE_RE.test(pin)) return;
    let cancelled = false;
    setPinLoading(true);
    checkDeliveryByPincode(pin)
      .then((res) => {
        if (cancelled || !res) return;
        // Only auto-fill when the user hasn't already typed these.
        setForm((prev) => ({
          ...prev,
          state: prev.state || res.state || "",
          city: prev.city || res.district || "",
        }));
      })
      .catch(() => {
        /* pincode lookup is best-effort; ignore failures */
      })
      .finally(() => {
        if (!cancelled) setPinLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pincode]);

  const filteredStates = useMemo(() => {
    const q = stateQuery.trim().toLowerCase();
    if (!q) return INDIAN_STATES;
    return INDIAN_STATES.filter((s) => s.toLowerCase().includes(q));
  }, [stateQuery]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required.";

    const phone = normalizePhone(form.phone);
    if (!phone) e.phone = "Mobile number is required.";
    else if (!INDIAN_PHONE_RE.test(phone)) e.phone = "Enter a valid 10-digit Indian mobile number.";

    if (!form.line1.trim()) e.line1 = "Address line 1 is required.";
    if (!form.state.trim()) e.state = "State is required.";
    if (!form.city.trim()) e.city = "City is required.";
    if (!form.country.trim()) e.country = "Country is required.";

    const pin = form.pincode.trim();
    if (!pin) e.pincode = "PIN code is required.";
    else if (!PINCODE_RE.test(pin)) e.pincode = "PIN code must be exactly 6 digits.";

    if (!form.useSamePhone && form.alternatePhone.trim()) {
      const alt = normalizePhone(form.alternatePhone);
      if (!INDIAN_PHONE_RE.test(alt)) e.alternatePhone = "Enter a valid 10-digit Indian mobile number.";
    }
    return e;
  }

  const focusFirstError = (e: Record<string, string>) => {
    const idByKey: Record<string, string> = {
      fullName: "cp-fullName",
      phone: "cp-phone",
      line1: "cp-line1",
      state: "cp-state-trigger",
      city: "cp-city",
      pincode: "cp-pincode",
      country: "cp-country",
      alternatePhone: "cp-altPhone",
    };
    const firstKey = Object.keys(e)[0];
    const el = firstKey && idByKey[firstKey] ? document.getElementById(idByKey[firstKey]) : null;
    el?.focus();
  };

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return; // prevent duplicate submissions

    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      focusFirstError(e);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
      router.replace("/login");
      return;
    }

    const payload: CompleteProfilePayload = {
      fullName: form.fullName.trim(),
      email: form.email.trim() || undefined,
      phone: normalizePhone(form.phone),
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender || null,
      address: {
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        landmark: form.landmark.trim() || undefined,
        country: form.country.trim() || "India",
        state: form.state.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
      },
      useSamePhone: form.useSamePhone,
      alternatePhone: form.useSamePhone ? undefined : normalizePhone(form.alternatePhone) || undefined,
      addressType: form.addressType,
      deliveryInstructions: form.deliveryInstructions.trim() || undefined,
      whatsappOptIn: form.whatsappOptIn,
      promotionalEmails: form.promotionalEmails,
    };

    setSaving(true);
    try {
      const result = await completeProfileOnBackend(token, payload);
      if (!result.success) {
        setErrors(result.errors || {});
        if (result.errors) focusFirstError(result.errors);
        toast({ title: "Please review your details", description: result.message, variant: "destructive" });
        return;
      }
      submittedRef.current = true;
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      toast({ title: "Profile completed successfully!" });
      router.replace(nextPath);
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Could not save your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${key}-error`} className="text-xs text-destructive mt-1" role="alert">
        {errors[key]}
      </p>
    ) : null;

  const inputClass = (key: string) =>
    `rounded-xl ${errors[key] ? "border-destructive focus-visible:ring-destructive" : ""}`;

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Progress + heading */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span>Step 1 of 1 — Complete Your Profile</span>
            <span>Almost there</span>
          </div>
          <Progress value={100} className="h-2" />
          <div className="pt-3 space-y-1.5">
            <h1 className="text-3xl sm:text-4xl font-bold font-headline tracking-tight text-foreground">
              Welcome! Let&apos;s complete your profile.
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              This helps us deliver your orders faster and provide a better shopping experience.
            </p>
          </div>
        </div>

        {loadingProfile ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            {/* 1. Personal Information */}
            <section aria-labelledby="sec-personal" className="bg-card rounded-3xl border border-border/60 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                <h2 id="sec-personal" className="text-lg font-bold">Personal Information</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cp-fullName">Full Name<Req /></Label>
                  <Input
                    id="cp-fullName"
                    className={inputClass("fullName")}
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    autoComplete="name"
                  />
                  {fieldError("fullName")}
                </div>

                <div>
                  <Label htmlFor="cp-email">Email Address</Label>
                  <Input
                    id="cp-email"
                    type="email"
                    className={inputClass("email")}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    autoComplete="email"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Verified from your account. Editable if needed.</p>
                </div>

                <div>
                  <Label htmlFor="cp-phone">Mobile Number<Req /></Label>
                  <div className="flex items-center rounded-xl border border-input focus-within:ring-2 focus-within:ring-ring overflow-hidden bg-background">
                    <span className="px-3 text-sm text-muted-foreground border-r border-input select-none">+91</span>
                    <input
                      id="cp-phone"
                      inputMode="numeric"
                      maxLength={10}
                      className="flex-1 h-10 px-3 bg-transparent text-sm outline-none"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      aria-required="true"
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? "phone-error" : undefined}
                      autoComplete="tel-national"
                      placeholder="98765 43210"
                    />
                  </div>
                  {fieldError("phone")}
                </div>

                <div>
                  <Label htmlFor="cp-dob">Date of Birth</Label>
                  <Input
                    id="cp-dob"
                    type="date"
                    className={inputClass("dateOfBirth")}
                    value={form.dateOfBirth}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>Gender</Label>
                  <RadioGroup
                    className="flex flex-wrap gap-4 pt-2"
                    value={form.gender}
                    onValueChange={(v) => set("gender", v as Gender)}
                  >
                    {[
                      { v: "male", l: "Male" },
                      { v: "female", l: "Female" },
                      { v: "other", l: "Other" },
                    ].map((g) => (
                      <label key={g.v} htmlFor={`cp-gender-${g.v}`} className="flex items-center gap-2 cursor-pointer text-sm">
                        <RadioGroupItem id={`cp-gender-${g.v}`} value={g.v} />
                        {g.l}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </section>

            {/* 2. Default Shipping Address */}
            <section aria-labelledby="sec-address" className="bg-card rounded-3xl border border-border/60 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h2 id="sec-address" className="text-lg font-bold">Default Shipping Address</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="cp-line1">Address Line 1<Req /></Label>
                  <Input
                    id="cp-line1"
                    className={inputClass("line1")}
                    value={form.line1}
                    onChange={(e) => set("line1", e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.line1)}
                    aria-describedby={errors.line1 ? "line1-error" : undefined}
                    autoComplete="address-line1"
                    placeholder="House / Flat no., Building, Street"
                  />
                  {fieldError("line1")}
                </div>

                <div>
                  <Label htmlFor="cp-line2">Address Line 2</Label>
                  <Input
                    id="cp-line2"
                    className="rounded-xl"
                    value={form.line2}
                    onChange={(e) => set("line2", e.target.value)}
                    autoComplete="address-line2"
                    placeholder="Area, Colony (optional)"
                  />
                </div>

                <div>
                  <Label htmlFor="cp-landmark">Landmark</Label>
                  <Input
                    id="cp-landmark"
                    className="rounded-xl"
                    value={form.landmark}
                    onChange={(e) => set("landmark", e.target.value)}
                    placeholder="Nearby landmark (optional)"
                  />
                </div>

                <div>
                  <Label htmlFor="cp-pincode">PIN Code<Req /></Label>
                  <div className="relative">
                    <Input
                      id="cp-pincode"
                      inputMode="numeric"
                      maxLength={6}
                      className={inputClass("pincode")}
                      value={form.pincode}
                      onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      aria-required="true"
                      aria-invalid={Boolean(errors.pincode)}
                      aria-describedby={errors.pincode ? "pincode-error" : undefined}
                      autoComplete="postal-code"
                      placeholder="6-digit PIN"
                    />
                    {pinLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {fieldError("pincode")}
                  <p className="text-xs text-muted-foreground mt-1">We&apos;ll auto-detect your state &amp; city.</p>
                </div>

                <div>
                  <Label htmlFor="cp-country">Country<Req /></Label>
                  <Input
                    id="cp-country"
                    className={inputClass("country")}
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    autoComplete="country-name"
                  />
                  {fieldError("country")}
                </div>

                {/* Searchable State dropdown */}
                <div>
                  <Label>State<Req /></Label>
                  <Popover open={stateOpen} onOpenChange={setStateOpen}>
                    <PopoverTrigger asChild>
                      <button
                        id="cp-state-trigger"
                        type="button"
                        role="combobox"
                        aria-expanded={stateOpen}
                        aria-required="true"
                        aria-invalid={Boolean(errors.state)}
                        className={`flex h-10 w-full items-center justify-between rounded-xl border bg-background px-3 text-sm ${
                          errors.state ? "border-destructive" : "border-input"
                        } ${form.state ? "" : "text-muted-foreground"}`}
                      >
                        {form.state || "Select state"}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                          autoFocus
                          className="flex-1 h-10 px-2 bg-transparent text-sm outline-none"
                          placeholder="Search state..."
                          value={stateQuery}
                          onChange={(e) => setStateQuery(e.target.value)}
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1" role="listbox">
                        {filteredStates.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">No state found.</p>
                        ) : (
                          filteredStates.map((s) => (
                            <button
                              key={s}
                              type="button"
                              role="option"
                              aria-selected={form.state === s}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                set("state", s);
                                setStateOpen(false);
                                setStateQuery("");
                              }}
                            >
                              <Check className={`h-4 w-4 ${form.state === s ? "opacity-100 text-primary" : "opacity-0"}`} />
                              {s}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {fieldError("state")}
                </div>

                <div>
                  <Label htmlFor="cp-city">City<Req /></Label>
                  <Input
                    id="cp-city"
                    className={inputClass("city")}
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.city)}
                    aria-describedby={errors.city ? "city-error" : undefined}
                    autoComplete="address-level2"
                    placeholder="City / District"
                  />
                  {fieldError("city")}
                </div>
              </div>
            </section>

            {/* 3 & 4. Delivery Contact + Preferences */}
            <section aria-labelledby="sec-delivery" className="bg-card rounded-3xl border border-border/60 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <h2 id="sec-delivery" className="text-lg font-bold">Delivery Contact &amp; Preferences</h2>
              </div>

              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <Checkbox
                  checked={form.useSamePhone}
                  onCheckedChange={(v) => set("useSamePhone", Boolean(v))}
                />
                Use the same phone number for delivery contact
              </label>

              {!form.useSamePhone && (
                <div className="max-w-sm">
                  <Label htmlFor="cp-altPhone">Alternate Mobile Number</Label>
                  <div className="flex items-center rounded-xl border border-input focus-within:ring-2 focus-within:ring-ring overflow-hidden bg-background">
                    <span className="px-3 text-sm text-muted-foreground border-r border-input select-none">+91</span>
                    <input
                      id="cp-altPhone"
                      inputMode="numeric"
                      maxLength={10}
                      className="flex-1 h-10 px-3 bg-transparent text-sm outline-none"
                      value={form.alternatePhone}
                      onChange={(e) => set("alternatePhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      aria-invalid={Boolean(errors.alternatePhone)}
                      placeholder="98765 43210"
                    />
                  </div>
                  {fieldError("alternatePhone")}
                </div>
              )}

              <div>
                <Label>Address Type</Label>
                <RadioGroup
                  className="flex flex-wrap gap-3 pt-2"
                  value={form.addressType}
                  onValueChange={(v) => set("addressType", v as AddressType)}
                >
                  {(["Home", "Office", "Other"] as AddressType[]).map((t) => (
                    <label
                      key={t}
                      htmlFor={`cp-addr-${t}`}
                      className={`flex items-center gap-2 cursor-pointer rounded-xl border px-4 py-2 text-sm transition-colors ${
                        form.addressType === t ? "border-primary bg-primary/5 text-primary font-semibold" : "border-input"
                      }`}
                    >
                      <RadioGroupItem id={`cp-addr-${t}`} value={t} className="sr-only" />
                      {t}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="cp-instructions">Delivery Instructions</Label>
                <Textarea
                  id="cp-instructions"
                  className="rounded-xl"
                  rows={3}
                  value={form.deliveryInstructions}
                  onChange={(e) => set("deliveryInstructions", e.target.value)}
                  placeholder="E.g. Leave at the reception, call on arrival (optional)"
                />
              </div>
            </section>

            {/* 6. Notifications */}
            <section aria-labelledby="sec-notify" className="bg-card rounded-3xl border border-border/60 shadow-sm p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 id="sec-notify" className="text-lg font-bold">Notifications</h2>
              </div>

              <label className="flex items-start gap-3 cursor-pointer text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={form.whatsappOptIn}
                  onCheckedChange={(v) => set("whatsappOptIn", Boolean(v))}
                />
                Receive updates about new collections and exclusive offers via WhatsApp.
              </label>

              <label className="flex items-start gap-3 cursor-pointer text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={form.promotionalEmails}
                  onCheckedChange={(v) => set("promotionalEmails", Boolean(v))}
                />
                Receive promotional emails.
              </label>
            </section>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Fields marked <span className="text-destructive">*</span> are required.
              </p>
              <Button
                type="submit"
                size="lg"
                disabled={saving}
                className="rounded-full px-10 w-full sm:w-auto shadow-lg shadow-primary/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save & Continue"
                )}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
