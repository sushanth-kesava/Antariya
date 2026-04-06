const mongoose = require("mongoose");

const wishlistItemSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  },
  {
    timestamps: true,
  }
);

wishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.models.WishlistItem || mongoose.model("WishlistItem", wishlistItemSchema);
