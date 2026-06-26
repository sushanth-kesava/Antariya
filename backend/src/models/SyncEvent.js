/**
 * Sync Event Model
 * Tracks all synchronization events for audit and idempotency
 */

const mongoose = require("mongoose");

const syncEventSchema = new mongoose.Schema(
  {
    _id: String, // UUID
    odooEventId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "product.product.create",
        "product.product.update",
        "product.product.delete",
        "stock.quant.update",
        "sale.order.create",
        "sale.order.confirm",
        "sale.order.shipped",
        "sale.order.delivered",
        "sale.order.cancel",
        "account.move.create",
        "account.move.posted",
        "account.move.cancelled",
        "account.move.paid",
      ],
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    payload: mongoose.Schema.Types.Mixed,
    jobId: String,
    retryCount: {
      type: Number,
      default: 0,
    },
    lastError: String,
    timestamp: Date,
    processedAt: Date,
    completedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for querying recent events
syncEventSchema.index({ createdAt: -1 });
syncEventSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("SyncEvent", syncEventSchema);
