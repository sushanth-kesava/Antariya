const mongoose = require('mongoose');

const ticketNoteSchema = new mongoose.Schema({
  message: { type: String, required: true },
  isInternal: { type: Boolean, default: false },
  attachments: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true, index: true },
  // Source
  source: { type: String, enum: ['website', 'email', 'whatsapp', 'phone', 'instagram', 'manual'], default: 'manual' },
  // Customer
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProfile', default: null },
  customerName: { type: String, required: true },
  customerEmail: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  // Ticket
  category: {
    type: String,
    enum: ['order_issue', 'payment', 'refund', 'exchange', 'return', 'delivery', 'complaint', 'product_inquiry', 'technical', 'other'],
    required: true
  },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  // Status
  status: {
    type: String,
    enum: ['open', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'escalated'],
    default: 'open'
  },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null },
  assignedAt: { type: Date, default: null },
  // SLA
  responseDeadline: { type: Date, default: null },
  resolutionDeadline: { type: Date, default: null },
  firstResponseAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  // Related
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderNumber: { type: String, default: '' },
  // Notes & timeline
  notes: [ticketNoteSchema],
  tags: [String],
  // Satisfaction
  csat: { type: Number, min: 1, max: 5, default: null },
  csatFeedback: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', default: null }
}, { timestamps: true });

supportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ customerId: 1 });
supportTicketSchema.index({ category: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
