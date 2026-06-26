/**
 * Sync Log Model
 * Tracks scheduled synchronization attempts
 */

const mongoose = require("mongoose");

const syncLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["products", "inventory", "orders", "invoices", "customers"],
      required: true,
      index: true,
    },
    syncTime: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["success", "failed", "partial"],
      default: "success",
    },
    itemsSynced: Number,
    itemsFailed: Number,
    errors: [String],
    duration: Number, // milliseconds
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for finding last sync for each entity type
syncLogSchema.index({ entityType: 1, syncTime: -1 });

module.exports = mongoose.model("SyncLog", syncLogSchema);
