const mongoose = require("mongoose");

// An audit-log entry for every manual stock change (add/remove/set),
// plus automated movements (order deduction, cancellation restock) if desired.
const stockAdjustmentSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, default: "", trim: true },
    variantSku: { type: String, default: "", trim: true },
    // "add" | "remove" | "set" | "order" | "cancel"
    type: { type: String, default: "add", trim: true },
    quantity: { type: Number, required: true }, // signed delta actually applied
    previousStock: { type: Number, default: 0 },
    newStock: { type: Number, default: 0 },
    reason: { type: String, default: "", trim: true },
    performedByUserId: { type: String, default: "", index: true },
    performedByEmail: { type: String, default: "", trim: true, lowercase: true },
  },
  {
    timestamps: true,
  }
);

stockAdjustmentSchema.index({ productId: 1, createdAt: -1 });

module.exports =
  mongoose.models.StockAdjustment || mongoose.model("StockAdjustment", stockAdjustmentSchema);
