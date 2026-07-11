"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCog,
  ShieldQuestion,
  Loader2,
  Check,
  X,
  SlidersHorizontal,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getSuperAdminDashboardFromBackend,
  reviewAccessRequestOnBackend,
  updateUserRoleOnBackend,
  SuperAdminDashboardPayload,
} from "@/lib/api/superadmin";
import {
  ErpModule,
  ErpRole,
  getPermissionCatalog,
  listRoles,
  updateUserPermissions,
} from "@/lib/api/erp";

type Tab = "staff" | "requests" | "overrides";

export function PeopleModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("staff");
  const canReview = has("hr.access_requests.review");
  const canOverride = has("hr.permissions.override");

  const [dashboard, setDashboard] = useState<SuperAdminDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    getSuperAdminDashboardFromBackend(token)
      .then(setDashboard)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load people data"));

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b">
        <TabButton active={tab === "staff"} onClick={() => setTab("staff")} icon={UserCog}>
          Staff &amp; Customers
        </TabButton>
        {canReview && (
          <TabButton active={tab === "requests"} onClick={() => setTab("requests")} icon={ShieldQuestion}>
            Access Requests
            {dashboard?.summary.pendingRequests ? (
              <Badge variant="destructive" className="ml-1">
                {dashboard.summary.pendingRequests}
              </Badge>
            ) : null}
          </TabButton>
        )}
        {canOverride && (
          <TabButton active={tab === "overrides"} onClick={() => setTab("overrides")} icon={SlidersHorizontal}>
            Permission Overrides
          </TabButton>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === "staff" && <StaffPanel token={token} dashboard={dashboard} onChanged={reload} canManage={has("hr.roles.assign")} />}
      {tab === "requests" && canReview && (
        <RequestsPanel token={token} dashboard={dashboard} onChanged={reload} />
      )}
      {tab === "overrides" && canOverride && <OverridesPanel token={token} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/* ────────────────────────── Staff Panel ────────────────────────── */

function StaffPanel({
  token,
  dashboard,
  onChanged,
  canManage,
}: {
  token: string;
  dashboard: SuperAdminDashboardPayload | null;
  onChanged: () => void;
  canManage: boolean;
}) {
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const admins = dashboard?.adminProfiles || [];
  const customers = dashboard?.customerProfiles || [];

  const filteredAdmins = admins.filter((a) => a.email.toLowerCase().includes(query.toLowerCase()));
  const filteredCustomers = customers.filter((c) => c.email.toLowerCase().includes(query.toLowerCase()));

  const setRole = async (email: string, role: "customer" | "admin") => {
    try {
      setBusyEmail(email);
      setError(null);
      await updateUserRoleOnBackend(token, { email, role });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setBusyEmail(null);
    }
  };

  if (!dashboard) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by email…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4" /> Admins &amp; Superadmins ({filteredAdmins.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredAdmins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching admins.</p>
          ) : (
            filteredAdmins.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{a.displayName}</p>
                  <p className="text-xs text-muted-foreground">{a.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.role === "superadmin" ? "default" : "secondary"}>{a.role}</Badge>
                  {a.active ? (
                    <Badge variant="outline" className="text-green-600">active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">inactive</Badge>
                  )}
                  {canManage && a.role !== "superadmin" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyEmail === a.email}
                      onClick={() => setRole(a.email, "customer")}
                    >
                      {busyEmail === a.email ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Demote to customer"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Customers ({filteredCustomers.length})
          </CardTitle>
          <CardDescription>Promote a customer to admin to grant portal access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching customers.</p>
          ) : (
            filteredCustomers.slice(0, 50).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{c.displayName}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyEmail === c.email}
                    onClick={() => setRole(c.email, "admin")}
                  >
                    {busyEmail === c.email ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Promote to admin"}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────────── Requests Panel ────────────────────────── */

function RequestsPanel({
  token,
  dashboard,
  onChanged,
}: {
  token: string;
  dashboard: SuperAdminDashboardPayload | null;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requests = (dashboard?.accessRequests || []).filter((r) => r.status === "pending");

  const review = async (id: string, status: "approved" | "rejected") => {
    try {
      setBusyId(id);
      setError(null);
      await reviewAccessRequestOnBackend(token, id, status);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to review request");
    } finally {
      setBusyId(null);
    }
  };

  if (!dashboard) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No pending access requests.
          </CardContent>
        </Card>
      ) : (
        requests.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="max-w-xl">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.targetEmail || r.requestedByEmail} · {new Date(r.createdAt).toLocaleDateString("en-IN")}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{r.message}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busyId === r.id} onClick={() => review(r.id, "approved")} className="gap-1">
                  {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === r.id}
                  onClick={() => review(r.id, "rejected")}
                  className="gap-1 text-destructive"
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

/* ────────────────────────── Overrides Panel ────────────────────────── */

function OverridesPanel({ token }: { token: string }) {
  const [modules, setModules] = useState<ErpModule[]>([]);
  const [roles, setRoles] = useState<ErpRole[]>([]);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [custom, setCustom] = useState<Set<string>>(new Set());
  const [denied, setDenied] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPermissionCatalog(token), listRoles(token)])
      .then(([cat, rs]) => {
        setModules(cat.modules);
        setRoles(rs);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load catalog"))
      .finally(() => setLoading(false));
  }, [token]);

  const cycle = (key: string) => {
    // cycle: neutral → granted → denied → neutral
    setCustom((c) => {
      const nc = new Set(c);
      setDenied((d) => {
        const nd = new Set(d);
        if (!nc.has(key) && !nd.has(key)) {
          nc.add(key);
        } else if (nc.has(key)) {
          nc.delete(key);
          nd.add(key);
        } else {
          nd.delete(key);
        }
        return nd;
      });
      return nc;
    });
  };

  const stateOf = (key: string): "granted" | "denied" | "neutral" =>
    custom.has(key) ? "granted" : denied.has(key) ? "denied" : "neutral";

  const handleSave = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter the staff email to apply overrides to.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const result = await updateUserPermissions(token, {
        email: normalizedEmail,
        roleKey: roleKey || undefined,
        customPermissions: [...custom],
        deniedPermissions: [...denied],
      });
      setMessage(
        `Saved. ${result.email} now has ${result.effectivePermissions.length} effective permission(s).`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save overrides");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" /> Per-user Permission Overrides
        </CardTitle>
        <CardDescription>
          Assign a role and layer individual grants/denials on top. Click a permission to cycle:
          <span className="mx-1 font-medium text-green-600">grant</span>→
          <span className="mx-1 font-medium text-destructive">deny</span>→ neutral.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Staff email</label>
            <Input placeholder="person@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign role (optional)</label>
            <select
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— keep current —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.key} className="rounded-lg border">
              <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">{mod.label}</div>
              <div className="flex flex-wrap gap-2 p-3">
                {mod.permissions.map((perm) => {
                  const state = stateOf(perm.key);
                  return (
                    <button
                      key={perm.key}
                      onClick={() => cycle(perm.key)}
                      title={perm.description}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        state === "granted" && "border-green-500 bg-green-500/10 text-green-700",
                        state === "denied" && "border-destructive bg-destructive/10 text-destructive line-through",
                        state === "neutral" && "border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {perm.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save overrides
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
