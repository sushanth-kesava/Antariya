const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");
const InventoryReservation = require("../models/InventoryReservation");
const { InventoryLedger } = require("../models/InventoryLedger");
const { emitInventoryChange } = require("./realtime.service");

// ---------------------------------------------------------------------------
// Antariya Inventory Service
// ---------------------------------------------------------------------------
// The ONLY module allowed to mutate stock. Every public method runs inside a
// MongoDB multi-document transaction (requires a replica set / Atlas) and:
//   1. mutates Inventory bucket(s) with guarded conditional updates,
//   2. writes an append-only InventoryLedger row,
//   3. refreshes the derived Product.stock / variant.stock projections,
//   4. emits a real-time event after commit.
//
// Idempotency: state-changing order operations key off the InventoryReservation
// document + ledger existence, so a ret/replay can never double-apply.
// ---------------------------------------------------------------------------

const TXN_OPTS = {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
  readPreference: "primary",
};

const ON_HAND_BUCKETS = ["available", "reserved", "damaged", "returned"];

function genTxnId(prefix = "txn") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function withTxn(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    }, TXN_OPTS);
    return result;
  } finally {
    await session.endSession();
  }
}

// Resolve the default warehouse (single-location deployments). Cached.
// Self-healing: if the DEFAULT warehouse does not exist yet, it is created
// atomically (idempotent upsert). This means the system NEVER requires a
// manual migration to function — the first inventory operation bootstraps it.
let _defaultWarehouseId = null;
async function getDefaultWarehouseId(session) {
  if (_defaultWarehouseId) return _defaultWarehouseId;
  const wh = await Warehouse.findOneAndUpdate(
    { code: "DEFAULT" },
    {
      $setOnInsert: {
        code: "DEFAULT",
        name: "Primary Warehouse",
        isActive: true,
        priority: 0,
      },
    },
    { upsert: true, new: true, session: session || null }
  );
  _defaultWarehouseId = wh._id;
  return wh._id;
}

// Public bootstrap helper — called once at server startup so the DEFAULT
// warehouse always exists before any request arrives. Safe to call repeatedly.
async function ensureDefaultWarehouse() {
  return getDefaultWarehouseId(null);
}

// Lazily ensure a product has Inventory rows in the DEFAULT warehouse, seeded
// from its CURRENT stock (product.stock for simple products; variant.stock for
// each variant). This is the "migration on demand": the first time any product
// is touched by the inventory service, its authoritative rows are created from
// the legacy flat stock WITHOUT losing or double-counting anything.
//
// - Idempotent: uses $setOnInsert, so existing rows are never modified.
// - Complete: seeds ALL variant rows for a variant product, which is what makes
//   refreshProductProjection safe (it will never zero a sibling variant that
//   simply hadn't been given a row yet).
async function ensureProductInventory(session, productId, warehouseId) {
  const wh = warehouseId || (await getDefaultWarehouseId(session));
  const product = await Product.findById(productId).session(session);
  if (!product) return wh;

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const targets = hasVariants
    ? product.variants.map((v) => ({
        sku: v.sku || "",
        seed: Number(v.stock) || 0,
        reorderPoint: Number(v.reorderPoint) || 0,
      }))
    : [{ sku: "", seed: Number(product.stock) || 0, reorderPoint: Number(product.reorderPoint) || 0 }];

  for (const t of targets) {
    await Inventory.updateOne(
      { product: productId, warehouse: wh, variantSku: t.sku },
      {
        $setOnInsert: {
          product: productId,
          warehouse: wh,
          variantSku: t.sku,
          available: t.seed,
          reserved: 0,
          damaged: 0,
          returned: 0,
          incoming: 0,
          inTransit: 0,
          reorderPoint: t.reorderPoint,
          version: 0,
        },
      },
      { upsert: true, session }
    );
  }
  return wh;
}

// Apply signed deltas to a single Inventory row with guards that prevent any
// bucket from going negative. Returns the updated doc, or null if the guard
// failed (insufficient stock / concurrent change).
async function applyBucketDeltas(session, { product, warehouse, variantSku }, moves) {
  const filter = { product, warehouse, variantSku: variantSku || "" };
  // Build guards: for every bucket we DECREMENT, require enough on hand.
  const guard = {};
  for (const [bucket, delta] of Object.entries(moves)) {
    if (delta < 0) {
      guard[bucket] = { $gte: Math.abs(delta) };
    }
  }
  const inc = {};
  for (const [bucket, delta] of Object.entries(moves)) {
    if (delta !== 0) inc[bucket] = delta;
  }

  const updated = await Inventory.findOneAndUpdate(
    { ...filter, ...guard },
    { $inc: { ...inc, version: 1 } },
    { new: true, session }
  );
  return updated;
}

