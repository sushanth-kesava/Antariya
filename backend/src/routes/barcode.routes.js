const express = require('express');
const router = express.Router();
const barcodeController = require('../controllers/barcode.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(requireAuth);

// ─── BARCODE MANAGEMENT ──────────────────────────────────────────

// Generate barcode for a product
router.post(
  '/generate',
  requireRole('admin', 'superadmin', 'warehouse_staff'),
  barcodeController.generateBarcode
);

// Bulk generate barcodes
router.post(
  '/generate/bulk',
  requireRole('admin', 'superadmin'),
  barcodeController.bulkGenerateBarcodes
);

// Search barcodes
router.get(
  '/search',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.searchBarcodes
);

// Get barcodes for a product
router.get(
  '/product/:productId',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.getProductBarcodes
);

// Record print action
router.post(
  '/print',
  requireRole('admin', 'superadmin', 'warehouse_staff'),
  barcodeController.recordPrint
);

// ─── SCANNER ─────────────────────────────────────────────────────

// Process a barcode scan
router.post(
  '/scan',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.processScan
);

// Look up barcode data
router.get(
  '/lookup/:barcodeData',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.findByBarcodeData
);

// ─── WAREHOUSE BIN MANAGEMENT ────────────────────────────────────

// Create a bin
router.post(
  '/bins',
  requireRole('admin', 'superadmin'),
  barcodeController.createBin
);

// Bulk create bins
router.post(
  '/bins/bulk',
  requireRole('admin', 'superadmin'),
  barcodeController.bulkCreateBins
);

// Assign product to bin
router.post(
  '/bins/assign',
  requireRole('admin', 'superadmin', 'warehouse_staff'),
  barcodeController.assignProductToBin
);

// Get bins for a warehouse
router.get(
  '/bins/warehouse/:warehouseId',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.getWarehouseBins
);

// Get product location (which bins it's in)
router.get(
  '/bins/product/:productId',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.getProductLocation
);

// ─── STOCK MOVEMENTS ─────────────────────────────────────────────

// Record a stock movement
router.post(
  '/movements',
  requireRole('admin', 'superadmin', 'warehouse_staff'),
  barcodeController.recordMovement
);

// Get movement history
router.get(
  '/movements',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.getMovementHistory
);

// ─── PHYSICAL INVENTORY COUNT ────────────────────────────────────

// Create audit session
router.post(
  '/audit',
  requireRole('admin', 'superadmin', 'manager'),
  barcodeController.createAuditSession
);

// Get audit sessions
router.get(
  '/audit',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.getAuditSessions
);

// Record a count in audit session
router.post(
  '/audit/:sessionId/count',
  requireRole('admin', 'superadmin', 'warehouse_staff'),
  barcodeController.recordCount
);

// Complete audit session
router.patch(
  '/audit/:sessionId/complete',
  requireRole('admin', 'superadmin', 'manager'),
  barcodeController.completeAuditSession
);

// Approve audit adjustments
router.patch(
  '/audit/:sessionId/approve',
  requireRole('admin', 'superadmin'),
  barcodeController.approveAuditAdjustments
);

// ─── DASHBOARD ───────────────────────────────────────────────────

// Get barcode inventory dashboard stats
router.get(
  '/dashboard',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.getDashboardStats
);

// ─── LABEL DOWNLOAD ──────────────────────────────────────────────

// Download single product label PDF
router.get(
  '/label/:productId',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.downloadLabel
);

// Download bulk labels PDF (multiple products)
router.post(
  '/labels/bulk',
  requireRole('admin', 'superadmin', 'warehouse_staff', 'manager'),
  barcodeController.downloadBulkLabels
);

module.exports = router;
