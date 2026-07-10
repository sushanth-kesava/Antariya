const mongoose = require("mongoose");

// Append-only audit trail. EVERY inventory-affecting event writes one ledger
// row per (warehouse, product, variant) it touched, inside the same
// transaction as the stock mutation. Never updated or deleted.
//
// changeType is the business event. The `moves` object records the signed
// delta applied to each bucket so the ledger fully reconstructs state.
const LEDGER_CHANGE_TYPES = [
  "reserve", // order placed / payment confirmed -> available down, reserved up
  "commit", // dispatch -> reserved down (leaves the building)
  "release", // cancel-before-dispatch / payment-failure / expiry -> reserved down, available up
  "restock_return", // resellable return -> returned/available up
  "damage_return", // non-resellable return -> damaged up
  "admin_add",
  "admin_remove",
  "admin_set",
  "import",
  "transfer_out",
  "transfer_in",
  "reconcile", // correction written by the verification job
];

const bucketDeltaSchema = new mongoose.Schema(
  {
    available: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    damaged: { type: Number, default: 0 },
    returned: { type: Number, default: 0 },
    incoming: { type: Number, default: 0 },
    inTransit: { type: Number, default: 0 },
  },
  { _id: false }
);

const inventoryLedgerSchema = new mongoose.Schema(
  {
    // Human-facing transaction id (also used as the idempotency correlation).
    txnId: { type: String, required: true, index: true },
    changeType: { type: String, enum: LEDGER_CHANGE_TYPES, required: true, index: true },

    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, default: "", trim: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true, index: true },
    variantSku: { type: String, default: "", trim: true },

    quantity: { type: Number, required: true }, // primary signed magnitude of the event
    moves: { type: bucketDeltaSchema, default: () => ({}) }, // signed per-bucket deltas

    // Bucket snapshot AFTER the change (for the specific buckets touched).
    quantityBefore: { type: Number, default: 0 }, // available before (headline number)
    quantityAfter: { type: Number, default: 0 }, // available after

    reason: { type: String, default: "", trim: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },

    performedByUserId: { type: String, default: "", index: true },
    performedByEmail: { type: String, default: "", trim: true, lowercase: true },
    performedByRole: { type: String, default: "system", trim: true },
  },
  { timestamps: true }
);

inventoryLedgerSchema.index({ product: 1, createdAt: -1 });
inventoryLedgerSchema.index({ orderId: 1, changeType: 1 });

module.exports = {
  LEDGER_CHANGE_TYPES,
  InventoryLedger:
    mongoose.models.InventoryLedger || mongoose.model("InventoryLedger", inventoryLedgerSchema),
};
