const express = require("express");
const router = express.Router();
const {
  getTodaysSales,
  getMonthlySales,
  getTopProducts,
  getLowStockProducts,
  getPendingOrders,
  getRevenue,
  getCustomerStats,
  getProfit,
  getDashboardSnapshot,
  invalidateCache,
} = require("../controllers/odoo-dashboard.controller");

/**
 * Dashboard Routes
 * Comprehensive business metrics and analytics
 *
 * When mounted at /api/dashboard:
 *   GET /api/dashboard/today - today's sales
 *   GET /api/dashboard/monthly - monthly sales (with date filters)
 *   GET /api/dashboard/top-products - top sellers
 *   GET /api/dashboard/low-stock - products below threshold
 *   GET /api/dashboard/pending-orders - pending/overdue orders
 *   GET /api/dashboard/revenue - all revenue metrics
 *   GET /api/dashboard/customers - customer statistics
 *   GET /api/dashboard/profit - profit and margin
 *   GET /api/dashboard/snapshot - all metrics at once
 *   POST /api/dashboard/invalidate-cache - clear dashboard cache
 */

// Today's sales
router.get("/today", getTodaysSales);

// Monthly sales
router.get("/monthly", getMonthlySales);

// Top products
router.get("/top-products", getTopProducts);

// Low stock
router.get("/low-stock", getLowStockProducts);

// Pending orders
router.get("/pending-orders", getPendingOrders);

// Revenue
router.get("/revenue", getRevenue);

// Customer statistics
router.get("/customers", getCustomerStats);

// Profit
router.get("/profit", getProfit);

// Complete snapshot (must be before :metric to avoid conflicts)
router.get("/snapshot", getDashboardSnapshot);

// Invalidate cache
router.post("/invalidate-cache", invalidateCache);

module.exports = router;
