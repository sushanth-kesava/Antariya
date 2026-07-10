const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    type: { type: String, required: true }, // e.g. "welcome", "order_placed", "order_shipped"
    status: { type: String, enum: ["sent", "failed", "skipped"], default: "sent" },
    attempts: { type: Number, default: 1 },
    error: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // orderId, userId, etc.
  },
  { timestamps: true }
);

emailLogSchema.index({ to: 1, createdAt: -1 });
emailLogSchema.index({ type: 1 });
emailLogSchema.index({ status: 1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
