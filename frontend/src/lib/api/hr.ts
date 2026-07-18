const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5004/api";

export interface Employee {
  _id: string; employeeId: string; firstName: string; lastName: string; email: string;
  phone: string; department: string; designation: string; branch: string;
  joiningDate: string; status: string; employmentType: string;
  salary: { basic: number; hra: number; allowances: number; grossSalary: number; netSalary: number; pf: number; esi: number; professionalTax: number; tds: number };
  leaveBalance: { casual: number; sick: number; paid: number; lop: number };
  fullName: string; createdAt: string;
}

export interface AttendanceRecord {
  _id: string; employeeId: { _id: string; firstName: string; lastName: string; employeeId: string; department: string };
  date: string; status: string; checkIn: string | null; checkOut: string | null; workingHours: number; lateMinutes: number;
}

export interface LeaveRequestItem {
  _id: string; employeeId: { _id: string; firstName: string; lastName: string; employeeId: string; department: string };
  leaveType: string; fromDate: string; toDate: string; totalDays: number; reason: string; status: string; createdAt: string;
}

export interface PayrollItem {
  _id: string; employeeId: { _id: string; firstName: string; lastName: string; employeeId: string; department: string; designation: string };
  month: number; year: number; payPeriod: string;
  grossEarnings: number; totalDeductions: number; netSalary: number;
  presentDays: number; workingDays: number; lopDays: number;
  status: string;
}

export interface HRDashboard {
  totalEmployees: number; activeEmployees: number; todayAttendance: number;
  attendanceRate: number; pendingLeaves: number; payrollProcessed: number;
  payrollPending: number; totalPayroll: number;
  departmentBreakdown: { _id: string; count: number }[];
  upcomingBirthdays: { firstName: string; lastName: string; dateOfBirth: string; department: string }[];
}

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || `API error: ${res.status}`);
  return data.data;
}

export async function getHRDashboard(token: string) { return apiFetch<HRDashboard>("/hr/dashboard", token); }

export async function getEmployees(token: string, params: { department?: string; status?: string; search?: string; page?: number }) {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ employees: Employee[]; total: number; pages: number }>(`/hr/employees?${qs}`, token);
}

export async function createEmployee(token: string, data: any) { return apiFetch<Employee>("/hr/employees", token, { method: "POST", body: JSON.stringify(data) }); }
export async function getEmployeeById(token: string, id: string) { return apiFetch<Employee>(`/hr/employees/${id}`, token); }
export async function updateEmployee(token: string, id: string, data: any) {
  return apiFetch<Employee>(`/hr/employees/${id}`, token, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteEmployee(token: string, id: string) {
  return apiFetch<{ message: string }>(`/hr/employees/${id}`, token, { method: "DELETE" });
}

export async function getAttendance(token: string, params: { employeeId?: string; month?: number; year?: number }) {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ records: AttendanceRecord[]; total: number }>(`/hr/attendance?${qs}`, token);
}

export async function markAttendance(token: string, data: { employeeId: string; date: string; status: string }) {
  return apiFetch<AttendanceRecord>("/hr/attendance", token, { method: "POST", body: JSON.stringify(data) });
}

export async function createLeaveRequest(token: string, data: { employeeId: string; leaveType: string; fromDate: string; toDate: string; reason: string; halfDay?: boolean }) {
  return apiFetch<LeaveRequestItem>("/hr/leaves", token, { method: "POST", body: JSON.stringify(data) });
}

export async function getLeaveRequests(token: string, params: { status?: string; page?: number }) {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ requests: LeaveRequestItem[]; total: number; pages: number }>(`/hr/leaves?${qs}`, token);
}

export async function approveLeave(token: string, leaveId: string, status: "approved" | "rejected", rejectionReason?: string) {
  return apiFetch<LeaveRequestItem>(`/hr/leaves/${leaveId}`, token, { method: "PATCH", body: JSON.stringify({ status, rejectionReason }) });
}

export async function getPayrolls(token: string, params: { month?: number; year?: number; status?: string; page?: number }) {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return apiFetch<{ payrolls: PayrollItem[]; total: number; pages: number }>(`/hr/payroll?${qs}`, token);
}

export async function processPayroll(token: string, data: { employeeId: string; month: number; year: number }) {
  return apiFetch<PayrollItem>("/hr/payroll", token, { method: "POST", body: JSON.stringify(data) });
}
