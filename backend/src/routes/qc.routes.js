const express = require('express');
const router = express.Router();
const qcController = require('../controllers/qc.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

router.use(requireAuth);

// Create a new QC inspection
router.post('/', requireRole('admin', 'superadmin', 'qc_inspector', 'manager'), qcController.createInspection);

// Get all inspections (with filters)
router.get('/', requireRole('admin', 'superadmin', 'qc_inspector', 'manager'), qcController.getInspections);

// Dashboard stats
router.get('/dashboard', requireRole('admin', 'superadmin', 'qc_inspector', 'manager'), qcController.getDashboard);

// Get checklist template for a stage
router.get('/checklist/:stage', requireRole('admin', 'superadmin', 'qc_inspector', 'manager'), qcController.getStageChecklist);

// Get single inspection
router.get('/:id', requireRole('admin', 'superadmin', 'qc_inspector', 'manager'), qcController.getInspectionById);

// Update checklist items
router.patch('/:id/checklist', requireRole('admin', 'superadmin', 'qc_inspector'), qcController.updateChecklist);

// Add a defect
router.post('/:id/defects', requireRole('admin', 'superadmin', 'qc_inspector'), qcController.addDefect);

// Update inspection status (pass/reject/hold/rework)
router.patch('/:id/status', requireRole('admin', 'superadmin', 'qc_inspector', 'manager'), qcController.updateStatus);

// Add images
router.post('/:id/images', requireRole('admin', 'superadmin', 'qc_inspector'), qcController.addImages);

module.exports = router;
