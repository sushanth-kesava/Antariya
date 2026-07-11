const mongoose = require("mongoose");

/**
 * Immutable-ish record of a privileged action taken in the ERP portal.
 * Every state-changing superadmin/admin operation should write one of these
 * via the recordAudit() helper so the Governance module can show a full trail
 * of "who did what, to whom, when".
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    actorId: { type: String, default: null, index: true },
    actorEmail: { type: String, default: null, lowercase: true, trim: true, index: true },
    actorRole: { type: String, default: null },

    // What happened
    action: { type: String, required: true, index: true }, // e.g. "user.role.update"
    module: { type: String, default: null, index: true },   // e.g. "hr"
    permissionUsed: { type: String, default: null },          // permission key that authorized it

    // What it was done to
    targetType: { type: String, default: null }, // e.g. "user", "role", "order"
    targetId: { type: String, default: null },
    targetLabel: { type: String, default: null }, // human-friendly (email, order #, etc.)

    // Details
    summary: { type: String, default: "", trim: true, maxlength: 500 },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },

    // Request context
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    status: { type: String, enum: ["success", "failure"], default: "success", index: true },
  },
  {
    timestamps: true,
    collection: "audit_logs",
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ actorEmail: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
