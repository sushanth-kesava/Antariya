const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
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
  movementType: {
    type: String,
    enum: ['received', 'sold', 'transferred', 'returned', 'damaged', 'adjusted', 'manual'],
    required: true
  },
  fromWarehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    default: null
  },
  toWarehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    default: null
  },
  fromBin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WarehouseBin',
    default: null
  },
  toBin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WarehouseBin',
    default: null
  },
  quantity: {
    type: Number,
    required: true
  },
  oldQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  unitCost: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  referenceType: {
    type: String,
    enum: ['order', 'purchase_order', 'transfer', 'adjustment', 'return', 'audit', 'manual'],
    default: 'manual'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  referenceNumber: {
    type: String,
    default: null
  },
  batch: {
    type: String,
    default: null
  },
  expiryDate: {
    type: Date,
    default: null
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    default: ''
  },
  scannedBarcode: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'reversed'],
    default: 'completed'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ipAddress: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for reporting and queries
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ movementType: 1, createdAt: -1 });
stockMovementSchema.index({ fromWarehouse: 1, createdAt: -1 });
stockMovementSchema.index({ toWarehouse: 1, createdAt: -1 });
stockMovementSchema.index({ referenceType: 1, referenceId: 1 });
stockMovementSchema.index({ performedBy: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
