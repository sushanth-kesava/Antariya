"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldCheck,
  Users,
  UserCog,
  Wallet,
  ShoppingCart,
  Heart,
  Package,
  XCircle,
  Clock3,
} from "lucide-react";
import {
  getSuperAdminDashboardFromBackend,
  ManagedRole,
  reviewAccessRequestOnBackend,
  SuperAdminAccessRequest,
  SuperAdminCustomerProfile,
  SuperAdminDashboardPayload,
  SuperAdminProfile,
  SuperadminRequestStatus,
  updateUserRoleOnBackend,
} from "@/lib/api/superadmin";
import { formatINR } from "@/lib/india";
import { clearAuthSession, getPortalPathForRole } from "@/lib/auth-session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

export default function SuperAdminPortalPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState("");
  const [user, setUser] = useState<any>(null);
  const [dashboard, setDashboard] = useState<SuperAdminDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState<SuperadminRequestStatus | "all">("pending");
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [roleTargetEmail, setRoleTargetEmail] = useState("");
  const [roleTarget, setRoleTarget] = useState<ManagedRole>("admin");
  const [updatingRole, setUpdatingRole] = useState(false);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      setMounted(true);
      const token = localStorage.getItem("app_auth_token");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok || !data?.success || !data?.user || data.user.role !== "superadmin") {
          if (data?.user?.role) {
            router.replace(getPortalPathForRole(data.user.role));
          } else {
            router.replace("/login");
          }

          return;
        }

        setAuthToken(token);
        setUser(data.user);
        const payload = await getSuperAdminDashboardFromBackend(token);
        setDashboard(payload);
      } catch (sessionError) {
        clearAuthSession();
        setError(sessionError instanceof Error ? sessionError.message : "Failed to load superadmin session.");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    void loadSession();
  }, [router]);

  const filteredRequests = useMemo(() => {
    const requests = dashboard?.accessRequests || [];
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus = requestStatus === "all" ? true : request.status === requestStatus;
      const matchesQuery =
        query.length === 0
          ? true
          : [request.title, request.message, request.requestedByEmail, request.targetEmail || "", request.targetName || "", request.requestType]
              .join(" ")
              .toLowerCase()
              .includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [dashboard?.accessRequests, requestStatus, search]);

  const handleReview = async (requestId: string, status: "approved" | "rejected") => {
    if (!authToken) {
      return;
    }

    try {
      setReviewingRequestId(requestId);
      const reviewNote = window.prompt("Optional review note:", "")?.trim() || undefined;
      const updated = await reviewAccessRequestOnBackend(authToken, requestId, status, reviewNote);

      setDashboard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          accessRequests: current.accessRequests.map((request) => (request.id === requestId ? updated : request)),
        };
      });
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Failed to review request.");
    } finally {
      setReviewingRequestId(null);
    }
  };

  const handleRoleUpdate = async () => {
    if (!authToken || updatingRole) {
      return;
    }

    const normalizedEmail = roleTargetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Email is required to update role.");
      return;
    }

    try {
      setUpdatingRole(true);
      setRoleSuccess(null);
      setError(null);

      const account = await updateUserRoleOnBackend(authToken, {
        email: normalizedEmail,
        role: roleTarget,
      });

      setDashboard((current) => {
        if (!current) {
          return current;
        }

        const customerProfiles = current.customerProfiles.filter(
          (profile) => profile.email.toLowerCase() !== account.email.toLowerCase()
        );

        const adminProfiles = current.adminProfiles.filter(
          (profile) => profile.email.toLowerCase() !== account.email.toLowerCase()
        );

        if (account.role === "customer") {
          customerProfiles.unshift({
            id: `manual-${account.email}`,
            email: account.email,
            displayName: account.email.split("@")[0],
            photoURL: null,
            role: "customer",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          adminProfiles.unshift({
            id: `manual-${account.email}`,
            email: account.email,
            displayName: account.email.split("@")[0],
            photoURL: null,
            role: account.role,
            active: account.active,
            loginCount: 0,
            lastAdminLoginAt: null,
            createdAt: new Date().toISOString(),
          });
        }

        return {
          ...current,
          adminProfiles,
          customerProfiles,
        };
      });

      setRoleSuccess(`${account.email} updated to ${account.role}.`);
      setRoleTargetEmail("");
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Failed to update role.");
    } finally {
      setUpdatingRole(false);
    }
  };

  const adminProfiles = dashboard?.adminProfiles || [];
  const customerProfiles = dashboard?.customerProfiles || [];

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Revenue",
      value: formatINR(Number(dashboard?.summary.totalRevenue || 0)),
      icon: Wallet,
      tone: "emerald",
      detail: `${dashboard?.summary.totalOrders || 0} orders`,
    },
    {
      label: "Admins",
      value: String(dashboard?.summary.totalAdmins || 0),
      icon: UserCog,
      tone: "blue",
      detail: `${dashboard?.summary.totalSuperAdmins || 0} super-admins`,
    },
    {
      label: "Customers",
      value: String(dashboard?.summary.totalCustomers || 0),
      icon: Users,
      tone: "violet",
      detail: `${dashboard?.summary.wishlistItems || 0} wishlisted items`,
    },
    {
      label: "Approvals",
      value: String(dashboard?.summary.pendingRequests || 0),
      icon: ShieldCheck,
      tone: "rose",
      detail: `${dashboard?.summary.pendingReviews || 0} review items`,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <Card className="rounded-[32px] border-gray-100 shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <Badge className="bg-white/10 text-white border-white/20 w-fit">Super Admin Console</Badge>
                <CardTitle className="text-4xl font-black tracking-tight">Full platform control</CardTitle>
                <CardDescription className="text-slate-200 text-base">
                  Manage admins, customers, access requests, and operational risks from a single supervisory dashboard.
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="rounded-full bg-white text-slate-900 hover:bg-slate-100">
                  <Link href="/portal/admin">
                    Open Admin Portal <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="rounded-full">
                  <Link href="/portal/customer">
                    Open Customer Portal <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                const palette = {
                  emerald: "border-emerald-100 bg-emerald-50/80 text-emerald-900",
                  blue: "border-blue-100 bg-blue-50/80 text-blue-900",
                  violet: "border-violet-100 bg-violet-50/80 text-violet-900",
                  rose: "border-rose-100 bg-rose-50/80 text-rose-900",
                } as const;

                return (
                  <div key={card.label} className={`rounded-2xl border p-4 ${palette[card.tone as keyof typeof palette]}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide font-semibold opacity-70">{card.label}</p>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-3xl font-black">{card.value}</p>
                    <p className="mt-1 text-sm opacity-80">{card.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="rounded-[28px] border-gray-100 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Shield className="h-5 w-5 text-slate-700" /> Access Requests</CardTitle>
                  <CardDescription>Approve or reject requests for admin and super-admin access.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      title="Request status filter"
                      aria-label="Request status filter"
                      value={requestStatus}
                      onChange={(event) => setRequestStatus(event.target.value as SuperadminRequestStatus | "all")}
                      className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="all">All</option>
                    </select>
                    <Input
                      placeholder="Search requests"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="h-11 rounded-xl border-gray-200 bg-gray-50"
                    />
                    <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={() => { setSearch(""); setRequestStatus("pending"); }}>
                      Clear
                    </Button>
                  </div>

                  {filteredRequests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-muted-foreground">
                      No access requests match the current filters.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                      {filteredRequests.map((request) => (
                        <div key={request.id} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">{request.title}</p>
                              <p className="text-xs text-gray-500">{request.requestedByEmail} • {request.requestType}</p>
                              <p className="text-xs text-gray-500">{request.targetEmail ? `Target: ${request.targetEmail}` : "No target email"}</p>
                            </div>
                            <Badge variant="secondary" className="uppercase tracking-wide rounded-full">{request.status}</Badge>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{request.message}</p>
                          <div className="flex flex-wrap gap-2">
                            {request.requestedScopes.map((scope) => (
                              <Badge key={scope} variant="outline" className="rounded-full">{scope}</Badge>
                            ))}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-full"
                              disabled={reviewingRequestId === request.id || request.status !== "pending"}
                              onClick={() => handleReview(request.id, "approved")}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="rounded-full"
                              disabled={reviewingRequestId === request.id || request.status !== "pending"}
                              onClick={() => handleReview(request.id, "rejected")}
                            >
                              <XCircle className="mr-2 h-4 w-4" /> Reject
                            </Button>
                          </div>
                          {request.reviewNote ? (
                            <p className="text-xs text-gray-500 rounded-xl bg-white px-3 py-2 border border-gray-200">Review note: {request.reviewNote}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-gray-100 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><UserCog className="h-5 w-5 text-slate-700" /> Platform Profiles</CardTitle>
                  <CardDescription>Review all admin and customer profiles and manage account roles directly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-800">Role Manager</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        placeholder="email@example.com"
                        value={roleTargetEmail}
                        onChange={(event) => setRoleTargetEmail(event.target.value)}
                        className="h-11 rounded-xl border-gray-200 bg-white"
                      />
                      <select
                        title="Role target"
                        aria-label="Role target"
                        value={roleTarget}
                        onChange={(event) => setRoleTarget(event.target.value as ManagedRole)}
                        className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="customer">customer</option>
                        <option value="admin">admin</option>
                      </select>
                      <Button
                        type="button"
                        className="h-11 rounded-xl"
                        onClick={handleRoleUpdate}
                        disabled={updatingRole}
                      >
                        {updatingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Update Role
                      </Button>
                    </div>
                    {roleSuccess ? (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{roleSuccess}</p>
                    ) : null}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-800">Admin Profiles</p>
                      <Badge variant="secondary" className="rounded-full">{adminProfiles.length}</Badge>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {adminProfiles.map((profile: SuperAdminProfile) => (
                        <div key={profile.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{profile.displayName}</p>
                            <p className="text-xs text-gray-500">{profile.email} • {profile.role}</p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <p>{profile.active ? "Active" : "Inactive"}</p>
                            <p>Logins: {profile.loginCount}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-800">Customer Profiles</p>
                      <Badge variant="secondary" className="rounded-full">{customerProfiles.length}</Badge>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {customerProfiles.slice(0, 8).map((profile: SuperAdminCustomerProfile) => (
                        <div key={profile.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{profile.displayName}</p>
                            <p className="text-xs text-gray-500">{profile.email}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full">customer</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-[28px] border-gray-100 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><Clock3 className="h-5 w-5 text-slate-700" /> Operational Signals</CardTitle>
                <CardDescription>Quick readouts that help the super-admin decide what needs immediate attention.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Low Stock</p>
                  <p className="mt-2 text-2xl font-black text-gray-900 flex items-center gap-2"><Package className="h-5 w-5" />{dashboard?.summary.lowStockProducts || 0}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Pending Reviews</p>
                  <p className="mt-2 text-2xl font-black text-gray-900 flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{dashboard?.summary.pendingReviews || 0}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Wishlist Items</p>
                  <p className="mt-2 text-2xl font-black text-gray-900 flex items-center gap-2"><Heart className="h-5 w-5" />{dashboard?.summary.wishlistItems || 0}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Super-admins</p>
                  <p className="mt-2 text-2xl font-black text-gray-900 flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{dashboard?.summary.totalSuperAdmins || 0}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Total Orders</p>
                  <p className="mt-2 text-2xl font-black text-gray-900 flex items-center gap-2"><ShoppingCart className="h-5 w-5" />{dashboard?.summary.totalOrders || 0}</p>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
