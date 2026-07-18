const mongoose = require('mongoose');

const barcodeSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sku: {
    type: String,
    required: true,
    index: true
  },
  variantId: {
    type: String,
    default: null
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  barcodeType: {
    type: String,
    enum: ['CODE128', 'QR'],
    required: true
  },
  barcodeData: {
    type: String,
    required: true
  },
  barcodeImage: {
    type: String, // Base64 or Cloudinary URL
    default: null
  },
  qrData: {
    productName: String,
    currentStock: Number,
    warehouse: String,
    batch: String,
    manufacturingDate: Date,
    supplier: String,
    price: Number,
    category: String
  },
  labelSize: {
    type: String,
    enum: ['30x20', '50x30', 'A4', 'thermal'],
    default: '50x30'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  printCount: {
    type: Number,
    default: 0
  },
  lastPrintedAt: {
    type: Date,
    default: null
  },
  lastPrintedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound indexes for fast lookups
barcodeSchema.index({ productId: 1, warehouseId: 1 });
barcodeSchema.index({ sku: 1, barcodeType: 1 });
barcodeSchema.index({ barcodeData: 1 }, { unique: true });

module.exports = mongoose.model('Barcode', barcodeSchema);
