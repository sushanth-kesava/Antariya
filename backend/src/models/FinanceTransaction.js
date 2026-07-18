const mongoose = require('mongoose');

const financeTransactionSchema = new mongoose.Schema({
  transactionNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['invoice', 'payment_received', 'purchase_bill', 'vendor_payment', 'expense', 'refund', 'credit_note', 'journal'],
    required: true
  },
  category: {
    type: String,
    enum: ['sales', 'purchase', 'expense', 'transfer', 'tax', 'salary', 'other'],
    default: 'other'
  },
  subCategory: {
    type: String,
    default: ''
  },
  // Reference to order/purchase
  referenceType: {
    type: String,
    enum: ['order', 'purchase_order', 'expense', 'salary', 'manual', 'refund'],
    default: 'manual'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  referenceNumber: {
    type: String,
    default: ''
  },
  // Party
  partyType: {
    type: String,
    enum: ['customer', 'vendor', 'employee', 'bank', 'internal'],
    default: 'internal'
  },
  partyName: { type: String, default: '' },
  partyEmail: { type: String, default: '' },
  partyId: { type: mongoose.Schema.Types.ObjectId, default: null },
  // Amounts
  amount: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  // GST
  gst: {
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    hsnCode: { type: String, default: '' }
  },
  // TDS
  tds: {
    amount: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    section: { type: String, default: '' }
  },
  // Payment details
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'neft', 'cheque', 'card', 'razorpay', 'bank_transfer', 'other'],
    default: 'other'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paidAmount: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  dueDate: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  // Bank
  bankAccount: { type: String, default: '' },
  bankTransactionId: { type: String, default: '' },
  // Accounting
  accountHead: {
    type: String,
    enum: ['assets', 'liabilities', 'equity', 'income', 'expenses', 'cogs', 'tax', 'bank', 'cash', 'inventory'],
    default: 'income'
  },
  // Metadata
  description: { type: String, default: '' },
  notes: { type: String, default: '' },
  attachments: [String],
  // Line items
  lineItems: [{
    description: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    hsnCode: { type: String, default: '' }
  }],
  // Approval
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected', 'cancelled'],
    default: 'approved'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminProfile',
    required: true
  }
}, {
  timestamps: true
});

financeTransactionSchema.index({ type: 1, createdAt: -1 });
financeTransactionSchema.index({ category: 1, createdAt: -1 });
financeTransactionSchema.index({ paymentStatus: 1 });
financeTransactionSchema.index({ partyName: 1 });
financeTransactionSchema.index({ accountHead: 1 });
financeTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FinanceTransaction', financeTransactionSchema);
