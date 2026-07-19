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
    variantSku: { type: String, default: "", trim: true },
    variant: {
      sku: { type: String, default: "", trim: true },
      size: { type: String, default: "", trim: true },
      color: { type: String, default: "", trim: true },
      gender: { type: String, default: "", trim: true },
      neckType: { type: String, default: "", trim: true },
      pattern: { type: String, default: "", trim: true },
    },
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
    discount: { type: Number, default: 0, min: 0 },
    coupon: {
      code: { type: String, default: "", trim: true },
      discountType: { type: String, enum: ["percentage", "flat", "free_shipping", ""], default: "" },
      discountValue: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      freeShipping: { type: Boolean, default: false },
    },
    tax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Refunded", "Expired"],
      default: "Processing",
    },
    paymentMethod: { type: String, enum: ["upi", "cod"], required: true, default: "upi" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], required: true, default: "pending" },
    razorpayOrderId: { type: String, default: "", trim: true },
    razorpayPaymentId: { type: String, default: "", trim: true, index: true },
    // COD anti-fraud: the delivery charge is collected online up-front even for
    // Cash-on-Delivery orders, so only genuine buyers confirm. The product
    // amount is still paid in cash on delivery.
    //   deliveryPrepaid       — delivery fee was paid online (COD confirmation)
    //   amountPrepaid         — how much was charged online (the delivery fee)
    //   amountDueOnDelivery   — cash to collect from the customer on delivery
    deliveryPrepaid: { type: Boolean, default: false },
    amountPrepaid: { type: Number, default: 0, min: 0 },
    amountDueOnDelivery: { type: Number, default: 0, min: 0 },
    // Idempotency key binding this order to its inventory reservation, so
    // reserve/commit/release stay exactly-once across retries.
    reservationKey: { type: String, default: "", trim: true, index: true },
    // Whether the held stock has been committed (physically deducted on dispatch).
    inventoryCommitted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