// Recompute the derived Product.stock and embedded variant.stock from the
// authoritative Inventory rows (sum of `available` across all warehouses).
// Runs inside the same transaction so the projection never lags the source.
async function refreshProductProjection(session, productId) {
  const rows = await Inventory.find({ product: productId }).session(session);

  const totalByVariant = new Map();
  let grandTotal = 0;
  for (const row of rows) {
    const key = row.variantSku || "";
    totalByVariant.set(key, (totalByVariant.get(key) || 0) + row.available);
    grandTotal += row.available;
  }

  const product = await Product.findById(productId).session(session);
  if (!product) return;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    for (const variant of product.variants) {
      variant.stock = totalByVariant.get(variant.sku) || 0;
    }
    product.stock = product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  } else {
    product.stock = totalByVariant.get("") || grandTotal;
  }
  await product.save({ session });
}

async function writeLedger(session, entry) {
  const doc = {
    txnId: entry.txnId || genTxnId(),
    changeType: entry.changeType,
    product: entry.product,
    productName: entry.productName || "",
    warehouse: entry.warehouse,
    variantSku: entry.variantSku || "",
    quantity: entry.quantity,
    moves: entry.moves || {},
    quantityBefore: entry.quantityBefore || 0,
    quantityAfter: entry.quantityAfter || 0,
    reason: entry.reason || "",
    orderId: entry.orderId || null,
    performedByUserId: entry.performedByUserId || "",
    performedByEmail: entry.performedByEmail || "",
    performedByRole: entry.performedByRole || "system",
  };
  await InventoryLedger.create([doc], { session });
  return doc;
}

// ---------------------------------------------------------------------------
// RESERVE — order placed (or payment confirmed). available -> reserved.
// Idempotent per orderId: if a reservation already exists, it's a no-op.
// Throws { code: "OUT_OF_STOCK", sku } if any line cannot be satisfied.
// ---------------------------------------------------------------------------
async function reserveForOrder({ orderId, lines, actor = {}, expiresAt = null }) {
  return withTxn(async (session) => {
    const existing = await InventoryReservation.findOne({ orderId }).session(session);
    if (existing) {
      // Idempotent replay — do not deduct twice.
      return { reservationId: existing._id, idempotent: true, status: existing.status };
    }

    const defaultWh = await getDefaultWarehouseId(session);
    const allocations = [];
    const txnId = genTxnId("resv");

    // Seed inventory rows (from current stock) for every product in the order
    // before deducting, so legacy products that never had rows reserve correctly
    // instead of falsely reporting OUT_OF_STOCK.
    const seededProducts = new Set();
    for (const line of lines) {
      const key = String(line.productId);
      if (!seededProducts.has(key)) {
        await ensureProductInventory(session, line.productId, line.warehouse || defaultWh);
        seededProducts.add(key);
      }
    }

    for (const line of lines) {
      const warehouse = line.warehouse || defaultWh;
      const variantSku = line.variantSku || "";
      const qty = Number(line.quantity);

      const row = await Inventory.findOne({ product: line.productId, warehouse, variantSku }).session(session);
      const beforeAvail = row ? row.available : 0;

      const updated = await applyBucketDeltas(
        session,
        { product: line.productId, warehouse, variantSku },
        { available: -qty, reserved: qty }
      );

      if (!updated) {
        const err = new Error(`Out of stock for product ${line.productId}${variantSku ? ` (${variantSku})` : ""}`);
        err.code = "OUT_OF_STOCK";
        err.sku = variantSku;
        err.productId = String(line.productId);
        throw err; // aborts the whole transaction — all-or-nothing
      }

      await writeLedger(session, {
        txnId,
        changeType: "reserve",
        product: line.productId,
        productName: line.productName || "",
        warehouse,
        variantSku,
        quantity: qty,
        moves: { available: -qty, reserved: qty },
        quantityBefore: beforeAvail,
        quantityAfter: updated.available,
        reason: "Order placed",
        orderId,
        performedByUserId: actor.userId || "",
        performedByEmail: actor.email || "",
        performedByRole: actor.role || "customer",
      });

      allocations.push({ product: line.productId, warehouse, variantSku, quantity: qty });
    }

    const [reservation] = await InventoryReservation.create(
      [{ orderId, status: "active", allocations, expiresAt }],
      { session }
    );

    const touched = allocations.map((a) => ({ productId: String(a.product), variantSku: a.variantSku }));
    session.__touched = touched; // surfaced to post-commit emitter
    for (const a of allocations) {
      await refreshProductProjection(session, a.product);
    }

    return { reservationId: reservation._id, idempotent: false, touched };
  }).then((res) => {
    emitTouched(res.touched);
    return res;
  });
}

