"use client";

import { useEffect, useState } from "react";
import { X, Loader2, User as UserIcon, Pencil, Check, Mail, Phone, Calendar, Award, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CustomerProfileData,
  getCustomerProfileFromBackend,
  updateCustomerProfileOnBackend,
} from "@/lib/api/customerProfile";
import { formatINR } from "@/lib/india";

type ProfileSidebarProps = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save so the parent can refresh (e.g. navbar name). */
  onSaved?: (profile: CustomerProfileData) => void;
};

const GENDERS: { value: "male" | "female" | "other"; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export function ProfileSidebar({ open, onClose, onSaved }: ProfileSidebarProps) {
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    gender: "" as "" | "male" | "female" | "other",
    dateOfBirth: "",
    newsletter: true,
    smsAlerts: false,
  });

  useEffect(() => {
    if (!open) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("app_auth_token") : null;
    if (!token) {
      setError("Please log in to view your profile.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getCustomerProfileFromBackend(token)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setForm({
          displayName: data.displayName || "",
          phone: data.phone || "",
          gender: data.gender || "",
          dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "",
          newsletter: data.preferences?.newsletter ?? true,
          smsAlerts: data.preferences?.smsAlerts ?? false,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleSave = async () => {
    const token = localStorage.getItem("app_auth_token");
    if (!token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateCustomerProfileOnBackend(token, {
        displayName: form.displayName,
        phone: form.phone,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        preferences: {
          categories: profile?.preferences?.categories || [],
          newsletter: form.newsletter,
          smsAlerts: form.smsAlerts,
        },
      });
      setProfile(updated);
      setEditing(false);
      setMessage("Profile updated.");
      onSaved?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setForm({
        displayName: profile.displayName || "",
        phone: profile.phone || "",
        gender: profile.gender || "",
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
        newsletter: profile.preferences?.newsletter ?? true,
        smsAlerts: profile.preferences?.smsAlerts ?? false,
      });
    }
    setEditing(false);
    setError(null);
  };

  if (!open) return null;

  const initial = (profile?.displayName || profile?.email || "U").charAt(0).toUpperCase();
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })
    : "—";

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-background shadow-2xl flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold font-headline">My Profile</h2>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose} aria-label="Close profile">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error && !profile ? (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
          ) : profile ? (
            <>
              {/* Identity */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                  {profile.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-primary">{initial}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold truncate">{profile.displayName || "Your name"}</p>
                  <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {profile.email}
                  </p>
                </div>
              </div>

              {/* Read-only registration snapshot */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><Award className="h-3.5 w-3.5" /> Membership</p>
                  <p className="text-sm font-bold mt-1 capitalize">{profile.membershipTier}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" /> Orders</p>
                  <p className="text-sm font-bold mt-1">{profile.totalOrders}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Total Spend</p>
                  <p className="text-sm font-bold mt-1">{formatINR(Number(profile.totalSpend || 0))}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Member Since</p>
                  <p className="text-sm font-bold mt-1">{memberSince}</p>
                </div>
              </div>

              {/* Editable details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Personal Details</h3>
                  {!editing ? (
                    <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  ) : null}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Full Name</label>
                  {editing ? (
                    <Input
                      value={form.displayName}
                      onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))}
                      className="h-11 rounded-xl border-border bg-muted/50"
                    />
                  ) : (
                    <p className="text-sm font-medium py-2">{profile.displayName || "—"}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone</label>
                  {editing ? (
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="h-11 rounded-xl border-border bg-muted/50"
                    />
                  ) : (
                    <p className="text-sm font-medium py-2">{profile.phone || "—"}</p>
                  )}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Gender</label>
                  {editing ? (
                    <div className="flex gap-2">
                      {GENDERS.map((g) => (
                        <Button
                          key={g.value}
                          type="button"
                          size="sm"
                          variant={form.gender === g.value ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => setForm((c) => ({ ...c, gender: g.value }))}
                        >
                          {g.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium py-2 capitalize">{profile.gender || "—"}</p>
                  )}
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Date of Birth</label>
                  {editing ? (
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => setForm((c) => ({ ...c, dateOfBirth: e.target.value }))}
                      className="h-11 rounded-xl border-border bg-muted/50"
                    />
                  ) : (
                    <p className="text-sm font-medium py-2">
                      {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-IN") : "—"}
                    </p>
                  )}
                </div>

                {/* Preferences */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-muted-foreground">Communication</label>
                  <label className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
                    <span className="text-sm">Newsletter emails</span>
                    <input
                      type="checkbox"
                      checked={form.newsletter}
                      disabled={!editing}
                      onChange={(e) => setForm((c) => ({ ...c, newsletter: e.target.checked }))}
                      className="h-4 w-4 accent-primary disabled:opacity-60"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
                    <span className="text-sm">SMS alerts</span>
                    <input
                      type="checkbox"
                      checked={form.smsAlerts}
                      disabled={!editing}
                      onChange={(e) => setForm((c) => ({ ...c, smsAlerts: e.target.checked }))}
                      className="h-4 w-4 accent-primary disabled:opacity-60"
                    />
                  </label>
                </div>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            </>
          ) : null}
        </div>

        {/* Footer actions (only in edit mode) */}
        {profile && editing ? (
          <div className="border-t border-border px-6 py-4 flex items-center gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Save Changes</>}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
