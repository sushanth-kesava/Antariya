const mongoose = require('mongoose');

const posLineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  sku: { type: String, default: '' },
  variantSku: { type: String, default: '' },
  size: { type: String, default: '' },
  color: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true }
}, { _id: true });

const posInvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  // Customer (optional for walk-ins)
  customerName: { type: String, default: 'Walk-in Customer' },
  customerPhone: { type: String, default: '' },
  customerEmail: { type: String, default: '' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProfile', default: null },
  // Items
  items: [posLineItemSchema],
  // Totals
  subtotal: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['flat', 'percentage', 'none'], default: 'none' },
  discountValue: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  // Payment
  paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'mixed', 'credit'], default: 'cash' },
  paymentStatus: { type: String, enum: ['paid', 'partial', 'credit', 'refunded'], default: 'paid' },
  amountPaid: { type: Number, default: 0 },
  changeGiven: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  // Store info
  storeName: { type: String, default: 'Antariya Store' },
  storeLocation: { type: String, default: '' },
  // GST
  gst: {
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    gstNumber: { type: String, default: '' }
  },
  // Status
  status: { type: String, enum: ['completed', 'returned', 'partially_returned', 'cancelled'], default: 'completed' },
  // Return tracking
  returnedItems: [{
    lineItemId: { type: mongoose.Schema.Types.ObjectId },
    quantity: { type: Number },
    reason: { type: String },
    refundAmount: { type: Number },
    returnedAt: { type: Date, default: Date.now }
  }],
  notes: { type: String, default: '' },
  billedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminProfile', required: true },
  // Barcode scanned
  scannedBarcodes: [String]
}, {
  timestamps: true
});

posInvoiceSchema.index({ createdAt: -1 });
posInvoiceSchema.index({ customerPhone: 1 });
posInvoiceSchema.index({ billedBy: 1, createdAt: -1 });
posInvoiceSchema.index({ status: 1 });

module.exports = mongoose.model('POSInvoice', posInvoiceSchema);
