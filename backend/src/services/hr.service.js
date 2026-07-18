const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Payroll = require('../models/Payroll');

class HRService {

  // ─── EMPLOYEES ─────────────────────────────────────────────────

  static async createEmployee(data) {
    const count = await Employee.countDocuments();
    data.employeeId = data.employeeId || `EMP-${(count + 1).toString().padStart(4, '0')}`;
    // Calculate gross and net
    const s = data.salary || {};
    s.grossSalary = (s.basic || 0) + (s.hra || 0) + (s.allowances || 0) + (s.incentives || 0);
    s.netSalary = s.grossSalary - (s.pf || 0) - (s.esi || 0) - (s.professionalTax || 0) - (s.tds || 0) - (s.otherDeductions || 0);
    data.salary = s;
    return Employee.create(data);
  }

  static async getEmployees({ department, status, search, page = 1, limit = 20 }) {
    const filter = {};
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [employees, total] = await Promise.all([
      Employee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Employee.countDocuments(filter)
    ]);
    return { employees, total, page, pages: Math.ceil(total / limit) };
  }

  static async getEmployeeById(id) {
    const emp = await Employee.findById(id);
    if (!emp) throw new Error('Employee not found');
    return emp;
  }

  static async updateEmployee(id, data) {
    const emp = await Employee.findByIdAndUpdate(id, data, { new: true });
    if (!emp) throw new Error('Employee not found');
    return emp;
  }

  // ─── ATTENDANCE ────────────────────────────────────────────────

  static async markAttendance({ employeeId, date, status, checkIn, checkOut, notes, userId }) {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    let workingHours = 0;
    let lateMinutes = 0;
    if (checkIn && checkOut) {
      workingHours = ((new Date(checkOut) - new Date(checkIn)) / 3600000).toFixed(1);
    }
    if (checkIn) {
      const expectedStart = new Date(dateObj); expectedStart.setHours(9, 0, 0);
      const diff = (new Date(checkIn) - expectedStart) / 60000;
      if (diff > 0) lateMinutes = Math.round(diff);
    }

    const attendance = await Attendance.findOneAndUpdate(
      { employeeId, date: dateObj },
      { employeeId, date: dateObj, status, checkIn, checkOut, workingHours, lateMinutes, notes, markedBy: userId },
      { upsert: true, new: true }
    );
    return attendance;
  }

  static async bulkMarkAttendance({ records, userId }) {
    const results = [];
    for (const rec of records) {
      const r = await this.markAttendance({ ...rec, userId });
      results.push(r);
    }
    return results;
  }

  static async getAttendance({ employeeId, date, month, year, page = 1, limit = 31 }) {
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (date) {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      filter.date = d;
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }

    const [records, total] = await Promise.all([
      Attendance.find(filter).populate('employeeId', 'firstName lastName employeeId department').sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
      Attendance.countDocuments(filter)
    ]);
    return { records, total };
  }

  // ─── LEAVE ─────────────────────────────────────────────────────

  static async createLeaveRequest(data) {
    const fromDate = new Date(data.fromDate);
    const toDate = new Date(data.toDate);
    const totalDays = data.halfDay ? 0.5 : Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
    data.totalDays = totalDays;
    return LeaveRequest.create(data);
  }

  static async getLeaveRequests({ employeeId, status, page = 1, limit = 20 }) {
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;

    const [requests, total] = await Promise.all([
      LeaveRequest.find(filter).populate('employeeId', 'firstName lastName employeeId department').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      LeaveRequest.countDocuments(filter)
    ]);
    return { requests, total, pages: Math.ceil(total / limit) };
  }

  static async approveLeave({ leaveId, status, rejectionReason, userId }) {
    const leave = await LeaveRequest.findById(leaveId);
    if (!leave) throw new Error('Leave request not found');

    leave.status = status;
    leave.approvedBy = userId;
    leave.approvedAt = new Date();
    if (rejectionReason) leave.rejectionReason = rejectionReason;

    // Deduct from balance if approved
    if (status === 'approved') {
      const emp = await Employee.findById(leave.employeeId);
      if (emp && emp.leaveBalance[leave.leaveType] !== undefined) {
        emp.leaveBalance[leave.leaveType] = Math.max(0, emp.leaveBalance[leave.leaveType] - leave.totalDays);
        await emp.save();
      }
    }

    await leave.save();
    return leave;
  }

  // ─── PAYROLL ───────────────────────────────────────────────────

