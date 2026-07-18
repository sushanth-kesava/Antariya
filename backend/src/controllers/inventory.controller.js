const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const Warehouse = require("../models/Warehouse");
const Order = require("../models/Order");
const Product = require("../models/Product");
const InventoryReservation = require("../models/InventoryReservation");
const { InventoryLedger } = require("../models/InventoryLedger");
const inventoryService = require("../services/inventory.service");
const { verifyInventoryIntegrity } = require("../services/inventory.jobs");

function isStaff(req) {
  return req.auth?.role === "admin" || req.auth?.role === "superadmin";
}

// --- Warehouses ------------------------------------------------------------
async function listWarehouses(req, res, next) {
  try {
    if (!isStaff(req)) return res.status(403).json({ success: false, message: "Admin access required" });
    const warehouses = await Warehouse.find({}).sort({ priority: 1, name: 1 });
    return res.status(200).json({ success: true, warehouses });
  } catch (err) {
    return next(err);
  }
}

async function createWarehouse(req, res, next) {
  try {
    if (!isStaff(req)) return res.status(403).json({ success: false, message: "Admin access required" });
    const { code, name, address, city, state, pincode, priority } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: "code and name are required" });
    }
    const warehouse = await Warehouse.create({
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      address: address || "",
      city: city || "",
      state: state || "",
      pincode: pincode || "",
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 100,
    });
    return res.status(201).json({ success: true, warehouse });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A warehouse with that code already exists" });
    }
    return next(err);
  }
}

// --- Inventory view (per warehouse, all buckets) ---------------------------
async function getInventory(req, res, next) {
  try {
    if (!isStaff(req)) return res.status(403).json({ success: false, message: "Admin access required" });
    const filter = {};
    if (req.query.warehouse && mongoose.Types.ObjectId.isValid(req.query.warehouse)) {
      filter.warehouse = req.query.warehouse;
    }
    if (req.query.productId && mongoose.Types.ObjectId.isValid(req.query.productId)) {
      filter.product = req.query.productId;
    }
    const rows = await Inventory.find(filter)
      .populate("product", "name image reorderPoint")
      .populate("warehouse", "code name")
      .sort({ updatedAt: -1 })
      .limit(1000);

    const inventory = rows.map((r) => ({
      id: r._id.toString(),
      product: r.product ? { id: r.product._id.toString(), name: r.product.name, image: r.product.image } : null,
      warehouse: r.warehouse ? { id: r.warehouse._id.toString(), code: r.warehouse.code, name: r.warehouse.name } : null,
      variantSku: r.variantSku,
      available: r.available,
      reserved: r.reserved,
      damaged: r.damaged,
      returned: r.returned,
      incoming: r.incoming,
      inTransit: r.inTransit,
      reorderPoint: r.reorderPoint,
      status: inventoryService.deriveStatus(r.available, r.reorderPoint || 10),
    }));
    return res.status(200).json({ success: true, inventory });
  } catch (err) {
    return next(err);
  }
}

// --- Ledger (audit trail) --------------------------------------------------
async function getLedger(req, res, next) {
  try {
    if (!isStaff(req)) return res.status(403).json({ success: false, message: "Admin access required" });
    const filter = {};
    if (req.query.productId && mongoose.Types.ObjectId.isValid(req.query.productId)) {
      filter.product = req.query.productId;
    }
    if (req.query.orderId && mongoose.Types.ObjectId.isValid(req.query.orderId)) {
      filter.orderId = req.query.orderId;
    }
    if (req.query.changeType) {
      filter.changeType = req.query.changeType;
    }
    const entries = await InventoryLedger.find(filter).sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ success: true, ledger: entries });
  } catch (err) {
    return next(err);
  }
}

// --- Returns / Exchange ----------------------------------------------------
// body: { orderId, lines:[{productId, variantSku, quantity, warehouse?}],
//         resellable:boolean, reason?, exchange?:{lines:[...]} }
async function processReturn(req, res, next) {
  try {
    if (!isStaff(req)) return res.status(403).json({ success: false, message: "Admin access required" });
    const { orderId, lines, resellable, reason, exchange } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: "lines are required" });
    }

    const actor = { userId: req.auth?.sub, email: req.auth?.email, role: req.auth?.role };

    // 1. Returned item follows the return workflow (restock or damage).
    await inventoryService.processReturn({
      orderId: orderId || null,
      lines: lines.map((l) => ({
        productId: l.productId,
        variantSku: l.variantSku || "",
        quantity: Number(l.quantity),
        warehouse: l.warehouse || null,
        productName: l.productName || "",
      })),
      resellable: Boolean(resellable),
      actor,
      reason: reason || "",
    });

    // 2. Exchange: the replacement item deducts from its own SKU via a fresh
    //    reservation + immediate commit (it ships out right away).
    let exchangeResult = null;
    if (exchange && Array.isArray(exchange.lines) && exchange.lines.length > 0) {
      // Use a synthetic reservation keyed to a new ObjectId so commit/release
      // idempotency still holds for the exchange shipment.
      const exchangeOrderId = new mongoose.Types.ObjectId();
      await inventoryService.reserveForOrder({
        orderId: exchangeOrderId,
        lines: exchange.lines.map((l) => ({
          productId: l.productId,
          variantSku: l.variantSku || "",
          quantity: Number(l.quantity),
          productName: l.productName || "",
        })),
        actor,
        expiresAt: null,
      });
      await inventoryService.commitForOrder({
        orderId: exchangeOrderId,
        reason: "Exchange replacement dispatched",
        actor,
      });
      exchangeResult = { exchangeOrderId: exchangeOrderId.toString() };
    }

    return res.status(200).json({ success: true, message: "Return processed", exchange: exchangeResult });
  } catch (err) {
    if (err.code === "OUT_OF_STOCK") {
      return res.status(409).json({ success: false, message: "Replacement item is out of stock", code: "OUT_OF_STOCK" });
    }
    return next(err);
  }
}

