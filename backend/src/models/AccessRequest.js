const mongoose = require("mongoose");

const accessRequestSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: ["admin_approval", "superadmin_access", "feature_request"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    requestedById: { type: String, required: true, index: true },
    requestedByEmail: { type: String, required: true, lowercase: true, trim: true },
    requestedByRole: { type: String, enum: ["customer", "admin", "superadmin"], default: "admin" },
    targetEmail: { type: String, default: null, lowercase: true, trim: true },
    targetName: { type: String, default: null, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, required: true, trim: true, maxlength: 1200 },
    requestedScopes: { type: [String], default: [] },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null, trim: true, maxlength: 400 },
  },
  {
    timestamps: true,
    collection: "access_requests",
  }
);

accessRequestSchema.index({ status: 1, createdAt: -1 });
accessRequestSchema.index(
  { requestType: 1, targetEmail: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      requestType: "admin_approval",
      status: "pending",
      targetEmail: { $type: "string" },
    },
  }
);

module.exports = mongoose.models.AccessRequest || mongoose.model("AccessRequest", accessRequestSchema);