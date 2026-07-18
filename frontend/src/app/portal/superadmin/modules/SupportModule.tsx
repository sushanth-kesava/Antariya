"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Headphones, BarChart3, Plus, RefreshCw, Search, MessageSquare, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button"; import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; import { Badge } from "@/components/ui/badge"; import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getSupportDashboard, getSupportTickets, createSupportTicket, updateTicketStatus, addTicketNote, type SupportTicket, type SupportDashboard } from "@/lib/api/support";

type Tab = "dashboard" | "tickets";

export function SupportModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b pb-px">
        <button onClick={() => setTab("dashboard")} className={cn("flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium", tab === "dashboard" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}><BarChart3 className="h-4 w-4" />Dashboard</button>
        <button onClick={() => setTab("tickets")} className={cn("flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium", tab === "tickets" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}><Headphones className="h-4 w-4" />Tickets</button>
      </div>
      {tab === "dashboard" && <DashPanel token={token} />}
      {tab === "tickets" && <TicketsPanel token={token} />}
    </div>
  );
}

function DashPanel({ token }: { token: string }) {
  const [stats, setStats] = useState<SupportDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getSupportDashboard(token).then(setStats).catch(() => {}).finally(() => setLoading(false)); }, [token]);
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!stats) return <p className="text-center text-muted-foreground">Failed to load</p>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Open Tickets</p><p className="text-2xl font-bold text-red-600">{stats.openTickets}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">In Progress</p><p className="text-2xl font-bold text-orange-600">{stats.inProgress}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Resolution Rate</p><p className="text-2xl font-bold text-green-600">{stats.resolutionRate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg Response</p><p className="text-2xl font-bold">{stats.avgResponseHours}h</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-sm">Top Issue Categories</CardTitle></CardHeader><CardContent>
        {stats.topCategories.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> :
          <ul className="space-y-2">{stats.topCategories.map(c => <li key={c._id} className="flex justify-between text-sm"><span className="capitalize">{c._id?.replace(/_/g, ' ')}</span><Badge variant="secondary">{c.count}</Badge></li>)}</ul>}
      </CardContent></Card>
    </div>
  );
}

function TicketsPanel({ token }: { token: string }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerPhone: "", category: "order_issue", subject: "", description: "", priority: "medium", source: "manual" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [noteTicketId, setNoteTicketId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await getSupportTickets(token, { status: statusFilter || undefined, search: search || undefined }); setTickets(res.tickets); } catch {}
    setLoading(false);
  }, [token, statusFilter, search]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.customerName || !form.subject || !form.description) { setFormError("Fill required fields"); return; }
    setSaving(true); setFormError(null);
    try { await createSupportTicket(token, form); setShowCreate(false); load(); } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  };

  const handleStatus = async (id: string, status: string) => { try { await updateTicketStatus(token, id, status); load(); } catch {} };
  const handleNote = async () => {
    if (!noteTicketId || !noteText.trim()) return;
    try { await addTicketNote(token, noteTicketId, noteText); setNoteTicketId(null); setNoteText(""); load(); } catch {}
  };

  const priorityColor: Record<string, string> = { low: "text-gray-500", medium: "text-blue-500", high: "text-orange-500", urgent: "text-red-600" };
  const statusColor: Record<string, string> = { open: "bg-red-100 text-red-700", assigned: "bg-blue-100 text-blue-700", in_progress: "bg-yellow-100 text-yellow-700", waiting_customer: "bg-purple-100 text-purple-700", resolved: "bg-green-100 text-green-700", closed: "bg-gray-100 text-gray-700", escalated: "bg-red-200 text-red-800" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} className="pl-10" /></div>
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
        </select>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        <Button size="sm" onClick={() => { setForm({ customerName: "", customerEmail: "", customerPhone: "", category: "order_issue", subject: "", description: "", priority: "medium", source: "manual" }); setFormError(null); setShowCreate(true); }}><Plus className="h-4 w-4 mr-1" />New Ticket</Button>
      </div>

      {/* Create ticket dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Customer Name *</label><Input value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} /></div>
              <div><label className="text-xs font-medium">Email</label><Input value={form.customerEmail} onChange={e => setForm({...form, customerEmail: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs font-medium">Category *</label><select className="w-full border rounded-md px-2 py-2 text-sm bg-background" value={form.category} onChange={e => setForm({...form, category: e.target.value})}><option value="order_issue">Order Issue</option><option value="payment">Payment</option><option value="refund">Refund</option><option value="exchange">Exchange</option><option value="return">Return</option><option value="delivery">Delivery</option><option value="complaint">Complaint</option><option value="product_inquiry">Product Inquiry</option><option value="technical">Technical</option><option value="other">Other</option></select></div>
              <div><label className="text-xs font-medium">Priority</label><select className="w-full border rounded-md px-2 py-2 text-sm bg-background" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
              <div><label className="text-xs font-medium">Source</label><select className="w-full border rounded-md px-2 py-2 text-sm bg-background" value={form.source} onChange={e => setForm({...form, source: e.target.value})}><option value="manual">Manual</option><option value="website">Website</option><option value="email">Email</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option></select></div>
            </div>
            <div><label className="text-xs font-medium">Subject *</label><Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} /></div>
            <div><label className="text-xs font-medium">Description *</label><textarea className="w-full border rounded-md p-2 text-sm bg-background" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Create Ticket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add note dialog */}
      <Dialog open={!!noteTicketId} onOpenChange={() => setNoteTicketId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <textarea className="w-full border rounded-md p-2 text-sm bg-background" rows={3} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Type your reply..." />
          <DialogFooter><Button variant="outline" onClick={() => setNoteTicketId(null)}>Cancel</Button><Button onClick={handleNote}>Add Note</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> :
      tickets.length === 0 ? <p className="text-center text-muted-foreground py-4">No tickets</p> : (
        <div className="space-y-3">{tickets.map(t => (
          <Card key={t._id}><CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">{t.ticketNumber}</span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", statusColor[t.status] || statusColor.open)}>{t.status.replace(/_/g, ' ')}</span>
                  <span className={cn("text-xs font-medium capitalize", priorityColor[t.priority])}>{t.priority}</span>
                  <Badge variant="outline" className="capitalize text-xs">{t.category.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground">{t.customerName} {t.customerEmail ? `(${t.customerEmail})` : ''} • {new Date(t.createdAt).toLocaleDateString("en-IN")}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setNoteTicketId(t._id); setNoteText(""); }}><MessageSquare className="h-3.5 w-3.5" /></Button>
                {t.status === 'open' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStatus(t._id, 'in_progress')}>Start</Button>}
                {['open', 'in_progress', 'assigned'].includes(t.status) && <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => handleStatus(t._id, 'resolved')}>Resolve</Button>}
                {t.status === 'resolved' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStatus(t._id, 'closed')}>Close</Button>}
              </div>
            </div>
            {t.notes?.length > 0 && <div className="mt-2 border-t pt-2"><p className="text-xs text-muted-foreground">{t.notes.length} note{t.notes.length > 1 ? 's' : ''} — Last: "{t.notes[t.notes.length - 1]?.message?.slice(0, 60)}..."</p></div>}
          </CardContent></Card>
        ))}</div>
      )}
    </div>
  );
}
