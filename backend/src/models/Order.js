const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    dealerId: { type: String, required: true, index: true },
    dealerName: { type: String, required: true, trim: true },
    dealerEmail: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    customization: {
      symbol: { type: String, trim: true },
      threadColor: { type: String, trim: true },
      fabricColor: { type: String, trim: true },
      size: { type: String, enum: ["Small", "Medium", "Large"] },
      placement: { type: String, trim: true },
      referenceImage: { type: String },
      referenceImageName: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true, trim: true, lowercase: true },
    userRole: { type: String, enum: ["customer", "admin"], default: "customer" },
    items: { type: [orderItemSchema], required: true, validate: [(arr) => arr.length > 0, "Order must have at least one item"] },
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["Processing", "Shipped", "Delivered", "Cancelled"], default: "Processing" },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
