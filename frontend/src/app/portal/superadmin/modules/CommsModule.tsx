"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  Megaphone,
  FileText,
  Users,
  ScrollText,
  Loader2,
  Send,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api/base-url";
import {
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  getAudienceCounts,
  listEmailCampaigns,
  sendEmailCampaign,
  listSubscribers,
  removeSubscriber,
  listEmailLogs,
  ErpEmailTemplate,
  ErpEmailCampaign,
  ErpAudienceCounts,
  ErpSubscriber,
  ErpEmailLogEntry,
} from "@/lib/api/erp";

type Tab = "campaigns" | "templates" | "subscribers" | "logs";

export function CommsModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("campaigns");
  const canCampaigns = has("comms.campaigns.view");
  const canTemplates = has("comms.templates.view");
  const canSubscribers = has("comms.subscribers.view");
  const canLogs = has("comms.logs.view");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b">
        {canCampaigns && (
          <TabButton active={tab === "campaigns"} onClick={() => setTab("campaigns")} icon={Megaphone}>
            Campaigns
          </TabButton>
        )}
        {canTemplates && (
          <TabButton active={tab === "templates"} onClick={() => setTab("templates")} icon={FileText}>
            Templates
          </TabButton>
        )}
        {canSubscribers && (
          <TabButton active={tab === "subscribers"} onClick={() => setTab("subscribers")} icon={Users}>
            Subscribers
          </TabButton>
        )}
        {canLogs && (
          <TabButton active={tab === "logs"} onClick={() => setTab("logs")} icon={ScrollText}>
            Email Logs
          </TabButton>
        )}
      </div>

      {tab === "campaigns" && canCampaigns && (
        <CampaignsPanel token={token} canSend={has("comms.campaigns.send")} />
      )}
      {tab === "templates" && canTemplates && (
        <TemplatesPanel token={token} canManage={has("comms.templates.manage")} />
      )}
      {tab === "subscribers" && canSubscribers && (
        <SubscribersPanel token={token} canManage={has("comms.subscribers.manage")} />
      )}
      {tab === "logs" && canLogs && <LogsPanel token={token} />}
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

const AUDIENCE_LABELS: Record<string, string> = {
  all_customers: "All customers",
  newsletter: "Newsletter subscribers",
  waitlist: "Waitlist",
  admins: "Admins & staff",
};

/* ────────────────────────── Campaigns ────────────────────────── */

