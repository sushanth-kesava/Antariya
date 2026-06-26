const express = require("express");
const router = express.Router();
const {
  getAllInventory,
  getInventoryBySku,
  getInventoryByProductId,
  getWarehouseSummary,
} = require("../controllers/odoo-inventory.controller");

/**
 * Odoo Inventory Routes
 * Fetches inventory directly from Odoo without caching locally
 * When mounted at /api/inventory:
 *   GET /api/inventory - list all inventory
 *   GET /api/inventory/sku/:sku - inventory by SKU
 *   GET /api/inventory/product/:id - inventory by product ID
 *   GET /api/inventory/warehouse-summary/:productId - warehouse summary
 */

// List all inventory
router.get("/", getAllInventory);

// Warehouse summary (must be before :id routes to avoid conflict)
router.get("/warehouse-summary/:productId", getWarehouseSummary);

// Inventory by SKU (must be before :id routes to avoid conflict)
router.get("/sku/:sku", getInventoryBySku);

// Inventory by product ID (must be last)
router.get("/product/:id", getInventoryByProductId);

module.exports = router;
