/**
 * Reporting Service
 * Generate reports with export capabilities (CSV, Excel, PDF)
 *
 * @module reportingService
 * @description
 * Provides:
 * - Revenue and profit analytics
 * - Inventory analytics
 * - Customer analytics
 * - Vendor analytics
 * - Multiple export formats (CSV, Excel, PDF)
 */

const { Parser } = require("json2csv");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { getClient } = require("../odoo/auth.service");
const { withRetry } = require("../../utils/retry.util");
const { logError } = require("../../middleware/error-handler.middleware");

/**
 * Generate revenue report
 * @param {Date} fromDate - From date
 * @param {Date} toDate - To date
 * @param {string} format - Export format (json, csv, excel, pdf)
 */
async function generateRevenueReport(fromDate, toDate, format = "json") {
  try {
    const client = await getClient();

    const orders = await withRetry(
      () =>
        client.call("sale.order", "search_read", [
          [
            ["date_order", ">=", fromDate.toISOString()],
            ["date_order", "<=", toDate.toISOString()],
            ["state", "in", ["sale", "done"]],
          ],
        ], {
          fields: ["id", "name", "amount_total", "state", "date_order"],
          order: "date_order desc",
        }),
      "Fetch revenue report data",
      { maxRetries: 2 }
    );

    const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

    const reportData = {
      title: "Revenue Report",
      dateRange: { from: fromDate, to: toDate },
      totalOrders: orders.length,
      totalRevenue,
      averageOrder: orders.length > 0 ? totalRevenue / orders.length : 0,
      details: orders.map((o) => ({
        orderId: o.id,
        orderNumber: o.name,
        amount: o.amount_total,
        status: o.state,
        date: o.date_order,
      })),
    };

    // Export in requested format
    return await exportReport(reportData, format, `revenue_report_${Date.now()}`);
  } catch (error) {
    logError("error", "revenue_report_failed", {
      fromDate,
      toDate,
      format,
    }, error);
    throw error;
  }
}

/**
 * Generate profit report
 * @param {Date} fromDate
 * @param {Date} toDate
 * @param {string} format
 */