// ---------------------------------------------------------------------------
// RELEASE — cancel-before-dispatch / payment failure / expiry.
// reserved -> available. Idempotent: only acts on an "active" reservation.
// ---------------------------------------------------------------------------
async function releaseForOrder({ orderId, reason = "Reservation released", actor = {} }) {
  return withTxn(async (session) => {
    const reservation = await InventoryReservation.findOne({ orderId }).session(session);
    if (!reservation || reservation.status !== "active") {
      return { idempotent: true, status: reservation ? reservation.status : "none" };
    }

    const txnId = genTxnId("rels");
    for (const alloc of reservation.allocations) {
      const row = await Inventory.findOne({
        product: alloc.product,
        warehouse: alloc.warehouse,
        variantSku: alloc.variantSku || "",
      }).session(session);
      const beforeAvail = row ? row.available : 0;

      const updated = await applyBucketDeltas(
        session,
        { product: alloc.product, warehouse: alloc.warehouse, variantSku: alloc.variantSku },
        { reserved: -alloc.quantity, available: alloc.quantity }
      );
      if (!updated) {
        // reserved somehow lower than expected — clamp defensively by releasing
        // whatever remains, and record a reconcile note.
        const clampRow = await Inventory.findOne({
          product: alloc.product,
          warehouse: alloc.warehouse,
          variantSku: alloc.variantSku || "",
        }).session(session);
        const canRelease = clampRow ? Math.min(alloc.quantity, clampRow.reserved) : 0;
        if (canRelease > 0) {
          await applyBucketDeltas(
            session,
            { product: alloc.product, warehouse: alloc.warehouse, variantSku: alloc.variantSku },
            { reserved: -canRelease, available: canRelease }
          );
        }
        await writeLedger(session, {
          txnId,
          changeType: "reconcile",
          product: alloc.product,
          warehouse: alloc.warehouse,
          variantSku: alloc.variantSku,
          quantity: canRelease,
          moves: { reserved: -canRelease, available: canRelease },
          quantityBefore: beforeAvail,
          quantityAfter: beforeAvail + canRelease,
          reason: `Release clamp: reserved underflow on ${reason}`,
          orderId,
          performedByRole: "system",
        });
      } else {
        await writeLedger(session, {
          txnId,
          changeType: "release",
          product: alloc.product,
          warehouse: alloc.warehouse,
          variantSku: alloc.variantSku,
          quantity: alloc.quantity,
          moves: { reserved: -alloc.quantity, available: alloc.quantity },
          quantityBefore: beforeAvail,
          quantityAfter: updated.available,
          reason,
          orderId,
          performedByUserId: actor.userId || "",
          performedByEmail: actor.email || "",
          performedByRole: actor.role || "system",
        });
      }
      await refreshProductProjection(session, alloc.product);
    }

    reservation.status = "released";
    reservation.releasedReason = reason;
    reservation.releasedAt = new Date();
    reservation.expiresAt = null;
    await reservation.save({ session });

    return {
      idempotent: false,
      touched: reservation.allocations.map((a) => ({ productId: String(a.product), variantSku: a.variantSku || "" })),
    };
  }).then((res) => {
    emitTouched(res.touched);
    return res;
  });
}

