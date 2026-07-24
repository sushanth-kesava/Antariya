const mongoose = require("mongoose");

// ─── Customization Configuration Schema ──────────────────────────────────────
const stockImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    label: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true }, // e.g. "logos", "patterns", "artwork"
  },
  { _id: false }
);

const predefinedSizeSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // e.g. "Small Logo", "Full Back"
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const customizationConfigSchema = new mongoose.Schema(
  {
    // Image source preference
    imageSource: { type: String, enum: ["customer_upload", "stock_selection", "both"], default: "both" },
    // Stock images available for selection
    stockImages: { type: [stockImageSchema], default: [] },
    // Upload requirements
    uploadFormats: { type: [String], default: ["pdf", "png", "jpg", "svg"] },
    minResolutionDPI: { type: Number, default: 300 },
    maxFileSizeMB: { type: Number, default: 25 },
    // Size constraints
    sizeUnit: { type: String, enum: ["inches", "cm", "both"], default: "inches" },
    maxWidth: { type: Number, default: null },
    maxHeight: { type: Number, default: null },
    predefinedSizes: { type: [predefinedSizeSchema], default: [] },
    // Position options
    positions: { type: [String], default: ["front-center", "back-center", "left-chest"] },
    allowCustomPosition: { type: Boolean, default: false },
    // Additional options
    notes: { type: String, default: "", trim: true },
    extraCharge: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

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
    customizationConfig: { type: customizationConfigSchema, default: null },
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
