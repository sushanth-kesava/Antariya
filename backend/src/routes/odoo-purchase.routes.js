const express = require("express");
const router = express.Router();
const {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
} = require("../controllers/odoo-purchase.controller");

/**
 * Odoo Purchase Order Routes
 * Manages purchase orders in Odoo
 * When mounted at /api/purchase:
 *   POST /api/purchase - create purchase order
 *   GET /api/purchase - list purchase orders
 *   POST /api/purchase/:id/confirm - confirm PO
 *   POST /api/purchase/:id/cancel - cancel PO
 *   POST /api/purchase/:id/receive - receive goods
 *   GET /api/purchase/:id - get purchase order
 */

// Create purchase order
router.post("/", createPurchaseOrder);

// List purchase orders
router.get("/", listPurchaseOrders);

// Confirm PO (must be before :id routes to avoid conflict)
router.post("/:id/confirm", confirmPurchaseOrder);

// Cancel PO (must be before :id routes to avoid conflict)
router.post("/:id/cancel", cancelPurchaseOrder);

// Receive goods (must be before :id routes to avoid conflict)
router.post("/:id/receive", receivePurchaseOrder);

// Get purchase order by ID (must be last)
router.get("/:id", getPurchaseOrder);

module.exports = router;