// ---------------------------------------------------------------------------
// COMMIT — order dispatched. reserved leaves the building for good.
// reserved -> (gone). Idempotent: only acts on an "active" reservation.
// ---------------------------------------------------------------------------
async function commitForOrder({ orderId, reason = "Order dispatched", actor = {} }) {
  return withTxn(async (session) => {
    const reservation = await InventoryReservation.findOne({ orderId }).session(session);
    if (!reservation || reservation.status !== "active") {
      return { idempotent: true, status: reservation ? reservation.status : "none" };
    }

    const txnId = genTxnId("cmit");
    for (const alloc of reservation.allocations) {
      const row = await Inventory.findOne({
        product: alloc.product,
        warehouse: alloc.warehouse,
        variantSku: alloc.variantSku || "",
      }).session(session);
      const beforeReserved = row ? row.reserved : 0;

      const updated = await applyBucketDeltas(
        session,
        { product: alloc.product, warehouse: alloc.warehouse, variantSku: alloc.variantSku },
        { reserved: -alloc.quantity }
      );
      if (!updated) {
        const err = new Error("Commit failed: reserved underflow");
        err.code = "COMMIT_UNDERFLOW";
        throw err;
      }

      await writeLedger(session, {
        txnId,
        changeType: "commit",
        product: alloc.product,
        warehouse: alloc.warehouse,
        variantSku: alloc.variantSku,
        quantity: alloc.quantity,
        moves: { reserved: -alloc.quantity },
        quantityBefore: beforeReserved,
        quantityAfter: updated.reserved,
        reason,
        orderId,
        performedByUserId: actor.userId || "",
        performedByEmail: actor.email || "",
        performedByRole: actor.role || "system",
      });
      // committing does not change `available`, but the projection already
      // reflects available; no refresh needed for available totals.
    }

    reservation.status = "committed";
    reservation.committedAt = new Date();
    reservation.expiresAt = null;
    await reservation.save({ session });

    return { idempotent: false };
  });
}

// ---------------------------------------------------------------------------
// RETURN — resellable (restock) or damaged. Post-dispatch, so there is no
// reservation to touch; we add directly to available or damaged.
// ---------------------------------------------------------------------------
async function processReturn({ orderId, lines, resellable, actor = {}, reason = "" }) {
  return withTxn(async (session) => {
    const defaultWh = await getDefaultWarehouseId(session);
    const txnId = genTxnId("retn");
    const touched = [];

    for (const line of lines) {
      const warehouse = line.warehouse || defaultWh;
      const variantSku = line.variantSku || "";
      const qty = Number(line.quantity);

      // Seed ALL of this product's rows from current stock (idempotent), so the
      // later projection refresh never zeroes a sibling variant.
      await ensureProductInventory(session, line.productId, warehouse);

      const moves = resellable ? { available: qty } : { damaged: qty };
      const row = await Inventory.findOne({ product: line.productId, warehouse, variantSku }).session(session);
      const beforeAvail = row ? row.available : 0;

      await applyBucketDeltas(session, { product: line.productId, warehouse, variantSku }, moves);

      await writeLedger(session, {
        txnId,
        changeType: resellable ? "restock_return" : "damage_return",
        product: line.productId,
        productName: line.productName || "",
        warehouse,
        variantSku,
        quantity: qty,
        moves,
        quantityBefore: beforeAvail,
        quantityAfter: resellable ? beforeAvail + qty : beforeAvail,
        reason: reason || (resellable ? "Return passed QC — restocked" : "Return failed QC — moved to damaged"),
        orderId: orderId || null,
        performedByUserId: actor.userId || "",
        performedByEmail: actor.email || "",
        performedByRole: actor.role || "admin",
      });

      await refreshProductProjection(session, line.productId);
      touched.push({ productId: String(line.productId), variantSku });
    }

    return { touched };
  }).then((res) => {
    emitTouched(res.touched);
    return res;
  });
}

// ---------------------------------------------------------------------------
// ADMIN ADJUST — add / remove / set on a single (warehouse, product, variant).
// ---------------------------------------------------------------------------
async function adminAdjust({ productId, variantSku = "", warehouse = null, type, quantity, reason = "", actor = {} }) {
  return withTxn(async (session) => {
    const wh = warehouse || (await getDefaultWarehouseId(session));
    const sku = variantSku || "";
    const qty = Math.abs(Number(quantity));

    // Seed ALL of this product's rows from current stock first. This makes the
    // subsequent refreshProductProjection safe (never zeroes a sibling variant)
    // and means legacy products work with zero manual migration.
    await ensureProductInventory(session, productId, wh);

    const row = await Inventory.findOne({ product: productId, warehouse: wh, variantSku: sku }).session(session);
    const before = row ? row.available : 0;

    let delta;
    if (type === "set") delta = Math.max(0, qty) - before;
    else if (type === "remove") delta = -Math.min(qty, before);
    else delta = qty; // add

    if (delta !== 0) {
      await applyBucketDeltas(session, { product: productId, warehouse: wh, variantSku: sku }, { available: delta });
    }

    const changeType = type === "set" ? "admin_set" : type === "remove" ? "admin_remove" : "admin_add";
    await writeLedger(session, {
      txnId: genTxnId("adm"),
      changeType,
      product: productId,
      warehouse: wh,
      variantSku: sku,
      quantity: delta,
      moves: { available: delta },
      quantityBefore: before,
      quantityAfter: before + delta,
      reason,
      performedByUserId: actor.userId || "",
      performedByEmail: actor.email || "",
      performedByRole: actor.role || "admin",
    });

    await refreshProductProjection(session, productId);
    return { before, after: before + delta, delta, touched: [{ productId: String(productId), variantSku: sku }] };
  }).then((res) => {
    emitTouched(res.touched);
    return res;
  });
}

