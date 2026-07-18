"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  ClipboardCheck,
  BarChart3,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Wrench,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getQCInspections,
  getQCDashboard,
  updateQCStatus,
  type QCInspection,
  type QCDashboardStats,
} from "@/lib/api/qc";

type Tab = "dashboard" | "inspections";

const STAGES = [
  { value: "", label: "All Stages" },
  { value: "incoming_fabric", label: "Incoming Fabric" },
  { value: "printing", label: "Printing" },
  { value: "embroidery", label: "Embroidery" },
  { value: "stitching", label: "Stitching" },
  { value: "washing", label: "Washing" },
  { value: "ironing", label: "Ironing" },
  { value: "packing", label: "Packing" },
  { value: "final_dispatch", label: "Final Dispatch" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  passed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  hold: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  rework: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  disposed: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

export function QCModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b pb-px">
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={BarChart3}>Dashboard</TabBtn>
        <TabBtn active={tab === "inspections"} onClick={() => setTab("inspections")} icon={ClipboardCheck}>Inspections</TabBtn>
      </div>

      {tab === "dashboard" && <DashboardPanel token={token} />}
      {tab === "inspections" && <InspectionsPanel token={token} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
      <Icon className="h-4 w-4" />{children}
    </button>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────

function DashboardPanel({ token }: { token: string }) {
  const [stats, setStats] = useState<QCDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQCDashboard(token).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!stats) return <p className="text-center text-muted-foreground py-4">Failed to load dashboard</p>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Today's Inspections" value={stats.todayInspections} icon={ClipboardCheck} />
        <StatCard title="Pending QC" value={stats.pendingCount} icon={Clock} variant="warning" />
        <StatCard title="Pass Rate (30d)" value={`${stats.passRate}%`} icon={CheckCircle2} variant="success" />
        <StatCard title="Reject Rate (30d)" value={`${stats.rejectRate}%`} icon={XCircle} variant="danger" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Inspections</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.totalInspections}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Rework Rate</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.reworkRate}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Passed (30d)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{stats.passedCount}</p></CardContent>
        </Card>
      </div>

      {/* Top Defects & Supplier Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" /> Top Defects (30d)</CardTitle></CardHeader>
          <CardContent>
            {stats.topDefects.length === 0 ? <p className="text-sm text-muted-foreground">No defects recorded</p> : (
              <ul className="space-y-2">
                {stats.topDefects.map((d, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span>{d._id}</span>
                    <Badge variant="destructive">{d.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Supplier Quality Scores</CardTitle></CardHeader>
          <CardContent>
            {stats.supplierScores.length === 0 ? <p className="text-sm text-muted-foreground">No supplier data</p> : (
              <ul className="space-y-2">
                {stats.supplierScores.map((s, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span>{s._id}</span>
                    <Badge variant={s.score >= 80 ? "default" : s.score >= 60 ? "secondary" : "destructive"}>{s.score.toFixed(0)}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── INSPECTIONS PANEL ───────────────────────────────────────────

function InspectionsPanel({ token }: { token: string }) {
  const [inspections, setInspections] = useState<QCInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getQCInspections(token, { stage: stageFilter || undefined, status: statusFilter || undefined, page: p });
      setInspections(res.inspections);
      setTotal(res.total);
      setPage(p);
    } catch {}
    setLoading(false);
  }, [token, stageFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateQCStatus(token, id, newStatus);
      load(page);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="passed">Passed</option>
          <option value="rejected">Rejected</option>
          <option value="hold">Hold</option>
          <option value="rework">Rework</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => load(1)}><RefreshCw className="h-4 w-4" /></Button>
        <Badge variant="outline">{total} total</Badge>
      </div>

      {/* Inspections List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : inspections.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">No inspections found</p>
      ) : (
        <div className="space-y-3">
          {inspections.map((insp) => (
            <Card key={insp._id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{insp.inspectionNumber}</span>
                      <StatusBadge status={insp.status} />
                      <Badge variant="outline" className="capitalize">{insp.stage.replace(/_/g, ' ')}</Badge>
                      {insp.priority === 'urgent' && <Badge variant="destructive">Urgent</Badge>}
                      {insp.priority === 'high' && <Badge className="bg-orange-500">High</Badge>}
                    </div>
                    <p className="font-medium">{insp.productId?.name || "Unknown Product"}</p>
                    <p className="text-xs text-muted-foreground">
                      {insp.batchNumber && `Batch: ${insp.batchNumber} • `}
                      {insp.supplier?.name && `Supplier: ${insp.supplier.name} • `}
                      Inspector: {insp.inspectedBy?.displayName || "—"} •
                      {new Date(insp.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>

                  {/* Quick actions */}
                  {insp.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleStatusChange(insp._id, 'passed')}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Pass
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleStatusChange(insp._id, 'rejected')}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => handleStatusChange(insp._id, 'rework')}>
                        <Wrench className="h-4 w-4 mr-1" /> Rework
                      </Button>
                    </div>
                  )}
                </div>

                {/* Checklist summary */}
                {insp.checklist?.length > 0 && (
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span className="text-green-600">✓ {insp.checklist.filter(c => c.passed === true).length} passed</span>
                    <span className="text-red-600">✗ {insp.checklist.filter(c => c.passed === false).length} failed</span>
                    <span>○ {insp.checklist.filter(c => c.passed === null).length} pending</span>
                    {insp.defects?.length > 0 && <span className="text-orange-600">⚠ {insp.defects.length} defect{insp.defects.length > 1 ? 's' : ''}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground py-1">Page {page}</span>
          <Button size="sm" variant="outline" onClick={() => load(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, variant }: { title: string; value: number | string; icon: React.ComponentType<{ className?: string }>; variant?: "warning" | "success" | "danger" }) {
  const colors = {
    warning: "bg-orange-100 dark:bg-orange-900/30 text-orange-600",
    success: "bg-green-100 dark:bg-green-900/30 text-green-600",
    danger: "bg-red-100 dark:bg-red-900/30 text-red-600",
    default: "bg-primary/10 text-primary",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", colors[variant || "default"])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[status] || STATUS_COLORS.pending)}>
      {status}
    </span>
  );
}
