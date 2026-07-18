const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  leaveType: {
    type: String,
    enum: ['casual', 'sick', 'paid', 'lop', 'maternity', 'paternity', 'compensatory'],
    required: true
  },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  totalDays: { type: Number, required: true },
  halfDay: { type: Boolean, default: false },
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

leaveRequestSchema.index({ employeeId: 1, status: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
