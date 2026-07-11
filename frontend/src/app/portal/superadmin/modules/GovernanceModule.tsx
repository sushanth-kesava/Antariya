"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  ScrollText,
  Lock,
  Plus,
  Trash2,
  Save,
  Loader2,
  Check,
  Bug,
  Gauge,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ErpModule,
  ErpRole,
  ErpAuditEntry,
  getPermissionCatalog,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listAuditLog,
  listErrorLogs,
  updateErrorLog,
  purgeErrorLogs,
  listRateLimits,
  updateRateLimit,
  ErpErrorEntry,
  ErpRateLimitRule,
  ErpRateLimitActivity,
} from "@/lib/api/erp";

type Tab = "roles" | "audit" | "errors" | "ratelimits";

export function GovernanceModule({
  token,
  has,
}: {
  token: string;
  has: (key: string) => boolean;
}) {
  const [tab, setTab] = useState<Tab>("roles");
  const canManageRoles = has("governance.roles.manage");
  const canViewAudit = has("governance.audit.view");
  const canViewErrors = has("governance.errors.view");
  const canViewRateLimits = has("governance.ratelimit.view");

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b">
        <TabButton active={tab === "roles"} onClick={() => setTab("roles")} icon={ShieldCheck}>
          Roles &amp; Permissions
        </TabButton>
        {canViewAudit && (
          <TabButton active={tab === "audit"} onClick={() => setTab("audit")} icon={ScrollText}>
            Audit Trail
          </TabButton>
        )}
        {canViewErrors && (
          <TabButton active={tab === "errors"} onClick={() => setTab("errors")} icon={Bug}>
            Error Logs
          </TabButton>
        )}
        {canViewRateLimits && (
          <TabButton active={tab === "ratelimits"} onClick={() => setTab("ratelimits")} icon={Gauge}>
            Rate Limits
          </TabButton>
        )}
      </div>

      {tab === "roles" && <RolesPanel token={token} canManage={canManageRoles} />}
      {tab === "audit" && canViewAudit && <AuditPanel token={token} />}
      {tab === "errors" && canViewErrors && <ErrorsPanel token={token} canManage={has("governance.errors.manage")} />}
      {tab === "ratelimits" && canViewRateLimits && <RateLimitsPanel token={token} canManage={has("governance.ratelimit.manage")} />}
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
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/* ────────────────────────── Roles Panel ────────────────────────── */

function RolesPanel({ token, canManage }: { token: string; canManage: boolean }) {
  const [modules, setModules] = useState<ErpModule[]>([]);
  const [roles, setRoles] = useState<ErpRole[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editor state
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // create-role state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");

  useEffect(() => {
    Promise.all([getPermissionCatalog(token), listRoles(token)])
      .then(([cat, rs]) => {
        setModules(cat.modules);
        setRoles(rs);
        setSelectedId((prev) => prev || rs[0]?.id || null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load governance data"))
      .finally(() => setLoading(false));
  }, [token]);

  const selected = useMemo(() => roles.find((r) => r.id === selectedId) || null, [roles, selectedId]);

  useEffect(() => {
    if (selected) {
      setDraft(new Set(selected.permissions));
      setSavedFlash(false);
    }
  }, [selected]);

  const isWildcard = selected?.permissions.includes("*");
  const editable = canManage && selected && !selected.locked;

  const dirty = useMemo(() => {
    if (!selected) return false;
    const current = new Set(selected.permissions);
    if (current.size !== draft.size) return true;
    for (const p of draft) if (!current.has(p)) return true;
    return false;
  }, [selected, draft]);

  const togglePermission = (key: string) => {
    if (!editable) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModule = (mod: ErpModule, on: boolean) => {
    if (!editable) return;
    setDraft((prev) => {
      const next = new Set(prev);
      mod.permissions.forEach((p) => (on ? next.add(p.key) : next.delete(p.key)));
      return next;
    });
  };

  const handleSave = async () => {
    if (!selected || !editable) return;
    try {
      setSaving(true);
      setError(null);
      const updated = await updateRole(token, selected.id, { permissions: [...draft] });
      setRoles((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      setSaving(true);
      setError(null);
      const role = await createRole(token, {
        key: (newKey.trim() || name).toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        name,
        permissions: [],
      });
      setRoles((rs) => [...rs, role]);
      setSelectedId(role.id);
      setCreating(false);
      setNewName("");
      setNewKey("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: ErpRole) => {
    if (!window.confirm(`Delete the "${role.name}" role? This cannot be undone.`)) return;
    try {
      setError(null);
      await deleteRole(token, role.id);
      setRoles((rs) => rs.filter((r) => r.id !== role.id));
      setSelectedId((id) => (id === role.id ? null : id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete role");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      {/* Role list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Roles</h3>
          {canManage && (
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={() => setCreating((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          )}
        </div>

        {creating && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Input placeholder="Role name (e.g. Warehouse Lead)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8" />
            <Input placeholder="key (optional, auto)" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="h-8" />
            <div className="flex gap-2">
              <Button size="sm" className="h-7" onClick={handleCreate} disabled={saving || !newName.trim()}>
                Create
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedId(role.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selectedId === role.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-2">
                {role.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                <span className="font-medium">{role.name}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                {role.permissions.includes("*") ? "ALL" : role.permissions.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Permission editor */}
      <div>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!selected ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Select a role to view or edit its permissions.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selected.name}
                    {selected.system && <Badge variant="secondary">System</Badge>}
                    {selected.locked && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" /> Locked
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{selected.description || "No description."}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {editable && (
                    <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedFlash ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                      {savedFlash ? "Saved" : "Save"}
                    </Button>
                  )}
                  {canManage && !selected.system && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(selected)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {isWildcard ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="flex items-center gap-2 font-medium text-primary">
                    <ShieldCheck className="h-4 w-4" /> Full access (wildcard)
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    This role holds every permission and cannot be limited.
                  </p>
                </div>
              ) : (
                modules.map((mod) => {
                  const total = mod.permissions.length;
                  const on = mod.permissions.filter((p) => draft.has(p.key)).length;
                  const allOn = on === total;
                  return (
                    <div key={mod.key} className="rounded-lg border">
                      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                        <p className="text-sm font-semibold">{mod.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {on}/{total}
                          </span>
                          {editable && (
                            <button
                              onClick={() => toggleModule(mod, !allOn)}
                              className="text-[11px] font-medium text-primary hover:underline"
                            >
                              {allOn ? "Clear" : "Select all"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="divide-y">
                        {mod.permissions.map((perm) => {
                          const checked = draft.has(perm.key);
                          return (
                            <label
                              key={perm.key}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 px-4 py-2.5 text-sm",
                                !editable && "cursor-default opacity-90"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!editable}
                                onChange={() => togglePermission(perm.key)}
                                className="mt-0.5 h-4 w-4 rounded border-muted-foreground/40"
                              />
                              <span>
                                <span className="font-medium">{perm.label}</span>
                                <span className="block text-xs text-muted-foreground">{perm.description}</span>
                                <code className="text-[10px] text-muted-foreground/70">{perm.key}</code>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── Audit Panel ────────────────────────── */

function AuditPanel({ token }: { token: string }) {
  const [entries, setEntries] = useState<ErpAuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listAuditLog(token, { page, limit: 25 })
      .then((res) => {
        setEntries(res.entries);
        setTotalPages(res.totalPages || 1);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [token, page]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" /> Audit Trail
        </CardTitle>
        <CardDescription>Every privileged action taken in the ERP portal.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No audit entries yet. Privileged actions will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={e.status === "success" ? "secondary" : "destructive"}>{e.action}</Badge>
                  {e.module && <Badge variant="outline">{e.module}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="mt-1.5">{e.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  by {e.actorEmail || "unknown"}
                  {e.targetLabel ? ` → ${e.targetLabel}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────── Errors Panel ────────────────────────── */

function ErrorsPanel({ token, canManage }: { token: string; canManage: boolean }) {
  const [entries, setEntries] = useState<ErpErrorEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unresolved, setUnresolved] = useState(0);
  const [showResolved, setShowResolved] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    listErrorLogs(token, { page, limit: 25, resolved: showResolved ? undefined : false })
      .then((res) => {
        setEntries(res.entries);
        setTotalPages(res.totalPages || 1);
        setUnresolved(res.unresolved);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load error logs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, showResolved]);

  const toggleResolved = async (entry: ErpErrorEntry) => {
    try {
      await updateErrorLog(token, entry.id, !entry.resolved);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update error");
    }
  };

  const purge = async () => {
    if (!window.confirm("Purge all resolved error entries? This cannot be undone.")) return;
    try {
      await purgeErrorLogs(token, "resolved");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to purge");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" /> Error Logs
              {unresolved > 0 && <Badge variant="destructive">{unresolved} unresolved</Badge>}
            </CardTitle>
            <CardDescription>Server-side (5xx) errors captured at runtime, grouped by signature.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
              Show resolved
            </label>
            <Button size="sm" variant="ghost" onClick={reload} className="gap-1">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            {canManage && (
              <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={purge}>
                <Trash2 className="h-4 w-4" /> Purge resolved
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No errors logged. Your backend is healthy. 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className={cn("rounded-md border p-3", e.resolved && "opacity-60")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">{e.statusCode}</Badge>
                      <Badge variant="outline">{e.name}</Badge>
                      {e.count > 1 && <Badge variant="secondary">×{e.count}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.lastSeenAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{e.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.method} {e.path} {e.actorEmail ? `· ${e.actorEmail}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.stack && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                        {expanded === e.id ? "Hide" : "Stack"}
                      </Button>
                    )}
                    {canManage && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => toggleResolved(e)}>
                        {e.resolved ? "Reopen" : "Resolve"}
                      </Button>
                    )}
                  </div>
                </div>
                {expanded === e.id && e.stack && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/50 p-3 text-[11px] leading-relaxed">
                    {e.stack}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────── Rate Limits Panel ────────────────────────── */

function msToMinutes(ms: number): string {
  const m = ms / 60000;
  return Number.isInteger(m) ? `${m}` : m.toFixed(1);
}

function RateLimitsPanel({ token, canManage }: { token: string; canManage: boolean }) {
  const [rules, setRules] = useState<ErpRateLimitRule[]>([]);
  const [activity, setActivity] = useState<ErpRateLimitActivity>({});
  const [drafts, setDrafts] = useState<Record<string, { windowMin: string; max: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    listRateLimits(token)
      .then(({ rules, activity }) => {
        setRules(rules);
        setActivity(activity);
        const d: Record<string, { windowMin: string; max: string }> = {};
        rules.forEach((r) => (d[r.id] = { windowMin: msToMinutes(r.windowMs), max: String(r.max) }));
        setDrafts(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load rate limits"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const save = async (rule: ErpRateLimitRule) => {
    const draft = drafts[rule.id];
    if (!draft) return;
    const windowMs = Math.round(Number(draft.windowMin) * 60000);
    const max = Math.round(Number(draft.max));
    try {
      setBusyId(rule.id);
      setError(null);
      const updated = await updateRateLimit(token, rule.id, { windowMs, max });
      setRules((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update rule");
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (rule: ErpRateLimitRule) => {
    try {
      setBusyId(rule.id);
      const updated = await updateRateLimit(token, rule.id, { enabled: !rule.enabled });
      setRules((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle rule");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading rate limits…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" /> Rate Limits
            </CardTitle>
            <CardDescription>Throttle abusive traffic. Changes apply within ~30s.</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={reload} className="gap-1">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {rules.map((rule) => {
          const act = activity[rule.key];
          const draft = drafts[rule.id] || { windowMin: msToMinutes(rule.windowMs), max: String(rule.max) };
          return (
            <div key={rule.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {rule.label}
                    <Badge variant={rule.enabled ? "secondary" : "outline"}>
                      {rule.enabled ? "enabled" : "disabled"}
                    </Badge>
                    <code className="text-[10px] text-muted-foreground">{rule.scope}</code>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{rule.description}</p>
                </div>
                {canManage && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busyId === rule.id} onClick={() => toggle(rule)}>
                    {rule.enabled ? "Disable" : "Enable"}
                  </Button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Window (minutes)</label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={draft.windowMin}
                    disabled={!canManage}
                    onChange={(ev) => setDrafts((d) => ({ ...d, [rule.id]: { ...draft, windowMin: ev.target.value } }))}
                    className="h-8 w-28"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Max requests</label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.max}
                    disabled={!canManage}
                    onChange={(ev) => setDrafts((d) => ({ ...d, [rule.id]: { ...draft, max: ev.target.value } }))}
                    className="h-8 w-28"
                  />
                </div>
                {canManage && (
                  <Button size="sm" className="h-8 gap-1" disabled={busyId === rule.id} onClick={() => save(rule)}>
                    {busyId === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                )}
                {act && (
                  <div className="ml-auto text-right text-[11px] text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{act.allowed}</span> allowed ·{" "}
                      <span className="font-medium text-destructive">{act.blocked}</span> blocked
                    </p>
                    {act.lastBlockedAt && <p>last block {new Date(act.lastBlockedAt).toLocaleTimeString("en-IN")}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