  static async processPayroll({ employeeId, month, year, bonuses, incentives, deductions, userId }) {
    const emp = await Employee.findById(employeeId);
    if (!emp) throw new Error('Employee not found');

    const payPeriod = `${year}-${String(month).padStart(2, '0')}`;

    // Check if already processed
    const existing = await Payroll.findOne({ employeeId, month, year });
    if (existing && existing.status !== 'draft') throw new Error(`Payroll already ${existing.status} for ${payPeriod}`);

    // Get attendance for the month
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const totalWorkingDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) - 8; // minus ~8 weekends
    const attendanceRecords = await Attendance.find({ employeeId, date: { $gte: start, $lte: end } });
    const presentDays = attendanceRecords.filter(a => ['present', 'late'].includes(a.status)).length;
    const halfDays = attendanceRecords.filter(a => a.status === 'half_day').length;
    const absentDays = totalWorkingDays - presentDays - (halfDays * 0.5);
    const lopDays = Math.max(0, absentDays - (emp.leaveBalance.casual + emp.leaveBalance.paid));

    // Calculate
    const s = emp.salary;
    const lopDeduction = lopDays > 0 ? (s.grossSalary / totalWorkingDays) * lopDays : 0;
    const grossEarnings = s.grossSalary + (bonuses || 0) + (incentives || 0);
    const totalDeductions = (s.pf || 0) + (s.esi || 0) + (s.professionalTax || 0) + (s.tds || 0) + (deductions || 0) + lopDeduction;
    const netSalary = grossEarnings - totalDeductions;

    const payrollData = {
      employeeId, month, year, payPeriod,
      basic: s.basic, hra: s.hra, allowances: s.allowances,
      incentives: (s.incentives || 0) + (incentives || 0),
      bonuses: bonuses || 0,
      grossEarnings,
      pf: s.pf, esi: s.esi, professionalTax: s.professionalTax, tds: s.tds,
      lop: lopDeduction, otherDeductions: deductions || 0,
      totalDeductions,
      netSalary,
      workingDays: totalWorkingDays, presentDays, absentDays, leavesTaken: halfDays, lopDays,
      status: 'processed',
      processedBy: userId
    };

    if (existing) {
      Object.assign(existing, payrollData);
      await existing.save();
      return existing;
    }
    return Payroll.create(payrollData);
  }

  static async getPayrolls({ employeeId, month, year, status, page = 1, limit = 20 }) {
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (status) filter.status = status;

    const [payrolls, total] = await Promise.all([
      Payroll.find(filter).populate('employeeId', 'firstName lastName employeeId department designation').sort({ year: -1, month: -1 }).skip((page - 1) * limit).limit(limit),
      Payroll.countDocuments(filter)
    ]);
    return { payrolls, total, pages: Math.ceil(total / limit) };
  }

  static async approvePayroll({ payrollId, userId }) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll) throw new Error('Payroll not found');
    payroll.status = 'approved';
    payroll.approvedBy = userId;
    await payroll.save();
    return payroll;
  }

  // ─── DASHBOARD ─────────────────────────────────────────────────

  static async getDashboard() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const [
      totalEmployees,
      activeEmployees,
      todayAttendance,
      pendingLeaves,
      payrollStatus,
      departmentBreakdown
    ] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: 'active' }),
      Attendance.countDocuments({ date: { $gte: new Date(today.setHours(0, 0, 0, 0)) }, status: { $in: ['present', 'late'] } }),
      LeaveRequest.countDocuments({ status: 'pending' }),
      Payroll.find({ month: currentMonth, year: currentYear }).select('status netSalary'),
      Employee.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    const attendanceRate = activeEmployees > 0 ? ((todayAttendance / activeEmployees) * 100).toFixed(1) : 0;
    const payrollProcessed = payrollStatus.filter(p => ['processed', 'approved', 'paid'].includes(p.status)).length;
    const totalPayroll = payrollStatus.reduce((s, p) => s + (p.netSalary || 0), 0);

    // Upcoming birthdays (next 30 days)
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const upcomingBirthdays = await Employee.find({
      status: 'active',
      dateOfBirth: { $ne: null }
    }).select('firstName lastName dateOfBirth department').limit(100);

    const birthdaySoon = upcomingBirthdays.filter(e => {
      if (!e.dateOfBirth) return false;
      const bday = new Date(e.dateOfBirth);
      bday.setFullYear(currentYear);
      return bday >= new Date() && bday <= thirtyDaysLater;
    }).slice(0, 5);

    return {
      totalEmployees,
      activeEmployees,
      todayAttendance,
      attendanceRate: Number(attendanceRate),
      pendingLeaves,
      payrollProcessed,
      payrollPending: activeEmployees - payrollProcessed,
      totalPayroll,
      departmentBreakdown,
      upcomingBirthdays: birthdaySoon
    };
  }
}

module.exports = HRService;
