"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Lock, Pencil, Check, X, MapPin, Plus, Trash2, Star, Home, Building2,
  Mail, Phone, ShieldCheck, Info, Briefcase, Globe, FileText,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth-session";
import { INDIAN_STATES } from "@/lib/india-states";
import {
  getCustomerProfileFromBackend,
  updateCustomerProfileOnBackend,
  addAddressOnBackend,
  updateAddressOnBackend,
  removeAddressOnBackend,
  setDefaultAddressOnBackend,
  getBusinessDetailsFromBackend,
  updateBusinessDetailsOnBackend,
  type CustomerProfileData,
  type CustomerAddress,
  type AddressInput,
  type AdminBusinessDetails,
} from "@/lib/api/customerProfile";

const MAX_ADDRESSES = 5;
const PINCODE_RE = /^\d{6}$/;

const EMPTY_ADDRESS: AddressInput = {
  addressType: "Home",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  alternatePhone: "",
  deliveryInstructions: "",
  isDefault: false,
};

function Req() {
  return <span className="text-destructive" aria-hidden="true"> *</span>;
}

function daysUntil(nextIso: string | null, lastIso: string | null): number {
  if (!lastIso) return 0;
  const last = new Date(lastIso).getTime();
  const next = last + 15 * 24 * 60 * 60 * 1000;
  const remaining = next - Date.now();
  return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

export default function AccountProfile() {
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState<AdminBusinessDetails | null>(null);
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [bForm, setBForm] = useState<Record<string, string>>({});

  // Personal details editing
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [pForm, setPForm] = useState({ displayName: "", gender: "" as "" | "male" | "female" | "other", dateOfBirth: "" });

  // Address editor (add or edit)
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrEditingId, setAddrEditingId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState<AddressInput>({ ...EMPTY_ADDRESS });
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});
  const [savingAddr, setSavingAddr] = useState(false);
  const [busyAddrId, setBusyAddrId] = useState<string | null>(null);

  const cooldownDays = useMemo(
    () => daysUntil(null, profile?.lastProfileEditAt || null),
    [profile?.lastProfileEditAt]
  );

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    getCustomerProfileFromBackend(token)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setPForm({
          displayName: data.displayName || "",
          gender: data.gender || "",
          dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "",
        });
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load profile."))
      .finally(() => !cancelled && setLoading(false));

    // Business/application details (admins only; returns null otherwise).
    getBusinessDetailsFromBackend(token)
      .then((biz) => !cancelled && setBusiness(biz))
      .catch(() => { /* non-fatal — section simply stays hidden */ });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const refreshFromAddresses = (addresses: CustomerAddress[]) => {
    setProfile((prev) => (prev ? { ...prev, addresses } : prev));
  };

  // --- Personal details ------------------------------------------------------
  const savePersonal = async () => {
    const token = getAuthToken();
    if (!token || !profile) return;
    if (!pForm.displayName.trim()) {
      toast({ title: "Name required", description: "Full name cannot be empty.", variant: "destructive" });
      return;
    }
    setSavingPersonal(true);
    try {
      const result = await updateCustomerProfileOnBackend(token, {
        displayName: pForm.displayName.trim(),
        gender: pForm.gender || null,
        dateOfBirth: pForm.dateOfBirth || null,
      });
      if (!result.success) {
        toast({
          title: result.code === "EDIT_COOLDOWN" ? "Edit locked" : "Could not save",
          description: result.message,
          variant: "destructive",
        });
        return;
      }
      setProfile(result.profile);
      setEditingPersonal(false);
      toast({ title: "Profile updated successfully!" });
    } finally {
      setSavingPersonal(false);
    }
  };

  const cancelPersonal = () => {
    if (profile) {
      setPForm({
        displayName: profile.displayName || "",
        gender: profile.gender || "",
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
      });
    }
    setEditingPersonal(false);
  };

  // --- Address book ----------------------------------------------------------
  const openAddAddress = () => {
    setAddrEditingId(null);
    setAddrForm({ ...EMPTY_ADDRESS, isDefault: (profile?.addresses.length || 0) === 0 });
    setAddrErrors({});
    setAddrOpen(true);
  };

  const openEditAddress = (a: CustomerAddress) => {
    setAddrEditingId(a._id);
    setAddrForm({
      addressType: (a.addressType as AddressInput["addressType"]) || "Home",
      line1: a.line1 || "",
      line2: a.line2 || "",
      landmark: a.landmark || "",
      city: a.city || "",
      state: a.state || "",
      country: a.country || "India",
      pincode: a.pincode || "",
      alternatePhone: a.alternatePhone || "",
      deliveryInstructions: a.deliveryInstructions || "",
      isDefault: a.isDefault,
    });
    setAddrErrors({});
    setAddrOpen(true);
  };

  const validateAddr = () => {
    const e: Record<string, string> = {};
    if (!addrForm.line1.trim()) e.line1 = "Address line 1 is required.";
    if (!addrForm.city.trim()) e.city = "City is required.";
    if (!addrForm.state.trim()) e.state = "State is required.";
    if (!addrForm.pincode.trim()) e.pincode = "PIN code is required.";
    else if (!PINCODE_RE.test(addrForm.pincode.trim())) e.pincode = "PIN code must be exactly 6 digits.";
    return e;
  };

  const saveAddress = async () => {
    const token = getAuthToken();
    if (!token) return;
    const e = validateAddr();
    if (Object.keys(e).length > 0) {
      setAddrErrors(e);
      return;
    }
    setSavingAddr(true);
    try {
      const result = addrEditingId
        ? await updateAddressOnBackend(token, addrEditingId, addrForm)
        : await addAddressOnBackend(token, addrForm);
      if (!result.success) {
        toast({
          title: result.code === "ADDRESS_LIMIT" ? "Address limit reached" : "Could not save address",
          description: result.message,
          variant: "destructive",
        });
        return;
      }
      refreshFromAddresses(result.addresses);
      setAddrOpen(false);
      toast({ title: addrEditingId ? "Address updated." : "Address added." });
    } finally {
      setSavingAddr(false);
    }
  };

  const deleteAddress = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;
    setBusyAddrId(id);
    try {
      const result = await removeAddressOnBackend(token, id);
      if (!result.success) {
        toast({ title: "Could not remove", description: result.message, variant: "destructive" });
        return;
      }
      refreshFromAddresses(result.addresses);
      toast({ title: "Address removed." });
    } finally {
      setBusyAddrId(null);
    }
  };

  const makeDefault = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;
    setBusyAddrId(id);
    try {
      const result = await setDefaultAddressOnBackend(token, id);
      if (result.success) {
        refreshFromAddresses(result.addresses);
        toast({ title: "Default address updated." });
      }
    } finally {
      setBusyAddrId(null);
    }
  };

  const setAddr = <K extends keyof AddressInput>(k: K, v: AddressInput[K]) => {
    setAddrForm((prev) => ({ ...prev, [k]: v }));
    setAddrErrors((prev) => {
      if (!prev[k as string]) return prev;
      const n = { ...prev };
      delete n[k as string];
      return n;
    });
  };

  // Business fields the admin left blank during application — the only ones
  // they may fill from here. Submitted (non-empty) fields stay locked.
  const BUSINESS_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
    { key: "businessName", label: "Business Name" },
    { key: "businessType", label: "Business Type" },
    { key: "website", label: "Website" },
    { key: "gstNumber", label: "GST Number" },
    { key: "panNumber", label: "PAN Number" },
    { key: "businessAddress", label: "Business Address", multiline: true },
    { key: "notes", label: "Notes", multiline: true },
  ];

  const emptyBusinessFields = business
    ? BUSINESS_FIELDS.filter((f) => {
        const v = (business as Record<string, unknown>)[f.key];
        return v === null || v === undefined || String(v).trim() === "";
      })
    : [];

  const startEditBusiness = () => {
    const seed: Record<string, string> = {};
    emptyBusinessFields.forEach((f) => { seed[f.key] = ""; });
    setBForm(seed);
    setEditingBusiness(true);
  };

  const saveBusiness = async () => {
    const token = getAuthToken();
    if (!token) return;
    const updates: Record<string, string> = {};
    Object.entries(bForm).forEach(([k, v]) => {
      if (String(v).trim()) updates[k] = String(v).trim();
    });
    if (Object.keys(updates).length === 0) {
      setEditingBusiness(false);
      return;
    }
    setSavingBusiness(true);
    try {
      const result = await updateBusinessDetailsOnBackend(token, updates);
      if (!result.success) {
        toast({ title: "Could not save", description: result.message, variant: "destructive" });
        return;
      }
      if (result.business) setBusiness(result.business);
      setEditingBusiness(false);
      toast({ title: "Business details updated." });
    } finally {
      setSavingBusiness(false);
    }
  };

  const addrCount = profile?.addresses.length || 0;
  const canAddMore = addrCount < MAX_ADDRESSES;

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold font-headline tracking-tight">My Profile</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Manage your personal details and saved addresses.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error && !profile ? (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
        ) : profile ? (
          <div className="space-y-8">
            {/* Personal Information */}
            <section className="bg-card rounded-3xl border border-border/60 shadow-sm p-6 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">Personal Information</h2>
                {!editingPersonal ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-primary"
                    onClick={() => setEditingPersonal(true)}
                    disabled={cooldownDays > 0}
                    title={cooldownDays > 0 ? `Editing locked for ${cooldownDays} more day(s)` : "Edit details"}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                ) : null}
              </div>

              {cooldownDays > 0 && (
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Profile details can be changed once every 15 days. You can edit again in{" "}
                    <strong>{cooldownDays} day{cooldownDays === 1 ? "" : "s"}</strong>.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div>
                  <Label htmlFor="ap-name">Full Name{editingPersonal && <Req />}</Label>
                  {editingPersonal ? (
                    <Input
                      id="ap-name"
                      className="rounded-xl"
                      value={pForm.displayName}
                      onChange={(e) => setPForm((c) => ({ ...c, displayName: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm font-medium py-2">{profile.displayName || "—"}</p>
                  )}
                </div>

                {/* Email — locked */}
                <div>
                  <Label className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> Email <Lock className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <p className="text-sm font-medium py-2 text-muted-foreground">{profile.email}</p>
                </div>

                {/* Mobile — locked */}
                <div>
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> Mobile Number <Lock className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <p className="text-sm font-medium py-2 text-muted-foreground">
                    {profile.phone ? `+91 ${profile.phone}` : "—"}
                  </p>
                </div>

                {/* Date of Birth */}
                <div>
                  <Label htmlFor="ap-dob">Date of Birth</Label>
                  {editingPersonal ? (
                    <Input
                      id="ap-dob"
                      type="date"
                      className="rounded-xl"
                      max={new Date().toISOString().slice(0, 10)}
                      value={pForm.dateOfBirth}
                      onChange={(e) => setPForm((c) => ({ ...c, dateOfBirth: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm font-medium py-2">
                      {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                    </p>
                  )}
                </div>

                {/* Gender */}
                <div className="sm:col-span-2">
                  <Label>Gender</Label>
                  {editingPersonal ? (
                    <RadioGroup
                      className="flex flex-wrap gap-4 pt-2"
                      value={pForm.gender}
                      onValueChange={(v) => setPForm((c) => ({ ...c, gender: v as typeof c.gender }))}
                    >
                      {[{ v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "other", l: "Other" }].map((g) => (
                        <label key={g.v} htmlFor={`ap-gender-${g.v}`} className="flex items-center gap-2 cursor-pointer text-sm">
                          <RadioGroupItem id={`ap-gender-${g.v}`} value={g.v} />
                          {g.l}
                        </label>
                      ))}
                    </RadioGroup>
                  ) : (
                    <p className="text-sm font-medium py-2 capitalize">{profile.gender || "—"}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Mobile number and email are verified and cannot be changed here.
              </div>

              {editingPersonal && (
                <div className="flex items-center gap-3 mt-6">
                  <Button onClick={savePersonal} disabled={savingPersonal} className="rounded-full px-6">
                    {savingPersonal ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Check className="mr-1 h-4 w-4" /> Save changes</>}
                  </Button>
                  <Button variant="ghost" onClick={cancelPersonal} disabled={savingPersonal} className="rounded-full">
                    <X className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                </div>
              )}
            </section>

            {/* Business Details (admins only — from admin approval application) */}
            {business && (
              <section className="bg-card rounded-3xl border border-border/60 shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" /> Business Details
                  </h2>
                  {business.status && (
                    <span className={`text-[10px] uppercase tracking-wide font-bold rounded-full px-2 py-0.5 border ${
                      business.status === "approved"
                        ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                        : business.status === "rejected"
                        ? "text-red-600 bg-red-50 border-red-200"
                        : "text-amber-600 bg-amber-50 border-amber-200"
                    }`}>
                      {business.status}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mb-5 gap-3">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Submitted fields are locked. You can fill in any details you left blank.
                  </p>
                  {!editingBusiness && emptyBusinessFields.length > 0 && (
                    <Button variant="ghost" size="sm" className="rounded-full text-primary shrink-0" onClick={startEditBusiness}>
                      <Plus className="h-4 w-4 mr-1" /> Add missing details
                    </Button>
                  )}
                </div>

                {editingBusiness && (
                  <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-4">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-primary" /> Fill in the details you left blank
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {emptyBusinessFields.map((f) => (
                        <div key={f.key} className={f.multiline ? "sm:col-span-2" : ""}>
                          <Label htmlFor={`biz-${f.key}`}>{f.label}</Label>
                          {f.multiline ? (
                            <Textarea
                              id={`biz-${f.key}`}
                              rows={2}
                              className="rounded-xl"
                              value={bForm[f.key] || ""}
                              onChange={(e) => setBForm((c) => ({ ...c, [f.key]: e.target.value }))}
                            />
                          ) : (
                            <Input
                              id={`biz-${f.key}`}
                              className="rounded-xl"
                              value={bForm[f.key] || ""}
                              onChange={(e) => setBForm((c) => ({ ...c, [f.key]: e.target.value }))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button onClick={saveBusiness} disabled={savingBusiness} className="rounded-full px-6">
                        {savingBusiness ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Check className="mr-1 h-4 w-4" /> Save details</>}
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingBusiness(false)} disabled={savingBusiness} className="rounded-full">
                        <X className="mr-1 h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    { label: "Business Name", value: business.businessName, icon: <Briefcase className="h-3.5 w-3.5" /> },
                    { label: "Business Type", value: business.businessType, icon: <Building2 className="h-3.5 w-3.5" /> },
                    { label: "Applicant Name", value: business.fullName, icon: null },
                    { label: "Contact Phone", value: business.phoneNumber ? `+91 ${String(business.phoneNumber).replace(/^(\+?91)?/, "")}` : null, icon: <Phone className="h-3.5 w-3.5" /> },
                    { label: "Application Email", value: business.email, icon: <Mail className="h-3.5 w-3.5" /> },
                    { label: "Website", value: business.website, icon: <Globe className="h-3.5 w-3.5" /> },
                    { label: "GST Number", value: business.gstNumber, icon: <FileText className="h-3.5 w-3.5" /> },
                    { label: "PAN Number", value: business.panNumber, icon: <FileText className="h-3.5 w-3.5" /> },
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">{f.icon}{f.label}</p>
                      <p className="text-sm font-medium mt-0.5 break-words">{f.value || "—"}</p>
                    </div>
                  ))}

                  {business.businessAddress && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Business Address</p>
                      <p className="text-sm font-medium mt-0.5 leading-relaxed">{business.businessAddress}</p>
                    </div>
                  )}

                  {business.notes && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-muted-foreground">Notes</p>
                      <p className="text-sm text-muted-foreground mt-0.5 italic">{business.notes}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Address Book */}
            <section className="bg-card rounded-3xl border border-border/60 shadow-sm p-6 sm:p-8">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> Address Book
                </h2>
                <span className="text-xs font-medium text-muted-foreground">{addrCount} / {MAX_ADDRESSES} saved</span>
              </div>
              <p className="text-sm text-muted-foreground mb-5">You can save up to {MAX_ADDRESSES} addresses.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.addresses.map((a) => (
                  <div key={a._id} className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2 relative">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-primary/10 text-primary px-2 py-0.5">
                        {a.addressType === "Office" ? <Building2 className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                        {a.addressType || a.label || "Home"}
                      </span>
                      {a.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          <Star className="h-2.5 w-2.5 fill-current" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-relaxed">
                      {[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[a.city, a.state, a.pincode].filter(Boolean).join(", ")}{a.country ? `, ${a.country}` : ""}
                    </p>
                    {a.alternatePhone ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Alt: {a.alternatePhone}</p>
                    ) : null}
                    {a.deliveryInstructions ? (
                      <p className="text-xs text-muted-foreground italic">&ldquo;{a.deliveryInstructions}&rdquo;</p>
                    ) : null}

                    <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => openEditAddress(a)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      {!a.isDefault && (
                        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => makeDefault(a._id)} disabled={busyAddrId === a._id}>
                          <Star className="h-3.5 w-3.5 mr-1" /> Set default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs text-destructive hover:text-destructive ml-auto"
                        onClick={() => deleteAddress(a._id)}
                        disabled={busyAddrId === a._id}
                      >
                        {busyAddrId === a._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Add new tile */}
                {canAddMore && (
                  <button
                    type="button"
                    onClick={openAddAddress}
                    className="rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary min-h-[160px]"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-sm font-semibold">Add new address</span>
                  </button>
                )}
              </div>

              {!canAddMore && (
                <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                  You&apos;ve reached the {MAX_ADDRESSES}-address limit. Remove one to add another.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </main>

      {/* Address editor modal */}
      {addrOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !savingAddr && setAddrOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <h3 className="text-lg font-bold">{addrEditingId ? "Edit address" : "Add new address"}</h3>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => !savingAddr && setAddrOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <Label>Address Type</Label>
                <RadioGroup
                  className="flex flex-wrap gap-3 pt-2"
                  value={addrForm.addressType}
                  onValueChange={(v) => setAddr("addressType", v as AddressInput["addressType"])}
                >
                  {(["Home", "Office", "Other"] as const).map((t) => (
                    <label key={t} htmlFor={`ae-${t}`} className={`flex items-center gap-2 cursor-pointer rounded-xl border px-4 py-2 text-sm transition-colors ${addrForm.addressType === t ? "border-primary bg-primary/5 text-primary font-semibold" : "border-input"}`}>
                      <RadioGroupItem id={`ae-${t}`} value={t} className="sr-only" />
                      {t}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="ae-line1">Address Line 1<Req /></Label>
                <Input id="ae-line1" className={`rounded-xl ${addrErrors.line1 ? "border-destructive" : ""}`} value={addrForm.line1} onChange={(e) => setAddr("line1", e.target.value)} placeholder="House / Flat no., Building, Street" />
                {addrErrors.line1 && <p className="text-xs text-destructive mt-1">{addrErrors.line1}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ae-line2">Address Line 2</Label>
                  <Input id="ae-line2" className="rounded-xl" value={addrForm.line2} onChange={(e) => setAddr("line2", e.target.value)} placeholder="Area, Colony (optional)" />
                </div>
                <div>
                  <Label htmlFor="ae-landmark">Landmark</Label>
                  <Input id="ae-landmark" className="rounded-xl" value={addrForm.landmark} onChange={(e) => setAddr("landmark", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <Label htmlFor="ae-pincode">PIN Code<Req /></Label>
                  <Input id="ae-pincode" inputMode="numeric" maxLength={6} className={`rounded-xl ${addrErrors.pincode ? "border-destructive" : ""}`} value={addrForm.pincode} onChange={(e) => setAddr("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit PIN" />
                  {addrErrors.pincode && <p className="text-xs text-destructive mt-1">{addrErrors.pincode}</p>}
                </div>
                <div>
                  <Label htmlFor="ae-city">City<Req /></Label>
                  <Input id="ae-city" className={`rounded-xl ${addrErrors.city ? "border-destructive" : ""}`} value={addrForm.city} onChange={(e) => setAddr("city", e.target.value)} />
                  {addrErrors.city && <p className="text-xs text-destructive mt-1">{addrErrors.city}</p>}
                </div>
                <div>
                  <Label htmlFor="ae-state">State<Req /></Label>
                  <select
                    id="ae-state"
                    className={`flex h-10 w-full items-center rounded-xl border bg-background px-3 text-sm ${addrErrors.state ? "border-destructive" : "border-input"}`}
                    value={addrForm.state}
                    onChange={(e) => setAddr("state", e.target.value)}
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {addrErrors.state && <p className="text-xs text-destructive mt-1">{addrErrors.state}</p>}
                </div>
                <div>
                  <Label htmlFor="ae-country">Country</Label>
                  <Input id="ae-country" className="rounded-xl" value={addrForm.country} onChange={(e) => setAddr("country", e.target.value)} />
                </div>
              </div>

              <div>
                <Label htmlFor="ae-alt">Alternate Mobile Number</Label>
                <Input id="ae-alt" inputMode="numeric" maxLength={10} className="rounded-xl" value={addrForm.alternatePhone} onChange={(e) => setAddr("alternatePhone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Optional" />
              </div>

              <div>
                <Label htmlFor="ae-instr">Delivery Instructions</Label>
                <Textarea id="ae-instr" rows={2} className="rounded-xl" value={addrForm.deliveryInstructions} onChange={(e) => setAddr("deliveryInstructions", e.target.value)} placeholder="Optional" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={Boolean(addrForm.isDefault)} onChange={(e) => setAddr("isDefault", e.target.checked)} />
                Set as default delivery address
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-background">
              <Button variant="ghost" className="rounded-full" onClick={() => setAddrOpen(false)} disabled={savingAddr}>Cancel</Button>
              <Button className="rounded-full px-6" onClick={saveAddress} disabled={savingAddr}>
                {savingAddr ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (addrEditingId ? "Save address" : "Add address")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
