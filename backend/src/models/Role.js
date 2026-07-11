const mongoose = require("mongoose");

/**
 * A Role is a named, editable bundle of permission keys. Roles are the
 * primary way authority is granted; individual users may additionally carry
 * per-user overrides (see User.customPermissions / User.deniedPermissions).
 *
 * `key` is a stable machine identifier (e.g. "hr_manager") used in JWTs and
 * user records. `system` roles are seeded from config/permissions.js and
 * cannot be deleted. `locked` roles cannot have their permission set edited
 * (superadmin always keeps the wildcard; customer always empty).
 */
const roleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true, maxlength: 400 },
    permissions: { type: [String], default: [] },
    system: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "roles",
  }
);

module.exports = mongoose.models.Role || mongoose.model("Role", roleSchema);