function CampaignsPanel({ token, canSend }: { token: string; canSend: boolean }) {
  const [counts, setCounts] = useState<ErpAudienceCounts | null>(null);
  const [campaigns, setCampaigns] = useState<ErpEmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState("newsletter");
  const [body, setBody] = useState("");

  const reload = () => {
    setLoading(true);
    Promise.all([getAudienceCounts(token), listEmailCampaigns(token)])
      .then(([c, list]) => {
        setCounts(c);
        setCampaigns(list);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load campaigns"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const recipientCount = counts ? (counts.audiences as Record<string, number>)[audience] ?? 0 : 0;

  const send = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError("Campaign name, subject, and body are all required.");
      return;
    }
    if (!window.confirm(`Send "${name}" to ${recipientCount} ${AUDIENCE_LABELS[audience]} recipient(s)?`)) return;
    try {
      setSending(true);
      setError(null);
      setMessage(null);
      await sendEmailCampaign(token, { name: name.trim(), subject: subject.trim(), html: body, audience });
      setMessage(`Campaign "${name}" queued to ${recipientCount} recipient(s).`);
      setName("");
      setSubject("");
      setBody("");
      setTimeout(reload, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" /> New Campaign
          </CardTitle>
          <CardDescription>Compose a branded broadcast and send it to an audience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
          {counts && !counts.mailConfigured && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Mail transport isn&apos;t configured on the server — sending will fail until SMTP is set.
            </div>
          )}

          <Input placeholder="Campaign name (internal)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="newsletter">Newsletter subscribers ({counts?.audiences.newsletter ?? 0})</option>
              <option value="all_customers">All customers ({counts?.audiences.all_customers ?? 0})</option>
              <option value="waitlist">Waitlist ({counts?.audiences.waitlist ?? 0})</option>
              <option value="admins">Admins &amp; staff ({counts?.audiences.admins ?? 0})</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Body (HTML supported · wrapped in your brand template)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="<p>Hi there,</p><p>We just dropped a new collection…</p>"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>

          {canSend ? (
            <Button onClick={send} disabled={sending} className="gap-1">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to {recipientCount} recipient(s)
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">You have view-only access to campaigns.</p>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Campaigns</CardTitle>
          <Button size="sm" variant="ghost" onClick={reload} className="gap-1">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns sent yet.</p>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <Badge variant={c.status === "sent" ? "secondary" : c.status === "failed" ? "destructive" : "outline"}>
                    {c.status}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.subject}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {AUDIENCE_LABELS[c.audience] || c.audience} · {c.recipientCount} recipients · {c.sentCount} sent
                  {c.failedCount ? ` · ${c.failedCount} failed` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────────── Templates ────────────────────────── */

function TemplatesPanel({ token, canManage }: { token: string; canManage: boolean }) {
  const [templates, setTemplates] = useState<ErpEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", subject: "", html: "", description: "" });
  const [creating, setCreating] = useState(false);

  const reload = () => {
    setLoading(true);
    listEmailTemplates(token)
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load templates"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setDraft({ name: "", subject: "", html: "", description: "" });
  };

  const startEdit = (t: ErpEmailTemplate) => {
    setEditing(t.id);
    setCreating(false);
    setDraft({ name: t.name, subject: t.subject, html: t.html, description: t.description });
  };

  const save = async () => {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.html.trim()) {
      setError("Name, subject, and body are required.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      if (creating) {
        await createEmailTemplate(token, draft);
      } else if (editing) {
        await updateEmailTemplate(token, editing, draft);
      }
      setCreating(false);
      setEditing(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: ErpEmailTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await deleteEmailTemplate(token, t.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete template");
    }
  };

  const isEditorOpen = creating || editing !== null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Email Templates
          </CardTitle>
          <CardDescription>Reusable email content with {"{{placeholders}}"}.</CardDescription>
        </div>
        {canManage && !isEditorOpen && (
          <Button size="sm" variant="outline" className="gap-1" onClick={startCreate}>
            <Plus className="h-4 w-4" /> New
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isEditorOpen && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Input placeholder="Template name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            <Input placeholder="Subject" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
            <Input placeholder="Description (optional)" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            <textarea
              value={draft.html}
              onChange={(e) => setDraft((d) => ({ ...d, html: e.target.value }))}
              rows={8}
              placeholder="<p>Hi {{name}},</p>…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={busy} className="gap-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet.</p>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t.name} {t.system && <Badge variant="secondary" className="ml-1">System</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
              </div>
              {canManage && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startEdit(t)}>
                    Edit
                  </Button>
                  {!t.system && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────── Subscribers ────────────────────────── */

function SubscribersPanel({ token, canManage }: { token: string; canManage: boolean }) {
  const [rows, setRows] = useState<ErpSubscriber[]>([]);
  const [subscribed, setSubscribed] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const reload = () => {
    setLoading(true);
    listSubscribers(token, { limit: 100, search: search.trim() || undefined })
      .then((res) => {
        setRows(res.subscribers);
        setSubscribed(res.subscribed);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load subscribers"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const remove = async (s: ErpSubscriber) => {
    if (!window.confirm(`Remove ${s.email}?`)) return;
    try {
      await removeSubscriber(token, s.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove subscriber");
    }
  };

  const exportUrl = `${getApiBaseUrl()}/erp/comms/subscribers/export`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Newsletter Subscribers
          </CardTitle>
          <CardDescription>{subscribed} subscribed · {total} total</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={reload} className="gap-1">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <a href={exportUrl} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reload()}
            className="max-w-sm"
          />
          <Button size="sm" variant="outline" onClick={reload}>Search</Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscribers found.</p>
        ) : (
          rows.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{s.email}</p>
                <p className="text-xs text-muted-foreground">
                  {s.name || "—"} · {s.source} · {new Date(s.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.status === "subscribed" ? "secondary" : "outline"}>{s.status}</Badge>
                {canManage && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────── Email Logs ────────────────────────── */

function LogsPanel({ token }: { token: string }) {
  const [logs, setLogs] = useState<ErpEmailLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listEmailLogs(token, { page, limit: 25, status: statusFilter || undefined })
      .then((res) => {
        setLogs(res.logs);
        setTotalPages(res.totalPages || 1);
        setFailed(res.failed);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load email logs"))
      .finally(() => setLoading(false));
  }, [token, page, statusFilter]);

  const statusColor: Record<string, string> = {
    sent: "secondary",
    failed: "destructive",
    skipped: "outline",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4" /> Email Logs
          {failed > 0 && <Badge variant="destructive">{failed} failed</Badge>}
        </CardTitle>
        <CardDescription>Every email the system has attempted to send.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {["", "sent", "failed", "skipped"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {s === "" ? "All" : s}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No email logs yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.to} · {l.type} · {new Date(l.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <Badge variant={(statusColor[l.status] as "secondary" | "destructive" | "outline") || "outline"}>
                    {l.status}
                  </Badge>
                </div>
                {l.error && <p className="mt-1 text-xs text-destructive">{l.error}</p>}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
