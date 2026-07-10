const mongoose = require("mongoose");

// A physical (or logical) stock location. Every InventoryItem belongs to
// exactly one warehouse, so per-warehouse buckets can be tracked independently.
const warehouseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    pincode: { type: String, default: "", trim: true },
    // A single warehouse can be marked default; the inventory engine falls back
    // to it whenever an operation does not specify a warehouse explicitly.
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Warehouse || mongoose.model("Warehouse", warehouseSchema);
