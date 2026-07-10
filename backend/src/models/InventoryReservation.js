const mongoose = require("mongoose");

// Tracks the lifecycle of stock held for an order. This is what makes
// release/commit idempotent and enables the expiry sweeper to find orphaned
// holds. One reservation document per order (with per-line allocations).
//
// status transitions:
//   active   -> committed  (dispatch)
//   active   -> released   (cancel-before-dispatch / payment-failure / expiry)
// committed and released are terminal.
const allocationSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
    variantSku: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const inventoryReservationSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    status: { type: String, enum: ["active", "committed", "released"], default: "active", index: true },
    allocations: { type: [allocationSchema], required: true },

    // When an unpaid hold should be swept back to available. Null for holds
    // that are already paid (paid orders are not auto-expired).
    expiresAt: { type: Date, default: null, index: true },

    releasedReason: { type: String, default: "", trim: true },
    committedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.InventoryReservation ||
  mongoose.model("InventoryReservation", inventoryReservationSchema);
