const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  expenseNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  category: {
    type: String,
    enum: ['travel', 'salary', 'rent', 'marketing', 'packaging', 'utilities', 'logistics', 'raw_materials', 'maintenance', 'miscellaneous'],
    required: true
  },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'neft', 'cheque', 'card', 'bank_transfer', 'other'],
    default: 'cash'
  },
  paidTo: { type: String, default: '' },
  receiptUrl: { type: String, default: '' },
  attachments: [String],
  expenseDate: { type: Date, required: true },
  // Approval
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'reimbursed'],
    default: 'approved'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  notes: { type: String, default: '' },
  department: { type: String, default: '' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminProfile',
    required: true
  }
}, {
  timestamps: true
});

expenseSchema.index({ category: 1, expenseDate: -1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ createdBy: 1 });
expenseSchema.index({ expenseDate: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
