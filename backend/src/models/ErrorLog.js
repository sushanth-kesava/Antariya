const mongoose = require("mongoose");

/**
 * Persisted record of a server-side error captured by the global error
 * handler. Lets the Governance module surface runtime failures without SSH
 * access to logs. A capped-ish retention is enforced by the errors controller
 * (purge endpoint) rather than a Mongo capped collection so entries stay
 * queryable/filterable.
 */
const errorLogSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true },
    name: { type: String, default: "Error", trim: true }, // error class, e.g. "ValidationError"
    statusCode: { type: Number, default: 500, index: true },
    stack: { type: String, default: null },

    // Request context at the time of the error
    method: { type: String, default: null },
    path: { type: String, default: null, index: true },
    query: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    actorEmail: { type: String, default: null, lowercase: true, trim: true, index: true },
    actorRole: { type: String, default: null },

    // Triage state
    resolved: { type: Boolean, default: false, index: true },
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    fingerprint: { type: String, default: null, index: true }, // name+path+statusCode for grouping
    count: { type: Number, default: 1 }, // occurrences merged into this fingerprint
    lastSeenAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
    collection: "error_logs",
  }
);

errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ resolved: 1, lastSeenAt: -1 });

module.exports = mongoose.models.ErrorLog || mongoose.model("ErrorLog", errorLogSchema);
