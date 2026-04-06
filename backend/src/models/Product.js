const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    dealerId: { type: String, required: true, index: true },
    image: { type: String, required: true, trim: true },
    galleryImages: { type: [String], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    fileDownloadLink: { type: String, default: null },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    customizable: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);
