const mongoose = require("mongoose");

// The single source of truth for physical stock. One document per
// (product, variantSku, warehouse) tuple. Product.stock / variant.stock become
// derived, denormalized mirrors of the SUM of these documents (kept in sync by
// the inventory service) so the storefront keeps working unchanged.
//
// Bucket semantics:
//   onHand    - units physically present in the warehouse right now
//   reserved  - subset of onHand promised to open orders (not yet shipped)
//   damaged   - units present but not sellable (failed QC / returns)
//   returned  - units received back, awaiting inspection routing
//   incoming  - purchase-order / restock units expected but not yet received
//   transfer  - units in transit to/from another warehouse
//
// available (sellable) = max(0, onHand - reserved). It is stored so queries and
// low-stock checks stay index-friendly, and is recomputed on every write.
const inventoryItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    // "" for products with no variants; the variant SKU otherwise.
    variantSku: { type: String, default: "", trim: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true, index: true },

    onHand: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    damaged: { type: Number, default: 0, min: 0 },
    returned: { type: Number, default: 0, min: 0 },
    incoming: { type: Number, default: 0, min: 0 },
    transfer: { type: Number, default: 0, min: 0 },

    available: { type: Number, default: 0, min: 0, index: true },

    // Per-location reorder threshold; falls back to product/variant reorderPoint
    // when zero. Drives low-stock alerts.
    reorderPoint: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// One stock row per product+variant+warehouse. This unique index is also the
// concurrency backbone: guarded $inc updates target a single unique document.
inventoryItemSchema.index(
  { productId: 1, variantSku: 1, warehouseId: 1 },
  { unique: true }
);

module.exports = mongoose.models.InventoryItem || mongoose.model("InventoryItem", inventoryItemSchema);
