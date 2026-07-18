const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null },
  // Personal
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, default: '', trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, default: '' },
  dateOfBirth: { type: Date, default: null },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
  photo: { type: String, default: '' },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' }
  },
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    relation: { type: String, default: '' }
  },
  // Employment
  department: { type: String, required: true },
  designation: { type: String, required: true },
  branch: { type: String, default: 'Main' },
  joiningDate: { type: Date, required: true },
  confirmationDate: { type: Date, default: null },
  resignationDate: { type: Date, default: null },
  lastWorkingDate: { type: Date, default: null },
  employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern'], default: 'full_time' },
  status: { type: String, enum: ['active', 'on_notice', 'resigned', 'terminated', 'inactive'], default: 'active' },
  // Salary
  salary: {
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },
    // Deductions
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 }
  },
  bankDetails: {
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    accountType: { type: String, default: 'savings' }
  },
  // Documents
  documents: [{
    type: { type: String, default: '' },
    name: { type: String, default: '' },
    url: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  // Leave balance
  leaveBalance: {
    casual: { type: Number, default: 12 },
    sick: { type: Number, default: 6 },
    paid: { type: Number, default: 15 },
    lop: { type: Number, default: 0 }
  },
  // Shift
  shift: { type: String, default: 'general' },
  reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', required: true }
}, {
  timestamps: true
});

employeeSchema.index({ department: 1, status: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});
employeeSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);
