const inventoryService = require("../services/odoo/inventory.service");

/**
 * GET /api/inventory
 * Fetch all inventory records with pagination.
 * Query params: offset, limit
 */
async function getAllInventory(req, res, next) {
  try {
    const { offset = 0, limit = 50 } = req.query;

    const result = await inventoryService.getAllInventory({
      offset,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch inventory",
    });
  }
}

/**
 * GET /api/inventory/sku/:sku
 * Fetch inventory by product SKU.
 * Returns array of inventory records across all warehouses.
 */
async function getInventoryBySku(req, res, next) {
  try {
    const { sku } = req.params;

    if (!sku || sku.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "SKU is required",
      });
    }

    const inventory = await inventoryService.getInventoryBySku(sku);

    if (inventory === null) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        sku,
        inventory: inventory || [],
      },
    });
  } catch (err) {
    console.error("Error fetching inventory by SKU:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch inventory",
    });
  }
}

/**
 * GET /api/inventory/product/:id
 * Fetch inventory by product ID.
 * Includes warehouse summary with location breakdown.
 */
async function getInventoryByProductId(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Product ID is required",
      });
    }

    const inventory = await inventoryService.getInventoryByProductId(id);

    if (inventory === null) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Also get warehouse summary
    let warehouseSummary = [];
    if (Array.isArray(inventory) && inventory.length > 0) {
      warehouseSummary = await inventoryService.getWarehouseSummary(id);
    }

    res.status(200).json({
      success: true,
      data: {
        productId: id,
        inventory: inventory || [],
        warehouseSummary: warehouseSummary || [],
      },
    });
  } catch (err) {
    console.error("Error fetching inventory by product ID:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch inventory",
    });
  }
}

/**
 * GET /api/inventory/warehouse-summary/:productId
 * Fetch warehouse summary for a product.
 * Returns aggregated quantities by warehouse.
 */
async function getWarehouseSummary(req, res, next) {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: "Product ID is required",
      });
    }

    const summary = await inventoryService.getWarehouseSummary(productId);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        productId,
        warehouses: summary,
      },
    });
  } catch (err) {
    console.error("Error fetching warehouse summary:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch warehouse summary",
    });
  }
}

module.exports = {
  getAllInventory,
  getInventoryBySku,
  getInventoryByProductId,
  getWarehouseSummary,
};
