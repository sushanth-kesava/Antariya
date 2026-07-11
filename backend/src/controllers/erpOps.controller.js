/* eslint-disable no-unused-vars */
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const { recordAudit } = require("../services/rbac.service");
const { refundRazorpayPayment, isRazorpayConfigured } = require("./payment.controller");
const inventoryService = require("../services/inventory.service");

function auditContext(req) {
  return {
    actorId: req.actor?.id || req.auth?.sub || null,
    actorEmail: req.actor?.email || req.auth?.email || null,
    actorRole: req.actor?.role || req.auth?.role || null,
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

/* ────────────────────────── Refunds ────────────────────────── */

/**
 * POST /erp/orders/:orderId/refund
 * Body: { amount?: number (rupees, partial), reason?: string }
 * Refunds via Razorpay when the order was paid online, releases/settles
 * inventory, marks the order Refunded, and audits the action.
 */
async function refundOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.status === "Refunded") {
      return res.status(409).json({ success: false, message: "Order is already refunded." });
    }

    const reason = String(req.body.reason || "").trim();
    const partialRupees = Number(req.body.amount);
    const isPartial = Number.isFinite(partialRupees) && partialRupees > 0 && partialRupees < order.total;

    let refund = null;

    // Online-paid orders go through Razorpay. COD / unpaid orders are simply
    // marked refunded (no gateway movement) with an audit note.
    if (order.paymentMethod === "upi" && order.paymentStatus === "paid" && order.razorpayPaymentId) {
      if (!isRazorpayConfigured()) {
        return res.status(500).json({
          success: false,
          message: "Razorpay is not configured — cannot process an online refund.",
        });
      }
      refund = await refundRazorpayPayment({
        paymentId: order.razorpayPaymentId,
        amountPaise: isPartial ? Math.round(partialRupees * 100) : undefined,
        notes: { orderId: order._id.toString(), reason: reason || "ERP refund" },
      });
    }

    // Release any still-held reservation back to available (safe/idempotent).
    try {
      await inventoryService.releaseForOrder({
        orderId: order._id,
        reason: "Order refunded via ERP",
        actor: { userId: req.auth?.sub, email: req.auth?.email, role: req.auth?.role },
      });
    } catch (releaseError) {
      // Non-fatal: stock may already be committed/released.
      // eslint-disable-next-line no-console
      console.error("Refund stock release note:", releaseError.message);
    }

    const before = { status: order.status, paymentStatus: order.paymentStatus };
    order.status = "Refunded";
    await order.save();

    await recordAudit({
      ...auditContext(req),
      action: "order.refund",
      module: "finance",
      permissionUsed: "orders.refund",
      targetType: "order",
      targetId: order._id.toString(),
      targetLabel: `#${order._id.toString().slice(-6).toUpperCase()}`,
      summary: `Refunded ${isPartial ? `₹${partialRupees}` : "full amount"} for order (${
        order.paymentMethod === "upi" ? "Razorpay" : "manual/COD"
      }).${reason ? ` Reason: ${reason}` : ""}`,
      before,
      after: { status: "Refunded" },
      metadata: refund ? { refundId: refund.id, refundStatus: refund.status } : null,
    });

    return res.status(200).json({
      success: true,
      message: "Refund processed.",
      refund: refund ? { id: refund.id, status: refund.status, amount: refund.amount } : null,
    });
  } catch (error) {
    return next(error);
  }
}

/* ────────────────────────── Product edit / publish ────────────────────────── */

const EDITABLE_FIELDS = [
  "name", "description", "price", "category", "subCategory",
  "size", "color", "gender", "neckType", "pattern",
  "sizes", "colors", "genders", "neckTypes", "patterns",
  "image", "images", "galleryImages", "reorderPoint", "customizable",
];

/** PATCH /erp/products/:productId — edit core product fields. */
async function updateProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const before = {};
    const after = {};

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] === undefined) continue;
      before[field] = product[field];
      product[field] = req.body[field];
      after[field] = product[field];
    }

    // Keep top-level stock scalar if explicitly provided (variants have their
    // own stock managed through the inventory adjust flow).
    if (req.body.stock !== undefined && Number.isFinite(Number(req.body.stock))) {
      before.stock = product.stock;
      product.stock = Number(req.body.stock);
      after.stock = product.stock;
    }

    await product.save();

    await recordAudit({
      ...auditContext(req),
      action: "product.update",
      module: "catalog",
      permissionUsed: "catalog.edit",
      targetType: "product",
      targetId: product._id.toString(),
      targetLabel: product.name,
      summary: `Edited product "${product.name}".`,
      before,
      after,
    });

    return res.status(200).json({
      success: true,
      product: { id: product._id.toString(), name: product.name, price: product.price, published: product.published },
    });
  } catch (error) {
    return next(error);
  }
}

