/**
 * Admin Dashboard Routes
 * API endpoints for admin dashboard metrics
 */

const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../../middleware/error-handler.middleware");
const adminDashboard = require("../../controllers/admin-dashboard.controller");
const { limiters } = require("../../middleware/rate-limiter.middleware");

// Apply rate limiting (dashboard-specific)
router.use(limiters.dashboard);

/**
 * Revenue endpoints
 */
router.get("/revenue/today", asyncHandler(adminDashboard.getTodayRevenue));
router.get("/revenue/weekly", asyncHandler(adminDashboard.getWeeklyRevenue));
router.get("/revenue/monthly", asyncHandler(adminDashboard.getMonthlyRevenue));

/**
 * Order endpoints
 */
router.get("/orders/today", asyncHandler(adminDashboard.getOrdersToday));
router.get("/orders/pending", asyncHandler(adminDashboard.getPendingOrders));

/**
 * Inventory endpoints
 */
router.get("/inventory/low-stock", asyncHandler(adminDashboard.getLowStockProducts));
router.get("/inventory/value", asyncHandler(adminDashboard.getInventoryValue));

/**
 * Product endpoints
 */
router.get("/products/best-selling", asyncHandler(adminDashboard.getBestSellingProducts));

/**
 * Customer endpoints
 */
router.get("/customers", asyncHandler(adminDashboard.getCustomerStats));

/**
 * Snapshot (all metrics at once)
 */
router.get("/snapshot", asyncHandler(adminDashboard.getDashboardSnapshot));

module.exports = router;
