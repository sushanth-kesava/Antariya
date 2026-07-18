const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  payPeriod: { type: String, required: true }, // e.g. "2026-07"
  // Earnings
  basic: { type: Number, default: 0 },
  hra: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  incentives: { type: Number, default: 0 },
  bonuses: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  grossEarnings: { type: Number, default: 0 },
  // Deductions
  pf: { type: Number, default: 0 },
  esi: { type: Number, default: 0 },
  professionalTax: { type: Number, default: 0 },
  tds: { type: Number, default: 0 },
  lop: { type: Number, default: 0 },
  otherDeductions: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  // Net
  netSalary: { type: Number, default: 0 },
  // Attendance summary for the month
  workingDays: { type: Number, default: 0 },
  presentDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  leavesTaken: { type: Number, default: 0 },
  lopDays: { type: Number, default: 0 },
  // Status
  status: {
    type: String,
    enum: ['draft', 'processed', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },
  paidAt: { type: Date, default: null },
  paymentMethod: { type: String, default: 'bank_transfer' },
  transactionId: { type: String, default: '' },
  // PDF
  salarySlipUrl: { type: String, default: '' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null },
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

payrollSchema.index({ employeeId: 1, year: 1, month: 1 }, { unique: true });
payrollSchema.index({ payPeriod: 1, status: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
