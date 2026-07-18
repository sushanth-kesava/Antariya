"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Users, CalendarDays, Wallet, BarChart3, RefreshCw, CheckCircle2, XCircle, Search, Plus, Trash2, Pencil, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getHRDashboard, getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getLeaveRequests, createLeaveRequest, approveLeave,
  getPayrolls, processPayroll, markAttendance, getAttendance,
  type HRDashboard, type Employee, type LeaveRequestItem, type PayrollItem, type AttendanceRecord
} from "@/lib/api/hr";

type Tab = "dashboard" | "employees" | "attendance" | "leaves" | "payroll";

export function HRModule({ token, has }: { token: string; has: (key: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b pb-px overflow-x-auto">
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={BarChart3}>Dashboard</TabBtn>
        <TabBtn active={tab === "employees"} onClick={() => setTab("employees")} icon={Users}>Employees</TabBtn>
        <TabBtn active={tab === "attendance"} onClick={() => setTab("attendance")} icon={Clock}>Attendance</TabBtn>
        <TabBtn active={tab === "leaves"} onClick={() => setTab("leaves")} icon={CalendarDays}>Leaves</TabBtn>
        <TabBtn active={tab === "payroll"} onClick={() => setTab("payroll")} icon={Wallet}>Payroll</TabBtn>
      </div>
      {tab === "dashboard" && <DashPanel token={token} />}
      {tab === "employees" && <EmpPanel token={token} />}
      {tab === "attendance" && <AttendancePanel token={token} />}
      {tab === "leaves" && <LeavePanel token={token} />}
      {tab === "payroll" && <PayrollPanel token={token} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}><Icon className="h-4 w-4" />{children}</button>;
}

// ─── DASHBOARD ───────────────────────────────────────────────────

function DashPanel({ token }: { token: string }) {
  const [stats, setStats] = useState<HRDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getHRDashboard(token).then(setStats).catch(() => {}).finally(() => setLoading(false)); }, [token]);
  if (loading) return <Spin />;
  if (!stats) return <p className="text-center text-muted-foreground">Failed to load</p>;
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SC title="Total Employees" value={stats.totalEmployees} />
        <SC title="Attendance %" value={`${stats.attendanceRate}%`} color="text-green-600" />
        <SC title="Pending Leaves" value={stats.pendingLeaves} color="text-orange-600" />
        <SC title="Payroll (Month)" value={fmt(stats.totalPayroll)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Department Breakdown</CardTitle></CardHeader><CardContent>{stats.departmentBreakdown.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : <ul className="space-y-2">{stats.departmentBreakdown.map(d => <li key={d._id} className="flex justify-between text-sm"><span className="capitalize">{d._id || 'Other'}</span><Badge variant="secondary">{d.count}</Badge></li>)}</ul>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">🎂 Upcoming Birthdays</CardTitle></CardHeader><CardContent>{stats.upcomingBirthdays.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : <ul className="space-y-2">{stats.upcomingBirthdays.map((b, i) => <li key={i} className="text-sm">{b.firstName} {b.lastName} <span className="text-muted-foreground">({b.department})</span></li>)}</ul>}</CardContent></Card>
      </div>
    </div>
  );
}

// ─── EMPLOYEES (full CRUD) ───────────────────────────────────────

function EmpPanel({ token }: { token: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const emptyForm = { firstName: "", lastName: "", email: "", phone: "", department: "", designation: "", branch: "Main", joiningDate: "", gender: "male", basic: "", hra: "", allowances: "", pf: "", esi: "", professionalTax: "", tds: "0" };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await getEmployees(token, { search: search || undefined }); setEmployees(res.employees); } catch {}
    setLoading(false);
  }, [token, search]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setFormError(null); setShowForm(true); };
  const openEdit = (emp: Employee) => {
    setEditId(emp._id);
    setForm({
      firstName: emp.firstName, lastName: emp.lastName, email: emp.email, phone: emp.phone || "",
      department: emp.department, designation: emp.designation, branch: emp.branch || "Main",
      joiningDate: emp.joiningDate?.slice(0, 10) || "", gender: emp.gender || "male",
      basic: String(emp.salary?.basic || ""), hra: String(emp.salary?.hra || ""),
      allowances: String(emp.salary?.allowances || ""), pf: String(emp.salary?.pf || ""),
      esi: String(emp.salary?.esi || ""), professionalTax: String(emp.salary?.professionalTax || ""),
      tds: String(emp.salary?.tds || "0")
    });
    setFormError(null); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.firstName || !form.email || !form.department || !form.designation || !form.joiningDate) {
      setFormError("Fill required fields: Name, Email, Department, Designation, Joining Date"); return;
    }
    setSaving(true); setFormError(null);
    const payload = {
      firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone,
      department: form.department, designation: form.designation, branch: form.branch,
      joiningDate: form.joiningDate, gender: form.gender,
      salary: { basic: parseFloat(form.basic) || 0, hra: parseFloat(form.hra) || 0, allowances: parseFloat(form.allowances) || 0, pf: parseFloat(form.pf) || 0, esi: parseFloat(form.esi) || 0, professionalTax: parseFloat(form.professionalTax) || 0, tds: parseFloat(form.tds) || 0 }
    };
    try {
      if (editId) await updateEmployee(token, editId, payload);
      else await createEmployee(token, payload);
      setShowForm(false); load();
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete employee "${name}"? This cannot be undone.`)) return;
    try { await deleteEmployee(token, id); load(); } catch {}
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="pl-10" /></div>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Employee</Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Employee" : "Add New Employee"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">First Name *</label><Input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} /></div>
              <div><label className="text-xs font-medium">Last Name</label><Input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Email *</label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><label className="text-xs font-medium">Phone</label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Department *</label><Input value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="Production" /></div>
              <div><label className="text-xs font-medium">Designation *</label><Input value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} placeholder="Stitching Lead" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs font-medium">Branch</label><Input value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} /></div>
              <div><label className="text-xs font-medium">Joining Date *</label><Input type="date" value={form.joiningDate} onChange={e => setForm({...form, joiningDate: e.target.value})} /></div>
              <div><label className="text-xs font-medium">Gender</label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            </div>
            <div className="border-t pt-3"><p className="text-sm font-medium mb-2">Salary Structure (₹/month)</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Basic</label><Input type="number" value={form.basic} onChange={e => setForm({...form, basic: e.target.value})} placeholder="15000" /></div>
              <div><label className="text-xs font-medium">HRA</label><Input type="number" value={form.hra} onChange={e => setForm({...form, hra: e.target.value})} placeholder="5000" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Allowances</label><Input type="number" value={form.allowances} onChange={e => setForm({...form, allowances: e.target.value})} placeholder="2000" /></div>
              <div><label className="text-xs font-medium">PF</label><Input type="number" value={form.pf} onChange={e => setForm({...form, pf: e.target.value})} placeholder="1800" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs font-medium">ESI</label><Input type="number" value={form.esi} onChange={e => setForm({...form, esi: e.target.value})} placeholder="500" /></div>
              <div><label className="text-xs font-medium">Prof. Tax</label><Input type="number" value={form.professionalTax} onChange={e => setForm({...form, professionalTax: e.target.value})} placeholder="200" /></div>
              <div><label className="text-xs font-medium">TDS</label><Input type="number" value={form.tds} onChange={e => setForm({...form, tds: e.target.value})} placeholder="0" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}{editId ? "Save Changes" : "Add Employee"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? <Spin /> : employees.length === 0 ? <p className="text-center text-muted-foreground py-4">No employees found</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">ID</th><th className="text-left py-2">Name</th><th className="text-left py-2">Dept</th><th className="text-left py-2">Designation</th><th className="text-right py-2">Net Salary</th><th className="text-left py-2">Status</th><th className="text-right py-2">Actions</th></tr></thead>
          <tbody>{employees.map(e => (
            <tr key={e._id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-2 font-mono text-xs">{e.employeeId}</td>
              <td className="py-2 font-medium">{e.firstName} {e.lastName}</td>
              <td className="py-2 capitalize">{e.department}</td>
              <td className="py-2">{e.designation}</td>
              <td className="py-2 text-right font-mono">{fmt(e.salary?.netSalary || 0)}</td>
              <td className="py-2"><Badge variant={e.status === 'active' ? 'default' : 'secondary'} className="capitalize">{e.status}</Badge></td>
              <td className="py-2 text-right">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(e._id, `${e.firstName} ${e.lastName}`)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

// ─── ATTENDANCE ──────────────────────────────────────────────────

function AttendancePanel({ token }: { token: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getEmployees(token, { status: "active" }),
      getAttendance(token, { date: selectedDate } as any)
    ]).then(([empRes, attRes]) => {
      setEmployees(empRes.employees);
      setRecords(attRes.records);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token, selectedDate]);

  const handleMark = async (employeeId: string, status: string) => {
    setMarking(employeeId);
    try {
      await markAttendance(token, { employeeId, date: selectedDate, status });
      const attRes = await getAttendance(token, { date: selectedDate } as any);
      setRecords(attRes.records);
    } catch {}
    setMarking(null);
  };

  const getStatus = (empId: string) => {
    const rec = records.find(r => (r.employeeId?._id || r.employeeId) === empId);
    return rec?.status || null;
  };

  if (loading) return <Spin />;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <label className="text-sm font-medium">Date:</label>
        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
        <Badge variant="outline">{employees.length} employees</Badge>
      </div>

      {employees.length === 0 ? <p className="text-center text-muted-foreground py-4">No active employees</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Employee</th><th className="text-left py-2">Department</th><th className="text-left py-2">Status</th><th className="text-left py-2">Mark</th></tr></thead>
          <tbody>{employees.map(e => {
            const st = getStatus(e._id);
            return (
              <tr key={e._id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="py-2 font-medium">{e.firstName} {e.lastName}</td>
                <td className="py-2 capitalize">{e.department}</td>
                <td className="py-2">{st ? <Badge variant={st === 'present' ? 'default' : st === 'absent' ? 'destructive' : 'secondary'} className="capitalize">{st.replace(/_/g, ' ')}</Badge> : <span className="text-muted-foreground text-xs">Not marked</span>}</td>
                <td className="py-2 flex gap-1">
                  {marking === e._id ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>
                    <Button size="sm" variant={st === 'present' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => handleMark(e._id, 'present')}>P</Button>
                    <Button size="sm" variant={st === 'absent' ? 'destructive' : 'outline'} className="h-7 text-xs" onClick={() => handleMark(e._id, 'absent')}>A</Button>
                    <Button size="sm" variant={st === 'half_day' ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => handleMark(e._id, 'half_day')}>H</Button>
                    <Button size="sm" variant={st === 'late' ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => handleMark(e._id, 'late')}>L</Button>
                  </>)}
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}

// ─── LEAVES ──────────────────────────────────────────────────────

function LeavePanel({ token }: { token: string }) {
  const [leaves, setLeaves] = useState<LeaveRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [showApply, setShowApply] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveForm, setLeaveForm] = useState({ employeeId: "", leaveType: "casual", fromDate: "", toDate: "", reason: "", halfDay: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await getLeaveRequests(token, { status: statusFilter || undefined }); setLeaves(res.requests); } catch {}
    setLoading(false);
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openApply = async () => {
    try { const res = await getEmployees(token, { status: "active" }); setEmployees(res.employees); } catch {}
    setLeaveForm({ employeeId: "", leaveType: "casual", fromDate: "", toDate: "", reason: "", halfDay: false });
    setFormError(null); setShowApply(true);
  };

  const handleApplyLeave = async () => {
    if (!leaveForm.employeeId || !leaveForm.fromDate || !leaveForm.toDate || !leaveForm.reason) {
      setFormError("Fill all required fields"); return;
    }
    setSaving(true); setFormError(null);
    try { await createLeaveRequest(token, leaveForm); setShowApply(false); load(); } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  };

  const handleApprove = async (id: string, status: "approved" | "rejected") => {
    try { await approveLeave(token, id, status); load(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        <Button size="sm" onClick={openApply}><Plus className="h-4 w-4 mr-1" /> Apply Leave</Button>
      </div>

      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Apply Leave</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div><label className="text-xs font-medium">Employee *</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={leaveForm.employeeId} onChange={e => setLeaveForm({...leaveForm, employeeId: e.target.value})}>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName} ({e.department})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Leave Type</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={leaveForm.leaveType} onChange={e => setLeaveForm({...leaveForm, leaveType: e.target.value})}>
                  <option value="casual">Casual</option><option value="sick">Sick</option><option value="paid">Paid</option><option value="lop">LOP</option>
                </select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <input type="checkbox" checked={leaveForm.halfDay} onChange={e => setLeaveForm({...leaveForm, halfDay: e.target.checked})} id="halfDay" />
                <label htmlFor="halfDay" className="text-xs">Half Day</label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">From *</label><Input type="date" value={leaveForm.fromDate} onChange={e => setLeaveForm({...leaveForm, fromDate: e.target.value})} /></div>
              <div><label className="text-xs font-medium">To *</label><Input type="date" value={leaveForm.toDate} onChange={e => setLeaveForm({...leaveForm, toDate: e.target.value})} /></div>
            </div>
            <div><label className="text-xs font-medium">Reason *</label><Input value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} placeholder="Reason for leave" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApply(false)}>Cancel</Button>
            <Button onClick={handleApplyLeave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Submit Leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? <Spin /> : leaves.length === 0 ? <p className="text-center text-muted-foreground py-4">No leave requests</p> : (
        <div className="space-y-3">{leaves.map(l => (
          <Card key={l._id}><CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{l.employeeId?.firstName} {l.employeeId?.lastName} <span className="text-muted-foreground text-xs">({l.employeeId?.department})</span></p>
              <p className="text-sm text-muted-foreground capitalize">{l.leaveType} • {l.totalDays} day{l.totalDays > 1 ? 's' : ''} • {new Date(l.fromDate).toLocaleDateString("en-IN")} → {new Date(l.toDate).toLocaleDateString("en-IN")}</p>
              <p className="text-xs mt-1 text-muted-foreground">{l.reason}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {l.status === 'pending' ? (<>
                <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleApprove(l._id, 'approved')}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleApprove(l._id, 'rejected')}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
              </>) : <Badge variant={l.status === 'approved' ? 'default' : 'destructive'} className="capitalize">{l.status}</Badge>}
            </div>
          </CardContent></Card>
        ))}</div>
      )}
    </div>
  );
}

// ─── PAYROLL ─────────────────────────────────────────────────────

function PayrollPanel({ token }: { token: string }) {
  const [payrolls, setPayrolls] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProcess, setShowProcess] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payForm, setPayForm] = useState({ employeeId: "", month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await getPayrolls(token, {}); setPayrolls(res.payrolls); } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openProcess = async () => {
    try { const res = await getEmployees(token, { status: "active" }); setEmployees(res.employees); } catch {}
    setPayForm({ employeeId: "", month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });
    setFormError(null); setShowProcess(true);
  };

  const handleProcess = async () => {
    if (!payForm.employeeId) { setFormError("Select an employee"); return; }
    setSaving(true); setFormError(null);
    try {
      await processPayroll(token, { employeeId: payForm.employeeId, month: parseInt(payForm.month), year: parseInt(payForm.year) });
      setShowProcess(false); load();
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Button size="sm" onClick={openProcess}><Plus className="h-4 w-4 mr-1" /> Process Payroll</Button>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Dialog open={showProcess} onOpenChange={setShowProcess}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Process Monthly Payroll</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div><label className="text-xs font-medium">Employee *</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={payForm.employeeId} onChange={e => setPayForm({...payForm, employeeId: e.target.value})}>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName} — {e.department}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Month</label><Input type="number" min="1" max="12" value={payForm.month} onChange={e => setPayForm({...payForm, month: e.target.value})} /></div>
              <div><label className="text-xs font-medium">Year</label><Input type="number" value={payForm.year} onChange={e => setPayForm({...payForm, year: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcess(false)}>Cancel</Button>
            <Button onClick={handleProcess} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Process</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? <Spin /> : payrolls.length === 0 ? <p className="text-center text-muted-foreground py-4">No payroll records</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Employee</th><th className="text-left py-2">Period</th><th className="text-right py-2">Gross</th><th className="text-right py-2">Deductions</th><th className="text-right py-2">Net</th><th className="text-left py-2">Days</th><th className="text-left py-2">Status</th></tr></thead>
          <tbody>{payrolls.map(p => (
            <tr key={p._id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-2">{p.employeeId?.firstName} {p.employeeId?.lastName}</td>
              <td className="py-2 font-mono text-xs">{p.payPeriod}</td>
              <td className="py-2 text-right font-mono">{fmt(p.grossEarnings)}</td>
              <td className="py-2 text-right font-mono text-red-600">-{fmt(p.totalDeductions)}</td>
              <td className="py-2 text-right font-mono font-bold text-green-600">{fmt(p.netSalary)}</td>
              <td className="py-2 text-xs">{p.presentDays}/{p.workingDays}</td>
              <td className="py-2"><Badge variant={p.status === 'paid' ? 'default' : 'secondary'} className="capitalize">{p.status}</Badge></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────

function Spin() { return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
function SC({ title, value, color }: { title: string; value: string | number; color?: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{title}</p><p className={cn("text-2xl font-bold", color)}>{value}</p></CardContent></Card>;
}
