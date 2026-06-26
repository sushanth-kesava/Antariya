const express = require("express");
const router = express.Router();
const {
  createSalesOrder,
  getSalesOrder,
  confirmSalesOrder,
  cancelSalesOrder,
  getSalesOrderInvoice,
} = require("../controllers/odoo-sales.controller");

/**
 * Odoo Sales Order Routes
 * Manages sales orders in Odoo
 * When mounted at /api/odoo/sales:
 *   POST /api/odoo/sales - create sales order
 *   GET /api/odoo/sales/:id - get sales order
 *   POST /api/odoo/sales/:id/confirm - confirm order
 *   POST /api/odoo/sales/:id/cancel - cancel order
 *   GET /api/odoo/sales/:id/invoice - get associated invoice
 */

// Create sales order
router.post("/", createSalesOrder);

// Confirm order (must be before :id routes to avoid conflict)
router.post("/:id/confirm", confirmSalesOrder);

// Cancel order (must be before :id routes to avoid conflict)
router.post("/:id/cancel", cancelSalesOrder);

// Get invoice (must be before :id routes to avoid conflict)
router.get("/:id/invoice", getSalesOrderInvoice);

// Get sales order (must be last)
router.get("/:id", getSalesOrder);

module.exports = router;
