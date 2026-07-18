const mongoose = require('mongoose');

const warehouseBinSchema = new mongoose.Schema({
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  rack: {
    type: String,
    required: true,
    trim: true
  },
  shelf: {
    type: String,
    required: true,
    trim: true
  },
  bin: {
    type: String,
    required: true,
    trim: true
  },
  binCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  capacity: {
    maxItems: { type: Number, default: 100 },
    currentItems: { type: Number, default: 0 },
    maxWeight: { type: Number, default: 50 }, // kg
    currentWeight: { type: Number, default: 0 }
  },
  assignedProducts: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    sku: String,
    quantity: Number,
    assignedAt: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['available', 'full', 'reserved', 'maintenance', 'inactive'],
    default: 'available'
  },
  zone: {
    type: String,
    enum: ['receiving', 'storage', 'picking', 'packing', 'shipping', 'returns'],
    default: 'storage'
  },
  temperature: {
    type: String,
    enum: ['ambient', 'cool', 'cold', 'frozen'],
    default: 'ambient'
  },
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for location lookup
warehouseBinSchema.index({ warehouseId: 1, rack: 1, shelf: 1, bin: 1 });
warehouseBinSchema.index({ 'assignedProducts.productId': 1 });

// Virtual for full location string
warehouseBinSchema.virtual('fullLocation').get(function() {
  return `${this.rack}-${this.shelf}-${this.bin}`;
});

warehouseBinSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('WarehouseBin', warehouseBinSchema);
