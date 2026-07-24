const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    // "percentage" | "flat" | "free_shipping"
    discountType: {
      type: String,
      required: true,
      enum: ["percentage", "flat", "free_shipping"],
      default: "percentage",
    },
    // Discount value: percentage (e.g. 15 = 15%) or flat amount in INR paise (e.g. 20000 = ₹200)
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    // Maximum discount cap (only for percentage type) in paise
    maxDiscount: {
      type: Number,
      default: null,
    },
    // Minimum order value to apply this coupon (in paise)
    minOrderValue: {
      type: Number,
      default: 0,
    },
    // Minimum quantity of items in cart required to use this coupon
    minQuantity: {
      type: Number,
      default: 0,
    },
    // If true, applying this coupon also waives delivery charges
    freeDelivery: {
      type: Boolean,
      default: false,
    },
    // Validity
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    // Usage limits
    maxUses: {
      type: Number,
      default: null, // null = unlimited
    },
    maxUsesPerUser: {
      type: Number,
      default: 1,
    },
    currentUses: {
      type: Number,
      default: 0,
    },
    // Who used it: [{ userId, email, usedAt }]
    usageLog: [
      {
        userId: String,
        email: String,
        orderId: String,
        usedAt: { type: Date, default: Date.now },
      },
    ],
    // Display settings
    showOnHero: {
      type: Boolean,
      default: false,
    },
    heroBannerText: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    heroBannerColor: {
      type: String,
      default: "#1a1a1a",
    },
    // Categories this coupon applies to (empty = all categories)
    applicableCategories: [{ type: String }],
    // Status
    active: {
      type: Boolean,
      default: true,
    },
    // Who created it
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Virtual: is the coupon currently valid?
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  return (
    this.active &&
    now >= this.validFrom &&
    now <= this.validUntil &&
    (this.maxUses === null || this.currentUses < this.maxUses)
  );
});

couponSchema.set("toJSON", { virtuals: true });
couponSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Coupon", couponSchema);
