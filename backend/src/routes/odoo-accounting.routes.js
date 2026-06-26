const express = require("express");
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  createInvoice,
  postInvoice,
  getInvoicePDF,
  getInvoiceStatus,
  getInvoiceGST,
  getCustomerLedger,
  getTaxSummary,
} = require("../controllers/odoo-accounting.controller");

/**
 * Odoo Accounting Routes
 * Manages invoices, GST, and customer ledger
 * When mounted at /api/accounting:
 *   GET /api/accounting/invoices - list invoices
 *   POST /api/accounting/invoices - create invoice from SO
 *   GET /api/accounting/invoices/:id - get invoice details
 *   POST /api/accounting/invoices/:id/post - post invoice
 *   GET /api/accounting/invoices/:id/pdf - download PDF
 *   GET /api/accounting/invoices/:id/status - get payment status
 *   GET /api/accounting/invoices/:id/gst - get GST details
 *   GET /api/accounting/ledger/:customerId - customer ledger
 *   GET /api/accounting/tax-summary/:customerId - tax summary
 */

// List invoices
router.get("/invoices", getInvoices);

// Create invoice from sales order
router.post("/invoices", createInvoice);

// Post invoice (must be before :id to avoid conflict)
router.post("/invoices/:id/post", postInvoice);

// Get invoice PDF (must be before :id to avoid conflict)
router.get("/invoices/:id/pdf", getInvoicePDF);

// Get invoice status (must be before :id to avoid conflict)
router.get("/invoices/:id/status", getInvoiceStatus);

// Get invoice GST details (must be before :id to avoid conflict)
router.get("/invoices/:id/gst", getInvoiceGST);

// Get invoice details (must be last)
router.get("/invoices/:id", getInvoice);

// Customer ledger
router.get("/ledger/:customerId", getCustomerLedger);

// Tax summary
router.get("/tax-summary/:customerId", getTaxSummary);

module.exports = router;