async function generateProfitReport(fromDate, toDate, format = "json") {
  try {
    const client = await getClient();

    const orders = await withRetry(
      () =>
        client.call("sale.order", "search_read", [
          [
            ["date_order", ">=", fromDate.toISOString()],
            ["date_order", "<=", toDate.toISOString()],
            ["state", "in", ["sale", "done"]],
          ],
        ], {
          fields: ["id", "name", "amount_total", "date_order"],
          order: "date_order desc",
        }),
      "Fetch orders for profit",
      { maxRetries: 2 }
    );

    // Get cost data
    const costData = await withRetry(
      () =>
        client.call("stock.picking", "search_read", [
          [["state", "=", "done"]],
        ], {
          fields: ["cost"],
        }),
      "Fetch cost data",
      { maxRetries: 2 }
    );

    const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);
    const totalCost = costData.reduce((sum, p) => sum + (p.cost || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const reportData = {
      title: "Profit Report",
      dateRange: { from: fromDate, to: toDate },
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin: profitMargin.toFixed(2),
      orders: orders.length,
    };

    return await exportReport(reportData, format, `profit_report_${Date.now()}`);
  } catch (error) {
    logError("error", "profit_report_failed", {
      fromDate,
      toDate,
    }, error);
    throw error;
  }
}

/**
 * Generate inventory report
 * @param {string} format
 */
async function generateInventoryReport(format = "json") {
  try {
    const client = await getClient();

    const products = await withRetry(
      () =>
        client.call("product.product", "search_read", [
          [["type", "=", "product"]],
        ], {
          fields: ["id", "name", "sku", "qty_available", "list_price"],
        }),
      "Fetch inventory",
      { maxRetries: 2 }
    );

    const reportData = {
      title: "Inventory Report",
      generatedAt: new Date(),
      totalItems: products.length,
      details: products.map((p) => ({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.qty_available,
        price: p.list_price,
        value: (p.qty_available || 0) * (p.list_price || 0),
      })),
    };

    const totalValue = reportData.details.reduce((sum, p) => sum + p.value, 0);
    reportData.totalValue = totalValue;

    return await exportReport(reportData, format, `inventory_report_${Date.now()}`);
  } catch (error) {
    logError("error", "inventory_report_failed", {}, error);
    throw error;
  }
}

/**
 * Generate customer report
 * @param {string} format
 */
async function generateCustomerReport(format = "json") {
  try {
    const client = await getClient();

    const customers = await withRetry(
      () =>
        client.call("res.partner", "search_read", [
          [["customer_rank", ">", 0]],
        ], {
          fields: ["id", "name", "email", "phone", "city", "country_id", "create_date"],
        }),
      "Fetch customers",
      { maxRetries: 2 }
    );

    const reportData = {
      title: "Customer Report",
      generatedAt: new Date(),
      totalCustomers: customers.length,
      details: customers.map((c) => ({
        customerId: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        country: c.country_id?.[1],
        joinDate: c.create_date,
      })),
    };

    return await exportReport(reportData, format, `customer_report_${Date.now()}`);
  } catch (error) {
    logError("error", "customer_report_failed", {}, error);
    throw error;
  }
}

/**
 * Export report in specified format
 */
async function exportReport(data, format, filename) {
  try {
    switch (format) {
      case "csv":
        return await exportCSV(data, filename);
      case "excel":
        return await exportExcel(data, filename);
      case "pdf":
        return await exportPDF(data, filename);
      case "json":
      default:
        return {
          data,
          filename: `${filename}.json`,
          contentType: "application/json",
        };
    }
  } catch (error) {
    logError("error", "export_report_failed", {
      filename,
      format,
    }, error);
    throw error;
  }
}

/**
 * Export to CSV
 */
async function exportCSV(data, filename) {
  try {
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data.details || [data]);

    return {
      data: csv,
      filename: `${filename}.csv`,
      contentType: "text/csv",
    };
  } catch (error) {
    logError("error", "csv_export_failed", {}, error);
    throw error;
  }
}

/**
 * Export to Excel
 */
async function exportExcel(data, filename) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    // Add headers
    if (data.details && data.details.length > 0) {
      const headers = Object.keys(data.details[0]);
      worksheet.addRow(headers);

      // Add data
      data.details.forEach((row) => {
        worksheet.addRow(Object.values(row));
      });
    }

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      data: buffer,
      filename: `${filename}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  } catch (error) {
    logError("error", "excel_export_failed", {}, error);
    throw error;
  }
}

/**
 * Export to PDF
 */
async function exportPDF(data, filename) {
  try {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    // Title
    doc.fontSize(20).text(data.title || "Report", { align: "center" });
    doc.moveDown();

    // Summary
    if (data.dateRange) {
      doc
        .fontSize(12)
        .text(
          `Period: ${data.dateRange.from.toDateString()} to ${data.dateRange.to.toDateString()}`
        );
    }
    doc
      .fontSize(12)
      .text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Details
    if (data.details && Array.isArray(data.details)) {
      data.details.forEach((item) => {
        Object.entries(item).forEach(([key, value]) => {
          doc.fontSize(10).text(`${key}: ${value}`);
        });
        doc.moveTo(0, doc.y).lineTo(doc.page.width, doc.y).stroke();
        doc.moveDown();
      });
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          data: buffer,
          filename: `${filename}.pdf`,
          contentType: "application/pdf",
        });
      });
      doc.on("error", reject);
    });
  } catch (error) {
    logError("error", "pdf_export_failed", {}, error);
    throw error;
  }
}

module.exports = {
  generateRevenueReport,
  generateProfitReport,
  generateInventoryReport,
  generateCustomerReport,
  exportReport,
};
