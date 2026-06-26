const dashboardService = require("../services/odoo/dashboard.service");

/**
 * Dashboard Controller
 * Handles all dashboard metric endpoints
 *
 * @module dashboardController
 */

/**
 * GET /api/dashboard/today
 * Get today's sales metrics
 *
 * @returns {200} Sales count, total amount, and order breakdown
 * @returns {500} Server error
 */
async function getTodaysSales(req, res, next) {
  try {
    const data = await dashboardService.getTodaysSales();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getTodaysSales error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch today's sales",
    });
  }
}

/**
 * GET /api/dashboard/monthly
 * Get monthly sales metrics
 * Query params: month (1-12), year (YYYY)
 *
 * @returns {200} Sales count, total, average order value, weekly breakdown
 * @returns {400} Invalid month/year
 * @returns {500} Server error
 */
async function getMonthlySales(req, res, next) {
  try {
    const { month, year } = req.query;

    // Validate month if provided
    if (month && (isNaN(month) || month < 1 || month > 12)) {
      return res.status(400).json({
        success: false,
        error: "Month must be between 1 and 12",
      });
    }

    // Validate year if provided
    if (year && (isNaN(year) || year < 2000)) {
      return res.status(400).json({
        success: false,
        error: "Year must be valid",
      });
    }

    const data = await dashboardService.getMonthlySales(
      month ? parseInt(month) : null,
      year ? parseInt(year) : null
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getMonthlySales error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly sales",
    });
  }
}

/**
 * GET /api/dashboard/top-products
 * Get top selling products this month
 * Query params: limit (default: 10, max: 50)
 *
 * @returns {200} Top products with sales metrics
 * @returns {400} Invalid limit
 * @returns {500} Server error
 */
async function getTopProducts(req, res, next) {
  try {
    let { limit } = req.query;
    limit = parseInt(limit) || 10;

    if (limit > 50) {
      return res.status(400).json({
        success: false,
        error: "Limit cannot exceed 50",
      });
    }

    const data = await dashboardService.getTopProducts(limit);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getTopProducts error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch top products",
    });
  }
}

/**
 * GET /api/dashboard/low-stock
 * Get products with low stock
 * Query params: threshold (default: 10), limit (default: 20)
 *
 * @returns {200} Products below threshold with stock locations
 * @returns {400} Invalid parameters
 * @returns {500} Server error
 */
async function getLowStockProducts(req, res, next) {
  try {
    let { threshold, limit } = req.query;
    threshold = parseInt(threshold) || 10;
    limit = parseInt(limit) || 20;

    if (threshold < 0) {
      return res.status(400).json({
        success: false,
        error: "Threshold must be non-negative",
      });
    }

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        error: "Limit cannot exceed 100",
      });
    }

    const data = await dashboardService.getLowStockProducts(threshold, limit);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getLowStockProducts error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch low stock products",
    });
  }
}

/**
 * GET /api/dashboard/pending-orders
 * Get pending orders (not confirmed/done)
 *
 * @returns {200} Pending orders with age in hours and overdue list
 * @returns {500} Server error
 */
async function getPendingOrders(req, res, next) {
  try {
    const data = await dashboardService.getPendingOrders();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getPendingOrders error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pending orders",
    });
  }
}

/**
 * GET /api/dashboard/revenue
 * Get revenue metrics (all-time, monthly, growth)
 *
 * @returns {200} Revenue breakdown with growth percentage
 * @returns {500} Server error
 */
async function getRevenue(req, res, next) {
  try {
    const data = await dashboardService.getRevenue();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getRevenue error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch revenue",
    });
  }
}

/**
 * GET /api/dashboard/customers
 * Get customer statistics
 *
 * @returns {200} Total, new, active, inactive customer counts
 * @returns {500} Server error
 */
async function getCustomerStats(req, res, next) {
  try {
    const data = await dashboardService.getCustomerStats();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getCustomerStats error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch customer statistics",
    });
  }
}

/**
 * GET /api/dashboard/profit
 * Get profit metrics
 *
 * @returns {200} Profit, margin, monthly comparison
 * @returns {500} Server error
 */
async function getProfit(req, res, next) {
  try {
    const data = await dashboardService.getProfit();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getProfit error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profit",
    });
  }
}

/**
 * GET /api/dashboard/snapshot
 * Get complete dashboard snapshot (all metrics at once)
 * Optimized for dashboard load performance
 *
 * @returns {200} All dashboard metrics with timestamp
 * @returns {500} Server error
 */
async function getDashboardSnapshot(req, res, next) {
  try {
    const data = await dashboardService.getDashboardSnapshot();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[Dashboard Controller] getDashboardSnapshot error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard snapshot",
    });
  }
}

/**
 * POST /api/dashboard/invalidate-cache
 * Manually invalidate dashboard cache
 * Body: { metrics: ["todaySales", "pendingOrders"] } or empty to invalidate all
 *
 * @returns {200} Cache invalidated
 * @returns {500} Server error
 */
async function invalidateCache(req, res, next) {
  try {
    const { metrics } = req.body;

    if (metrics && !Array.isArray(metrics)) {
      return res.status(400).json({
        success: false,
        error: "metrics must be an array",
      });
    }

    dashboardService.invalidateCache(metrics || []);

    res.status(200).json({
      success: true,
      message: metrics && metrics.length > 0 
        ? `Cache invalidated for: ${metrics.join(", ")}`
        : "All dashboard cache invalidated",
    });
  } catch (err) {
    console.error("[Dashboard Controller] invalidateCache error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to invalidate cache",
    });
  }
}

module.exports = {
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
};
