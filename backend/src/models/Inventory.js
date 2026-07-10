const mongoose = require("mongoose");

// The single source of truth for physical stock. One row per
// (warehouse, product, variantSku). The product's flat `stock` field and the
// embedded variant `stock` fields become DERIVED, read-only projections kept
// in sync by the inventory service — never written to directly anymore.
//
// Bucket semantics (all non-negative):
//   available  — sellable right now (what the storefront shows)
//   reserved   — held for unpaid/at-risk orders; not sellable, not yet shipped
//   damaged    — failed QC on return; not sellable
//   returned   — received back, awaiting QC decision (transient holding bucket)
//   incoming   — expected from a purchase order / transfer (not yet received)
//   inTransit  — being transferred out to another warehouse
//
// Invariant: physical on-hand = available + reserved + damaged + returned.
// `incoming` and `inTransit` are informational and excluded from on-hand.
const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true, index: true },
    // "" for products that have no variants; otherwise the variant SKU.
    variantSku: { type: String, default: "", trim: true },

    available: { type: Number, required: true, min: 0, default: 0 },
    reserved: { type: Number, required: true, min: 0, default: 0 },
    damaged: { type: Number, required: true, min: 0, default: 0 },
    returned: { type: Number, required: true, min: 0, default: 0 },
    incoming: { type: Number, required: true, min: 0, default: 0 },
    inTransit: { type: Number, required: true, min: 0, default: 0 },

    // Per-location reorder threshold. Falls back to product/variant reorderPoint.
    reorderPoint: { type: Number, min: 0, default: 0 },

    // Optimistic-concurrency guard. Bumped on every mutation; conditional
    // updates assert the version they read to detect concurrent writes.
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One inventory row per location + product + variant.
inventorySchema.index({ warehouse: 1, product: 1, variantSku: 1 }, { unique: true });
// Fast storefront rollups: "total available for this product/variant".
inventorySchema.index({ product: 1, variantSku: 1 });

module.exports = mongoose.models.Inventory || mongoose.model("Inventory", inventorySchema);
