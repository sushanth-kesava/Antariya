const mongoose = require("mongoose");

// Immutable audit trail. Every inventory mutation writes exactly one entry per
// affected (product, variant, warehouse) bucket, inside the same transaction as
// the mutation itself, so the log can never disagree with actual stock.
const inventoryAuditLogSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, default: "", trim: true },
    variantSku: { type: String, default: "", trim: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null, index: true },

    // Which bucket moved and by how much (signed delta).
    // e.g. changeType "order_reserve" bucket "reserved" delta +2
    changeType: {
      type: String,
      required: true,
      trim: true,
      // reserve | release | commit | order_deduct | cancel_restock | manual_add |
      // manual_remove | manual_set | return_resellable | return_damaged |
      // exchange_out | transfer_in | transfer_out | receive_incoming | reconcile
      index: true,
    },
    bucket: { type: String, default: "onHand", trim: true },
    delta: { type: Number, required: true },
    quantityBefore: { type: Number, default: 0 },
    quantityAfter: { type: Number, default: 0 },

    reason: { type: String, default: "", trim: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    reservationKey: { type: String, default: "", trim: true },

    performedByUserId: { type: String, default: "", index: true },
    performedByEmail: { type: String, default: "", trim: true, lowercase: true },
  },
  { timestamps: true }
);

inventoryAuditLogSchema.index({ productId: 1, createdAt: -1 });
inventoryAuditLogSchema.index({ warehouseId: 1, createdAt: -1 });

module.exports =
  mongoose.models.InventoryAuditLog ||
  mongoose.model("InventoryAuditLog", inventoryAuditLogSchema);
