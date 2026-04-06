const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    userName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, maxlength: 1200 },
    verified: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    moderationStatus: {
      type: String,
      enum: ["approved", "hidden", "flagged", "pending"],
      default: "approved",
      index: true,
    },
    moderationNote: { type: String, trim: true, maxlength: 300, default: null },
    moderatedBy: { type: String, default: null },
    moderatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.Review || mongoose.model("Review", reviewSchema);
