const QCInspection = require('../models/QCInspection');
const Product = require('../models/Product');

// Default checklist items per stage
const STAGE_CHECKLISTS = {
  incoming_fabric: ['Fabric GSM', 'Color Match', 'Shrinkage Test', 'Needle Marks', 'Stains', 'Fabric Width', 'Weave Quality'],
  printing: ['Print Alignment', 'Color Accuracy', 'Print Durability', 'No Smudging', 'Coverage Complete'],
  embroidery: ['Embroidery Accuracy', 'Thread Quality', 'Stitch Density', 'Design Match', 'No Puckering', 'Back Finish'],
  stitching: ['Measurement Accuracy', 'Seam Strength', 'Stitch Quality', 'Thread Tension', 'Loose Threads', 'Label Placement'],
  washing: ['Color Fastness', 'No Shrinkage', 'Softness', 'No Damage', 'No Bleeding'],
  ironing: ['Wrinkle Free', 'No Shine Marks', 'Proper Fold', 'No Scorch'],
  packing: ['Barcode Attached', 'Hang Tag', 'Brand Tag', 'Polybag', 'Size Label', 'Care Label', 'Correct Quantity'],
  final_dispatch: ['QC Sticker', 'Invoice Match', 'Address Label', 'Package Sealed', 'Weight Check', 'Fragile Label']
};

class QCService {

  /**
   * Create a new QC inspection
   */
  static async createInspection({ productId, orderId, batchNumber, stage, supplier, factory, priority, userId }) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const count = await QCInspection.countDocuments();
    const inspectionNumber = `QC-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;

    // Auto-populate checklist for the stage
    const checklistItems = (STAGE_CHECKLISTS[stage] || []).map(item => ({
      item,
      passed: null,
      notes: '',
      measuredValue: ''
    }));

    const inspection = await QCInspection.create({
      inspectionNumber,
      productId,
      orderId: orderId || null,
      batchNumber: batchNumber || '',
      stage,
      status: 'pending',
      checklist: checklistItems,
      supplier: supplier || {},
      factory: factory || {},
      priority: priority || 'medium',
      inspectedBy: userId
    });

    return inspection;
  }

  /**
   * Update checklist item result
   */
  static async updateChecklist({ inspectionId, checklistItemId, passed, notes, measuredValue }) {
    const inspection = await QCInspection.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    const item = inspection.checklist.id(checklistItemId);
    if (!item) throw new Error('Checklist item not found');

    if (passed !== undefined) item.passed = passed;
    if (notes !== undefined) item.notes = notes;
    if (measuredValue !== undefined) item.measuredValue = measuredValue;

    await inspection.save();
    return inspection;
  }

  /**
   * Add a defect to an inspection
   */
  static async addDefect({ inspectionId, defectType, severity, rootCause, assignedDepartment, correctiveAction, images, notes }) {
    const inspection = await QCInspection.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    inspection.defects.push({
      defectType,
      severity: severity || 'minor',
      rootCause: rootCause || '',
      assignedDepartment: assignedDepartment || '',
      correctiveAction: correctiveAction || '',
      images: images || [],
      notes: notes || ''
    });

    await inspection.save();
    return inspection;
  }

  /**
   * Update inspection status (pass/reject/hold/rework)
   */
  static async updateStatus({ inspectionId, status, quantity, notes, userId }) {
    const inspection = await QCInspection.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    inspection.status = status;
    if (notes) inspection.notes = notes;

    if (quantity) {
      inspection.quantity = {
        inspected: quantity.inspected || inspection.quantity.inspected,
        passed: quantity.passed || 0,
        rejected: quantity.rejected || 0,
        rework: quantity.rework || 0
      };
    }

    if (['passed', 'rejected'].includes(status)) {
      inspection.approvedBy = userId;
      inspection.approvedAt = new Date();
    }

    await inspection.save();
    return inspection;
  }

  /**
   * Upload images to an inspection
   */
  static async addImages({ inspectionId, imageType, imageUrls }) {
    const inspection = await QCInspection.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    if (imageType === 'before') inspection.images.before.push(...imageUrls);
    else if (imageType === 'after') inspection.images.after.push(...imageUrls);
    else if (imageType === 'defects') inspection.images.defects.push(...imageUrls);

    await inspection.save();
    return inspection;
  }

  /**
   * Get inspections with filters
   */
  static async getInspections({ productId, stage, status, priority, startDate, endDate, page = 1, limit = 20 }) {
    const filter = {};
    if (productId) filter.productId = productId;
    if (stage) filter.stage = stage;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [inspections, total] = await Promise.all([
      QCInspection.find(filter)
        .populate('productId', 'name sku images price')
        .populate('inspectedBy', 'displayName email')
        .populate('approvedBy', 'displayName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      QCInspection.countDocuments(filter)
    ]);

    return { inspections, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Get a single inspection by ID
   */
  static async getInspectionById(inspectionId) {
    const inspection = await QCInspection.findById(inspectionId)
      .populate('productId', 'name sku images price category')
      .populate('inspectedBy', 'displayName email')
      .populate('approvedBy', 'displayName email');

    if (!inspection) throw new Error('Inspection not found');
    return inspection;
  }

  /**
   * Get QC dashboard stats
   */
  static async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalInspections,
      pendingCount,
      passedCount,
      rejectedCount,
      reworkCount,
      todayInspections,
      recentDefects
    ] = await Promise.all([
      QCInspection.countDocuments(),
      QCInspection.countDocuments({ status: 'pending' }),
      QCInspection.countDocuments({ status: 'passed', createdAt: { $gte: thirtyDaysAgo } }),
      QCInspection.countDocuments({ status: 'rejected', createdAt: { $gte: thirtyDaysAgo } }),
      QCInspection.countDocuments({ status: 'rework', createdAt: { $gte: thirtyDaysAgo } }),
      QCInspection.countDocuments({ createdAt: { $gte: today } }),
      QCInspection.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $unwind: '$defects' },
        { $group: { _id: '$defects.defectType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    const totalChecked = passedCount + rejectedCount + reworkCount;
    const passRate = totalChecked > 0 ? ((passedCount / totalChecked) * 100).toFixed(1) : 0;
    const rejectRate = totalChecked > 0 ? ((rejectedCount / totalChecked) * 100).toFixed(1) : 0;
    const reworkRate = totalChecked > 0 ? ((reworkCount / totalChecked) * 100).toFixed(1) : 0;

    // Stage-wise breakdown
    const stageBreakdown = await QCInspection.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { stage: '$stage', status: '$status' }, count: { $sum: 1 } } }
    ]);

    // Supplier quality scores
    const supplierScores = await QCInspection.aggregate([
      { $match: { 'supplier.name': { $ne: '' }, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: '$supplier.name',
        total: { $sum: 1 },
        passed: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } }
      }},
      { $project: { supplier: '$_id', total: 1, passed: 1, score: { $multiply: [{ $divide: ['$passed', '$total'] }, 100] } } },
      { $sort: { score: -1 } },
      { $limit: 10 }
    ]);

    return {
      totalInspections,
      pendingCount,
      passedCount,
      rejectedCount,
      reworkCount,
      todayInspections,
      passRate: Number(passRate),
      rejectRate: Number(rejectRate),
      reworkRate: Number(reworkRate),
      topDefects: recentDefects,
      stageBreakdown,
      supplierScores
    };
  }

  /**
   * Get available checklist for a stage
   */
  static getStageChecklist(stage) {
    return STAGE_CHECKLISTS[stage] || [];
  }
}

module.exports = QCService;
