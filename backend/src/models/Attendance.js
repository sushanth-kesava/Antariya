const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ['present', 'absent', 'half_day', 'late', 'on_leave', 'holiday', 'week_off'],
    default: 'present'
  },
  checkIn: { type: Date, default: null },
  checkOut: { type: Date, default: null },
  workingHours: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  shift: { type: String, default: 'general' },
  lateMinutes: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null }
}, {
  timestamps: true
});

attendanceSchema.index({ employeeId: 1, date: -1 });
attendanceSchema.index({ date: 1, status: 1 });
// Prevent duplicate attendance for same employee on same date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
