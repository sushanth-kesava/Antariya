/**
 * Admin Reporting Routes
 * API endpoints for report generation and export
 */

const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../../middleware/error-handler.middleware");
const adminReporting = require("../../controllers/admin-reporting.controller");
const { limiters } = require("../../middleware/rate-limiter.middleware");

// Apply moderate rate limiting
router.use(limiters.retrieve);

/**
 * Revenue report
 * POST /api/admin/reports/revenue
 * Body: { fromDate, toDate, format: 'json|csv|excel|pdf' }
 */
router.post("/revenue", asyncHandler(adminReporting.generateRevenueReport));

/**
 * Profit report
 * POST /api/admin/reports/profit
 * Body: { fromDate, toDate, format: 'json|csv|excel|pdf' }
 */
router.post("/profit", asyncHandler(adminReporting.generateProfitReport));

/**
 * Inventory report
 * GET /api/admin/reports/inventory?format=json|csv|excel|pdf
 */
router.get("/inventory", asyncHandler(adminReporting.generateInventoryReport));

/**
 * Customer report
 * GET /api/admin/reports/customers?format=json|csv|excel|pdf
 */
router.get("/customers", asyncHandler(adminReporting.generateCustomerReport));

module.exports = router;
