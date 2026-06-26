/**
 * Reporting Controller
 * HTTP handlers for report generation and export
 */

const reportingService = require("../../services/admin/reporting.service");
const { logError } = require("../../middleware/error-handler.middleware");

/**
 * POST /api/admin/reports/revenue
 * Generate revenue report with export
 */
async function generateRevenueReport(req, res, next) {
  try {
    const { fromDate, toDate, format = "json" } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        error: "fromDate and toDate required",
      });
    }

    if (!["json", "csv", "excel", "pdf"].includes(format)) {
      return res.status(400).json({
        success: false,
        error: "Format must be json, csv, excel, or pdf",
      });
    }

    const report = await reportingService.generateRevenueReport(
      new Date(fromDate),
      new Date(toDate),
      format
    );

    // Set response headers for file download if applicable
    if (format !== "json") {
      res.setHeader("Content-Type", report.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${report.filename}"`
      );
      res.send(report.data);
    } else {
      res.json({
        success: true,
        data: report.data,
      });
    }
  } catch (error) {
    logError("error", "generate_revenue_report_failed", {}, error);
    next(error);
  }
}

/**
 * POST /api/admin/reports/profit
 * Generate profit report
 */
async function generateProfitReport(req, res, next) {
  try {
    const { fromDate, toDate, format = "json" } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        error: "fromDate and toDate required",
      });
    }

    const report = await reportingService.generateProfitReport(
      new Date(fromDate),
      new Date(toDate),
      format
    );

    if (format !== "json") {
      res.setHeader("Content-Type", report.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${report.filename}"`
      );
      res.send(report.data);
    } else {
      res.json({
        success: true,
        data: report.data,
      });
    }
  } catch (error) {
    logError("error", "generate_profit_report_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/reports/inventory
 * Generate inventory report
 */
async function generateInventoryReport(req, res, next) {
  try {
    const { format = "json" } = req.query;

    const report = await reportingService.generateInventoryReport(format);

    if (format !== "json") {
      res.setHeader("Content-Type", report.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${report.filename}"`
      );
      res.send(report.data);
    } else {
      res.json({
        success: true,
        data: report.data,
      });
    }
  } catch (error) {
    logError("error", "generate_inventory_report_failed", {}, error);
    next(error);
  }
}

/**
 * GET /api/admin/reports/customers
 * Generate customer report
 */
async function generateCustomerReport(req, res, next) {
  try {
    const { format = "json" } = req.query;

    const report = await reportingService.generateCustomerReport(format);

    if (format !== "json") {
      res.setHeader("Content-Type", report.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${report.filename}"`
      );
      res.send(report.data);
    } else {
      res.json({
        success: true,
        data: report.data,
      });
    }
  } catch (error) {
    logError("error", "generate_customer_report_failed", {}, error);
    next(error);
  }
}

module.exports = {
  generateRevenueReport,
  generateProfitReport,
  generateInventoryReport,
  generateCustomerReport,
};
