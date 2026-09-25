const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// PendingOrder — the server-side cart snapshot taken the moment a Razorpay
// order is created (POST /create-order). This is the missing piece that makes
// a captured payment recoverable WITHOUT the customer's browser: the webhook
// and the reconciliation script rebuild the real Order from this snapshot.
//
// Keyed by razorpayOrderId (unique). Once the real Order is materialized we
// mark status = "fulfilled" and store the resulting orderId, so all three
// fulfilment paths (browser handler, webhook, cron) stay exactly-once.
// ---------------------------------------------------------------------------

const pendingItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    variantSku: { type: String, default: "" },
    customization: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const pendingOrderSchema = new mongoose.Schema(
  {
    // Razorpay order id (order_xxx). Unique so a create-order retry updates in place.
    razorpayOrderId: { type: String, required: true, unique: true, index: true },

    // Snapshot of who was checking out — enough to rebuild req.auth without a token.
    auth: {
      sub: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      role: { type: String, default: "customer" },
    },

    // Exact cart at checkout time.
    items: { type: [pendingItemSchema], required: true },
    couponCode: { type: String, default: "" },

    // Amount (paise) we asked Razorpay to charge — used to sanity-check the
    // captured payment before fulfilling.
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    // Lifecycle: pending -> fulfilled (order created) | failed (gave up).
    status: {
      type: String,
      enum: ["pending", "fulfilled", "failed"],
      default: "pending",
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    razorpayPaymentId: { type: String, default: "" },
    fulfilledAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

pendingOrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.PendingOrder || mongoose.model("PendingOrder", pendingOrderSchema);