// ---------------------------------------------------------------------------
// TRANSFER — move available stock between warehouses (out -> inTransit -> in).
// Single transaction so the two sides can never desync.
// ---------------------------------------------------------------------------
async function transferStock({ productId, variantSku = "", fromWarehouse, toWarehouse, quantity, reason = "", actor = {} }) {
  return withTxn(async (session) => {
    const sku = variantSku || "";
    const qty = Math.abs(Number(quantity));
    const txnId = genTxnId("xfer");

    // Seed both locations' rows from current stock (idempotent) so the transfer
    // and the later projection refresh never zero a sibling variant.
    await ensureProductInventory(session, productId, fromWarehouse);
    await ensureProductInventory(session, productId, toWarehouse);

    const fromRow = await Inventory.findOne({ product: productId, warehouse: fromWarehouse, variantSku: sku }).session(session);
    const beforeFrom = fromRow ? fromRow.available : 0;

    const out = await applyBucketDeltas(
      session,
      { product: productId, warehouse: fromWarehouse, variantSku: sku },
      { available: -qty }
    );
    if (!out) {
      const err = new Error("Transfer failed: insufficient available at source");
      err.code = "OUT_OF_STOCK";
      throw err;
    }
    await writeLedger(session, {
      txnId, changeType: "transfer_out", product: productId, warehouse: fromWarehouse, variantSku: sku,
      quantity: qty, moves: { available: -qty }, quantityBefore: beforeFrom, quantityAfter: out.available,
      reason: reason || "Stock transfer out", performedByUserId: actor.userId || "", performedByEmail: actor.email || "",
      performedByRole: actor.role || "admin",
    });

    const toRow = await Inventory.findOne({ product: productId, warehouse: toWarehouse, variantSku: sku }).session(session);
    const beforeTo = toRow ? toRow.available : 0;
    const inn = await applyBucketDeltas(
      session,
      { product: productId, warehouse: toWarehouse, variantSku: sku },
      { available: qty }
    );
    await writeLedger(session, {
      txnId, changeType: "transfer_in", product: productId, warehouse: toWarehouse, variantSku: sku,
      quantity: qty, moves: { available: qty }, quantityBefore: beforeTo, quantityAfter: inn.available,
      reason: reason || "Stock transfer in", performedByUserId: actor.userId || "", performedByEmail: actor.email || "",
      performedByRole: actor.role || "admin",
    });

    await refreshProductProjection(session, productId);
    return { touched: [{ productId: String(productId), variantSku: sku }] };
  }).then((res) => {
    emitTouched(res.touched);
    return res;
  });
}

// Post-commit real-time emitter. Runs AFTER the transaction commits so we never
// broadcast a state that later rolls back. Best-effort; failures are logged.
function emitTouched(touched) {
  if (!Array.isArray(touched)) return;
  for (const t of touched) {
    Promise.resolve()
      .then(() => computeAndEmit(t.productId, t.variantSku))
      .catch((e) => console.warn("inventory emit failed:", e.message));
  }
}

async function computeAndEmit(productId, variantSku) {
  const rows = await Inventory.find({ product: productId });
  const totalAvailable = rows.reduce((s, r) => s + r.available, 0);
  const totalReserved = rows.reduce((s, r) => s + r.reserved, 0);
  emitInventoryChange({
    productId: String(productId),
    variantSku: variantSku || "",
    available: totalAvailable,
    reserved: totalReserved,
    status: deriveStatus(totalAvailable),
  });
}

function deriveStatus(available, reorderPoint = 10) {
  if (available <= 0) return "Out of Stock";
  if (available <= reorderPoint) return "Low Stock";
  return "In Stock";
}

module.exports = {
  reserveForOrder,
  releaseForOrder,
  commitForOrder,
  processReturn,
  adminAdjust,
  transferStock,
  getDefaultWarehouseId,
  ensureDefaultWarehouse,
  ensureProductInventory,
  deriveStatus,
  _resetWarehouseCache: () => { _defaultWarehouseId = null; },
};