/** PATCH /erp/products/:productId/publish — toggle storefront visibility. */
async function setProductPublished(req, res, next) {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const published = Boolean(req.body.published);
    const before = { published: product.published };
    product.published = published;
    await product.save();

    await recordAudit({
      ...auditContext(req),
      action: published ? "product.publish" : "product.unpublish",
      module: "catalog",
      permissionUsed: "catalog.publish",
      targetType: "product",
      targetId: product._id.toString(),
      targetLabel: product.name,
      summary: `${published ? "Published" : "Unpublished"} product "${product.name}".`,
      before,
      after: { published },
    });

    return res.status(200).json({ success: true, published });
  } catch (error) {
    return next(error);
  }
}

/** GET /erp/products — lightweight product list for the catalog manager. */
async function listProductsForErp(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.search) {
      filter.name = { $regex: String(req.query.search).trim(), $options: "i" };
    }

    const [rows, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      products: rows.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        price: p.price,
        category: p.category || "",
        image: p.image,
        stock: p.stock,
        published: p.published !== false,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

/* ────────────────────────── Warehouses & transfers ────────────────────────── */

/** GET /erp/warehouses — list warehouses. */
async function listWarehouses(req, res, next) {
  try {
    const warehouses = await Warehouse.find({}).sort({ priority: 1, name: 1 }).lean();
    return res.status(200).json({
      success: true,
      warehouses: warehouses.map((w) => ({
        id: w._id.toString(),
        code: w.code,
        name: w.name,
        city: w.city || "",
        state: w.state || "",
        pincode: w.pincode || "",
        priority: w.priority,
        active: w.active !== false,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

/** POST /erp/warehouses — create a warehouse. */
async function createWarehouse(req, res, next) {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const name = String(req.body.name || "").trim();
    if (!code || !name) {
      return res.status(400).json({ success: false, message: "Warehouse code and name are required." });
    }

    const existing = await Warehouse.findOne({ code });
    if (existing) {
      return res.status(409).json({ success: false, message: `A warehouse with code "${code}" already exists.` });
    }

    const warehouse = await Warehouse.create({
      code,
      name,
      address: req.body.address || "",
      city: req.body.city || "",
      state: req.body.state || "",
      pincode: req.body.pincode || "",
      priority: Number.isFinite(Number(req.body.priority)) ? Number(req.body.priority) : 100,
    });

    await recordAudit({
      ...auditContext(req),
      action: "warehouse.create",
      module: "inventory",
      permissionUsed: "inventory.warehouse.manage",
      targetType: "warehouse",
      targetId: warehouse._id.toString(),
      targetLabel: `${warehouse.code} — ${warehouse.name}`,
      summary: `Created warehouse "${warehouse.name}" (${warehouse.code}).`,
      after: { code: warehouse.code, name: warehouse.name },
    });

    return res.status(201).json({
      success: true,
      warehouse: { id: warehouse._id.toString(), code: warehouse.code, name: warehouse.name },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /erp/inventory/transfer
 * Body: { productId, variantSku?, fromWarehouse, toWarehouse, quantity, reason? }
 */
async function transferStock(req, res, next) {
  try {
    const { productId, variantSku, fromWarehouse, toWarehouse, quantity, reason } = req.body;
    if (!productId || !fromWarehouse || !toWarehouse || !Number.isFinite(Number(quantity))) {
      return res.status(400).json({
        success: false,
        message: "productId, fromWarehouse, toWarehouse, and quantity are required.",
      });
    }
    if (String(fromWarehouse) === String(toWarehouse)) {
      return res.status(400).json({ success: false, message: "Source and destination must differ." });
    }

    await inventoryService.transferStock({
      productId,
      variantSku: variantSku || "",
      fromWarehouse,
      toWarehouse,
      quantity: Number(quantity),
      reason: reason || "ERP transfer",
      actor: { userId: req.auth?.sub, email: req.auth?.email, role: req.auth?.role },
    });

    await recordAudit({
      ...auditContext(req),
      action: "inventory.transfer",
      module: "inventory",
      permissionUsed: "inventory.transfer",
      targetType: "product",
      targetId: String(productId),
      summary: `Transferred ${quantity} unit(s) between warehouses.${reason ? ` Reason: ${reason}` : ""}`,
      metadata: { fromWarehouse, toWarehouse, variantSku: variantSku || "", quantity: Number(quantity) },
    });

    return res.status(200).json({ success: true, message: "Stock transferred." });
  } catch (error) {
    if (error.code === "OUT_OF_STOCK") {
      return res.status(409).json({ success: false, message: "Insufficient stock at source warehouse." });
    }
    return next(error);
  }
}

module.exports = {
  refundOrder,
  updateProduct,
  setProductPublished,
  listProductsForErp,
  listWarehouses,
  createWarehouse,
  transferStock,
};
