const mongoose = require('mongoose');

const countItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sku: { type: String, required: true },
  productName: { type: String, required: true },
  binId: { type: mongoose.Schema.Types.ObjectId, ref: 'WarehouseBin' },
  binLocation: { type: String },
  expectedQuantity: { type: Number, required: true },
  countedQuantity: { type: Number, default: null },
  variance: { type: Number, default: 0 },
  variancePercentage: { type: Number, default: 0 },
  scannedBarcode: { type: String, default: null },
  status: {
    type: String,
    enum: ['pending', 'counted', 'missing', 'extra', 'matched'],
    default: 'pending'
  },
  countedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  countedAt: { type: Date },
  notes: { type: String, default: '' }
}, { _id: true });

const physicalInventoryCountSchema = new mongoose.Schema({
  countNumber: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  countType: {
    type: String,
    enum: ['full', 'partial', 'cycle', 'spot_check'],
    default: 'full'
  },
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'completed', 'approved', 'rejected', 'cancelled'],
    default: 'draft'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  items: [countItemSchema],
  summary: {
    totalItems: { type: Number, default: 0 },
    countedItems: { type: Number, default: 0 },
    matchedItems: { type: Number, default: 0 },
    missingItems: { type: Number, default: 0 },
    extraItems: { type: Number, default: 0 },
    totalVariance: { type: Number, default: 0 },
    accuracyPercentage: { type: Number, default: 0 },
    totalExpectedValue: { type: Number, default: 0 },
    totalCountedValue: { type: Number, default: 0 },
    varianceValue: { type: Number, default: 0 }
  },
  adjustmentApproval: {
    required: { type: Boolean, default: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    approvalNotes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'partial'],
      default: 'pending'
    }
  },
  assignedTeam: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['counter', 'verifier', 'supervisor'], default: 'counter' }
  }],
  filters: {
    categories: [String],
    racks: [String],
    shelves: [String],
    zones: [String]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

physicalInventoryCountSchema.index({ warehouseId: 1, status: 1 });
physicalInventoryCountSchema.index({ countNumber: 1 });
physicalInventoryCountSchema.index({ scheduledDate: 1 });
physicalInventoryCountSchema.index({ 'items.productId': 1 });

module.exports = mongoose.model('PhysicalInventoryCount', physicalInventoryCountSchema);