// --- Transfer between warehouses -------------------------------------------
async function transferStock(req, res, next) {
  try {
    if (!isStaff(req)) return res.status(403).json({ success: false, message: "Admin access required" });
    const { productId, variantSku, fromWarehouse, toWarehouse, quantity, reason } = req.body;
    if (!productId || !fromWarehouse || !toWarehouse || !Number.isFinite(Number(quantity))) {
      return res.status(400).json({ success: false, message: "productId, fromWarehouse, toWarehouse, quantity are required" });
    }
    if (String(fromWarehouse) === String(toWarehouse)) {
      return res.status(400).json({ success: false, message: "Source and destination warehouses must differ" });
    }
    await inventoryService.transferStock({
      productId,
      variantSku: variantSku || "",
      fromWarehouse,
      toWarehouse,
      quantity: Number(quantity),
      reason: reason || "",
      actor: { userId: req.auth?.sub, email: req.auth?.email, role: req.auth?.role },
    });
    return res.status(200).json({ success: true, message: "Stock transferred" });
  } catch (err) {
    if (err.code === "OUT_OF_STOCK") {
      return res.status(409).json({ success: false, message: "Insufficient stock at source warehouse", code: "OUT_OF_STOCK" });
    }
    return next(err);
  }
}

// --- Stock availability check for cart items (customer-facing) ----
// POST /inventory/check-stock
// body: { items: [{ productId, variantSku?, quantity }, ...] }
// Returns item-level stock availability (for cart validation before checkout)
async function checkStockAvailability(req, res, next) {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "items array is required",
      });
    }

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const results = [];
    let allAvailable = true;

    for (const item of items) {
      const productId = String(item.productId);
      const product = productMap.get(productId);
      const variantSku = item.variantSku ? String(item.variantSku).trim() : "";
      const quantity = Number(item.quantity) || 0;

      if (!product) {
        allAvailable = false;
        results.push({
          productId,
          variantSku,
          quantity,
          available: 0,
          isAvailable: false,
          productName: "Unknown product",
        });
        continue;
      }

      // Check variant-level stock if variant SKU is specified
      let available = 0;
      if (variantSku && product.variants && product.variants.length > 0) {
        const matchedVariant = product.variants.find((v) => v.sku === variantSku);
        available = matchedVariant ? Number(matchedVariant.stock || 0) : 0;
      } else {
        // Fall back to product-level stock
        available = Number(product.stock || 0);
      }

      const isAvailable = available >= quantity;
      if (!isAvailable) {
        allAvailable = false;
      }

      results.push({
        productId,
        variantSku,
        quantity,
        available,
        isAvailable,
        productName: product.name,
      });
    }

    return res.status(200).json({
      success: true,
      items: results,
      allAvailable,
    });
  } catch (err) {
    return next(err);
  }
}

// --- Verification on demand ------------------------------------------------
async function runVerification(req, res, next) {
  try {
    if (!isStaff(req)) return res.status(403).json({ success: false, message: "Admin access required" });
    const report = await verifyInventoryIntegrity();
    return res.status(200).json({ success: true, ...report });
  } catch (err) {
    return next(err);
  }
}

// --- Single product stock details (customer/storefront-facing) -------------
// GET /inventory/product/:productId/stock
// Returns aggregated stock info for a product across all warehouses,
// including per-variant breakdown.
async function getProductStock(req, res, next) {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid productId" });
    }

    const product = await Product.findById(productId).select("name sku stock variants");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Aggregate inventory rows across all warehouses
    const invRows = await Inventory.find({ product: productId }).populate("warehouse", "code name");

    const warehouses = invRows.map((r) => ({
      warehouseId: r.warehouse?._id?.toString() || "",
      warehouseCode: r.warehouse?.code || "",
      warehouseName: r.warehouse?.name || "",
      variantSku: r.variantSku,
      available: r.available,
      reserved: r.reserved,
      damaged: r.damaged,
      returned: r.returned,
    }));

    const totalAvailable = invRows.reduce((sum, r) => sum + r.available, 0);

    return res.status(200).json({
      success: true,
      productId,
      productName: product.name,
      sku: product.sku || "",
      totalStock: product.stock || 0,
      totalAvailable,
      variants: (product.variants || []).map((v) => ({
        sku: v.sku,
        size: v.size || "",
        color: v.color || "",
        stock: v.stock || 0,
      })),
      warehouses,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listWarehouses,
  createWarehouse,
  getInventory,
  getLedger,
  processReturn,
  transferStock,
  runVerification,
  checkStockAvailability,
  getProductStock,
};
