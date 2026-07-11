const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, default: "", trim: true },
    size: { type: String, default: "", trim: true },
    color: { type: String, default: "", trim: true },
    gender: { type: String, default: "", trim: true },
    neckType: { type: String, default: "", trim: true },
    pattern: { type: String, default: "", trim: true },
    price: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    reorderPoint: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, default: "", trim: true },
    subCategory: { type: String, default: "", trim: true },
    size: { type: String, default: "", trim: true },
    color: { type: String, default: "", trim: true },
    gender: { type: String, default: "", trim: true },
    neckType: { type: String, default: "", trim: true },
    pattern: { type: String, default: "", trim: true },
    sizes: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    genders: { type: [String], default: [] },
    neckTypes: { type: [String], default: [] },
    patterns: { type: [String], default: [] },
    variants: { type: [variantSchema], default: [] },
    reorderPoint: { type: Number, min: 0, default: 0 },
    dealerId: { type: String, required: true, index: true },
    dealerName: { type: String, required: true, trim: true },
    dealerEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    image: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    galleryImages: { type: [String], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    fileDownloadLink: { type: String, default: null },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    customizable: { type: Boolean, default: false },
    // Storefront visibility. Defaults true so all existing products stay
    // visible; toggled from the ERP Catalog module (catalog.publish).
    published: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ dealerId: 1, createdAt: -1 });

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);
