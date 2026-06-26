/**
 * Admin Dashboard Controller
 * HTTP handlers for admin dashboard endpoints
 */

const dashboardService = require("../../services/admin/dashboard.service");
const { logError } = require("../../middleware/error-handler.middleware");

/**
 * GET /api/admin/dashboard/revenue/today
 */
async function getTodayRevenue(req, res, next) {
  try {
    const data = await dashboardService.getTodayRevenue();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_today_revenue_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/revenue/weekly
 */
async function getWeeklyRevenue(req, res, next) {
  try {
    const { days = 7 } = req.query;
    const data = await dashboardService.getWeeklyRevenue(parseInt(days));
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_weekly_revenue_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/revenue/monthly
 */
async function getMonthlyRevenue(req, res, next) {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: "Month and year required",
      });
    }

    const data = await dashboardService.getMonthlyRevenue(
      parseInt(month),
      parseInt(year)
    );
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_monthly_revenue_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/orders/today
 */
async function getOrdersToday(req, res, next) {
  try {
    const data = await dashboardService.getOrdersToday();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_orders_today_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/orders/pending
 */
async function getPendingOrders(req, res, next) {
  try {
    const data = await dashboardService.getPendingOrders();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_pending_orders_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/inventory/low-stock
 */
async function getLowStockProducts(req, res, next) {
  try {
    const { threshold = 10 } = req.query;
    const data = await dashboardService.getLowStockProducts(parseInt(threshold));
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_low_stock_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/inventory/value
 */
async function getInventoryValue(req, res, next) {
  try {
    const data = await dashboardService.getInventoryValue();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_inventory_value_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/products/best-selling
 */
async function getBestSellingProducts(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    const data = await dashboardService.getBestSellingProducts(parseInt(limit));
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_best_sellers_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/customers
 */
async function getCustomerStats(req, res, next) {
  try {
    const data = await dashboardService.getCustomerStats();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logError("error", "get_customer_stats_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/dashboard/snapshot
 * Get all metrics at once
 */
async function getDashboardSnapshot(req, res, next) {
  try {
    const [
      todayRevenue,
      weeklyRevenue,
      ordersToday,
      pendingOrders,
      lowStock,
      inventoryValue,
      bestSellers,
      customers,
    ] = await Promise.all([
      dashboardService.getTodayRevenue(),
      dashboardService.getWeeklyRevenue(7),
      dashboardService.getOrdersToday(),
      dashboardService.getPendingOrders(),
      dashboardService.getLowStockProducts(10),
      dashboardService.getInventoryValue(),
      dashboardService.getBestSellingProducts(10),
      dashboardService.getCustomerStats(),
    ]);

    res.json({
      success: true,
      data: {
        todayRevenue,
        weeklyRevenue,
        ordersToday,
        pendingOrders,
        lowStock,
        inventoryValue,
        bestSellers,
        customers,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logError("error", "get_dashboard_snapshot_failed", {}, error);
    next(error);
  }
}

module.exports = {
  getTodayRevenue,
  getWeeklyRevenue,
  getMonthlyRevenue,
  getOrdersToday,
  getPendingOrders,
  getLowStockProducts,
  getInventoryValue,
  getBestSellingProducts,
  getCustomerStats,
  getDashboardSnapshot,
};
