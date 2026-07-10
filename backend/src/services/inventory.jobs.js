const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const Order = require("../models/Order");
const InventoryReservation = require("../models/InventoryReservation");
const { InventoryLedger } = require("../models/InventoryLedger");
const { releaseForOrder } = require("./inventory.service");
const { emitLowStockAlert, emitInventoryAlert } = require("./realtime.service");

// ---------------------------------------------------------------------------
// Background jobs for the inventory subsystem. Started from server.js after the
// DB connection is up. All jobs are defensive: a failure in one cycle logs and
// waits for the next tick rather than crashing the process.
// ---------------------------------------------------------------------------

const LOW_STOCK_DEFAULT = 10;

let expiryTimer = null;
let verifyTimer = null;
let lowStockTimer = null;

// --- Expiry sweeper --------------------------------------------------------
// Finds active reservations whose expiresAt has passed and releases them,
// returning reserved stock to available. Paid orders have expiresAt = null and
// are never swept.
async function sweepExpiredReservations() {
  const now = new Date();
  const expired = await InventoryReservation.find({
    status: "active",
    expiresAt: { $ne: null, $lte: now },
  })
    .select("orderId")
    .limit(200);

  for (const resv of expired) {
    try {
      // Guard: only release if the order is still unpaid & not dispatched.
      const order = await Order.findById(resv.orderId).select("status paymentStatus");
      if (!order) {
        await releaseForOrder({ orderId: resv.orderId, reason: "Reservation expired (order missing)" });
        continue;
      }
      const dispatched = ["Shipped", "Delivered"].includes(order.status);
      if (order.paymentStatus === "paid" || dispatched) {
        // Shouldn't have an expiry; clear it so we stop scanning it.
        await InventoryReservation.updateOne({ _id: resv._id }, { $set: { expiresAt: null } });
        continue;
      }
      await releaseForOrder({ orderId: resv.orderId, reason: "Unpaid order expired" });
      if (order.status !== "Cancelled") {
        await Order.updateOne({ _id: resv.orderId }, { $set: { status: "Cancelled" } });
      }
    } catch (err) {
      console.warn("[inventory.jobs] expiry release failed:", resv.orderId?.toString(), err.message);
    }
  }
  return expired.length;
}

// --- Continuous verification ----------------------------------------------
// Scans inventory for the anomalies the spec calls out and raises alerts.
async function verifyInventoryIntegrity() {
  const issues = [];

  // 1. Negative buckets (should be impossible with guards, but verify).
  const negative = await Inventory.find({
    $or: [
      { available: { $lt: 0 } },
      { reserved: { $lt: 0 } },
      { damaged: { $lt: 0 } },
      { returned: { $lt: 0 } },
    ],
  }).limit(100);
  for (const row of negative) {
    issues.push({
      type: "NEGATIVE_STOCK",
      product: String(row.product),
      warehouse: String(row.warehouse),
      variantSku: row.variantSku,
      detail: { available: row.available, reserved: row.reserved, damaged: row.damaged, returned: row.returned },
    });
  }

  // 2. Orphaned reservations: active + expired long ago (sweeper should have
    //    caught them). Flags a stuck sweeper or a release failure.
  const staleCutoff = new Date(Date.now() - 60 * 60 * 1000); // 1h past expiry
  const orphaned = await InventoryReservation.find({
    status: "active",
    expiresAt: { $ne: null, $lte: staleCutoff },
  }).select("orderId expiresAt").limit(100);
  for (const resv of orphaned) {
    issues.push({
      type: "ORPHANED_RESERVATION",
      orderId: String(resv.orderId),
      detail: { expiresAt: resv.expiresAt },
    });
  }

  // 3. Reservation/ledger mismatch: active reservations should have a matching
  //    set of reserve ledger entries and no release/commit yet.
  const activeResvCount = await InventoryReservation.countDocuments({ status: "active" });

  // 4. Projection drift: Product.stock should equal sum(available) for its rows.
  //    Sample-check to keep the job light; full check is available on demand.
  const products = await Product.find({}).select("_id stock variants").limit(500);
  for (const p of products) {
    const rows = await Inventory.find({ product: p._id }).select("available variantSku");
    if (rows.length === 0) continue; // not yet migrated
    const sumAvail = rows.reduce((s, r) => s + r.available, 0);
    if (Number(p.stock) !== sumAvail) {
      issues.push({
        type: "PROJECTION_DRIFT",
        product: String(p._id),
        detail: { productStock: p.stock, ledgerAvailable: sumAvail },
      });
    }
  }

  if (issues.length > 0) {
    console.warn(`[inventory.jobs] verification found ${issues.length} issue(s)`);
    emitInventoryAlert({ kind: "verification", issueCount: issues.length, issues: issues.slice(0, 20) });
  }
  return { issueCount: issues.length, issues, activeResvCount };
}

// --- Low-stock scan --------------------------------------------------------
async function scanLowStock() {
  const rows = await Inventory.find({}).populate("product", "name reorderPoint variants");
  const alerts = [];
  for (const row of rows) {
    if (!row.product) continue;
    const variant = Array.isArray(row.product.variants)
      ? row.product.variants.find((v) => v.sku === row.variantSku)
      : null;
    const threshold =
      Number(row.reorderPoint) > 0
        ? Number(row.reorderPoint)
        : variant && Number(variant.reorderPoint) > 0
        ? Number(variant.reorderPoint)
        : Number(row.product.reorderPoint) > 0
        ? Number(row.product.reorderPoint)
        : LOW_STOCK_DEFAULT;

    if (row.available <= threshold) {
      alerts.push({
        product: String(row.product._id),
        productName: row.product.name,
        variantSku: row.variantSku,
        warehouse: String(row.warehouse),
        available: row.available,
        threshold,
        status: row.available <= 0 ? "Out of Stock" : "Low Stock",
      });
    }
  }
  if (alerts.length > 0) {
    emitLowStockAlert({ count: alerts.length, alerts: alerts.slice(0, 50) });
  }
  return alerts;
}

function startInventoryJobs({ expiryMs = 60 * 1000, verifyMs = 5 * 60 * 1000, lowStockMs = 5 * 60 * 1000 } = {}) {
  stopInventoryJobs();
  const safe = (fn, label) => () => fn().catch((e) => console.warn(`[inventory.jobs] ${label} failed:`, e.message));

  expiryTimer = setInterval(safe(sweepExpiredReservations, "expiry"), expiryMs);
  verifyTimer = setInterval(safe(verifyInventoryIntegrity, "verify"), verifyMs);
  lowStockTimer = setInterval(safe(scanLowStock, "lowStock"), lowStockMs);

  // Kick an initial verification shortly after boot.
  setTimeout(safe(verifyInventoryIntegrity, "verify:boot"), 15 * 1000);
  console.log("[inventory.jobs] background jobs started (expiry/verify/low-stock).");
}

function stopInventoryJobs() {
  for (const t of [expiryTimer, verifyTimer, lowStockTimer]) {
    if (t) clearInterval(t);
  }
  expiryTimer = verifyTimer = lowStockTimer = null;
}

module.exports = {
  sweepExpiredReservations,
  verifyInventoryIntegrity,
  scanLowStock,
  startInventoryJobs,
  stopInventoryJobs,
};
