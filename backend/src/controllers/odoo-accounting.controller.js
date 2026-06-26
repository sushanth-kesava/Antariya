const accountingService = require("../services/odoo/accounting.service");

/**
 * GET /api/accounting/invoices
 * List invoices with pagination and filtering.
 * Query params: offset, limit, customerId, state, search, fromDate, toDate
 */
async function getInvoices(req, res, next) {
  try {
    const { offset = 0, limit = 20, customerId, state, search, fromDate, toDate } = req.query;

    const result = await accountingService.getInvoices({
      offset,
      limit,
      customerId,
      state,
      search,
      fromDate,
      toDate,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error fetching invoices:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch invoices",
    });
  }
}

/**
 * GET /api/accounting/invoices/:id
 * Fetch invoice by ID with full details.
 */
async function getInvoice(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Invoice ID is required",
      });
    }

    const invoice = await accountingService.getInvoiceById(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch invoice",
    });
  }
}

/**
 * POST /api/accounting/invoices
 * Create invoice from sales order.
 * Body: { salesOrderId }
 */
async function createInvoice(req, res, next) {
  try {
    const { salesOrderId } = req.body;

    if (!salesOrderId) {
      return res.status(400).json({
        success: false,
        error: "Sales order ID is required",
      });
    }

    const invoice = await accountingService.createInvoiceFromSalesOrder(salesOrderId);

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (err) {
    console.error("Error creating invoice:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    if (err.message && err.message.includes("must be confirmed")) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create invoice",
    });
  }
}

/**
 * POST /api/accounting/invoices/:id/post
 * Post (validate) invoice - moves from draft to posted.
 */
async function postInvoice(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Invoice ID is required",
      });
    }

    const invoice = await accountingService.postInvoice(id);

    res.status(200).json({
      success: true,
      message: "Invoice posted successfully",
      data: invoice,
    });
  } catch (err) {
    console.error("Error posting invoice:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    if (err.message && err.message.includes("cannot be posted")) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to post invoice",
    });
  }
}

/**
 * GET /api/accounting/invoices/:id/pdf
 * Download invoice as PDF.
 */
async function getInvoicePDF(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Invoice ID is required",
      });
    }

    const pdfData = await accountingService.getInvoicePDF(id);

    // Return PDF as download
    res.setHeader("Content-Type", pdfData.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${pdfData.filename}"`);
    res.send(Buffer.from(pdfData.pdf, "base64"));
  } catch (err) {
    console.error("Error fetching invoice PDF:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to generate PDF",
    });
  }
}

/**
 * GET /api/accounting/invoices/:id/status
 * Get invoice status with detailed payment state.
 */
async function getInvoiceStatus(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Invoice ID is required",
      });
    }

    const invoice = await accountingService.getInvoiceById(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        invoiceNo: invoice.name,
        state: invoice.state,
        paymentState: invoice.paymentState,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        outstanding: invoice.total - invoice.amountPaid,
        dueDate: invoice.dueDate,
        statusMessage: `Invoice ${invoice.name} is ${invoice.state} with payment status: ${invoice.paymentState}`,
      },
    });
  } catch (err) {
    console.error("Error fetching invoice status:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch invoice status",
    });
  }
}

/**
 * GET /api/accounting/invoices/:id/gst
 * Get GST details from invoice.
 * TEMPORARILY DISABLED - GST functionality on hold pending GST registration.
 */
async function getInvoiceGST(req, res, next) {
  return res.status(503).json({
    success: false,
    error: "GST functionality is temporarily unavailable. Please register a GST number to enable this feature.",
  });
}

/**
 * GET /api/accounting/ledger/:customerId
 * Get customer ledger - all transactions with customer.
 * Query params: offset, limit
 */
async function getCustomerLedger(req, res, next) {
  try {
    const { customerId } = req.params;
    const { offset = 0, limit = 50 } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const result = await accountingService.getCustomerLedger(customerId, {
      offset,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error fetching customer ledger:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch customer ledger",
    });
  }
}

/**
 * GET /api/accounting/tax-summary/:customerId
 * Get tax summary for customer within date range.
 * TEMPORARILY DISABLED - GST functionality on hold pending GST registration.
 */
async function getTaxSummary(req, res, next) {
  return res.status(503).json({
    success: false,
    error: "GST functionality is temporarily unavailable. Please register a GST number to enable this feature.",
  });
}

module.exports = {
  getInvoices,
  getInvoice,
  createInvoice,
  postInvoice,
  getInvoicePDF,
  getInvoiceStatus,
  getInvoiceGST,
  getCustomerLedger,
  getTaxSummary,
};
