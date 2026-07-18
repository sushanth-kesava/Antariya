const mongoose = require('mongoose');

const defectSchema = new mongoose.Schema({
  defectType: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['minor', 'major', 'critical'],
    default: 'minor'
  },
  rootCause: {
    type: String,
    default: ''
  },
  assignedDepartment: {
    type: String,
    default: ''
  },
  correctiveAction: {
    type: String,
    default: ''
  },
  images: [String],
  notes: { type: String, default: '' }
}, { _id: true });

const checklistItemSchema = new mongoose.Schema({
  item: { type: String, required: true },
  passed: { type: Boolean, default: null },
  notes: { type: String, default: '' },
  measuredValue: { type: String, default: '' }
}, { _id: true });

const qcInspectionSchema = new mongoose.Schema({
  inspectionNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  batchNumber: {
    type: String,
    default: ''
  },
  stage: {
    type: String,
    enum: [
      'incoming_fabric',
      'printing',
      'embroidery',
      'stitching',
      'washing',
      'ironing',
      'packing',
      'final_dispatch'
    ],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'passed', 'rejected', 'hold', 'rework', 'disposed'],
    default: 'pending'
  },
  checklist: [checklistItemSchema],
  defects: [defectSchema],
  images: {
    before: [String],
    after: [String],
    defects: [String]
  },
  quantity: {
    inspected: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    rework: { type: Number, default: 0 }
  },
  supplier: {
    name: { type: String, default: '' },
    id: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  factory: {
    name: { type: String, default: '' },
    location: { type: String, default: '' }
  },
  inspectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminProfile',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminProfile',
    default: null
  },
  approvedAt: { type: Date, default: null },
  notes: { type: String, default: '' },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: true
});

qcInspectionSchema.index({ productId: 1, stage: 1 });
qcInspectionSchema.index({ status: 1, createdAt: -1 });
qcInspectionSchema.index({ inspectedBy: 1 });
qcInspectionSchema.index({ stage: 1, status: 1 });

module.exports = mongoose.model('QCInspection', qcInspectionSchema);
