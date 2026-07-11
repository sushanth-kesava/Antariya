/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    photoURL: { type: String, default: null },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    // ERP RBAC: stable role key resolved against the Role catalog. Defaults
    // are derived from `role` for legacy records. Superadmin is still gated by
    // the email allowlist in config/env.js, but a matching roleKey is set too.
    roleKey: { type: String, default: null, index: true, lowercase: true, trim: true },
    // Per-user permission overrides layered on top of the role's permissions.
    // effective = (role.permissions ∪ customPermissions) − deniedPermissions
    customPermissions: { type: [String], default: [] },
    deniedPermissions: { type: [String], default: [] },
    // Soft activation flag for portal staff (mirrors AdminProfile.active).
    active: { type: Boolean, default: true },
    authProvider: { type: String, enum: ["google", "credentials"], default: "google" },
    passwordHash: { type: String, default: null },
    oauth: {
      provider: { type: String, default: "google" },
      providerUserId: { type: String, default: null },
      accessToken: { type: String, default: null },
      tokenType: { type: String, default: null },
      scope: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      lastLoginAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
