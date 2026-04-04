const mongoose = require("mongoose");

const adminProfileSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    photoURL: { type: String, default: null },
    provider: { type: String, default: "google" },
    lastAdminLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "admin_profiles",
  }
);

adminProfileSchema.index({ email: 1 });

module.exports = mongoose.models.AdminProfile || mongoose.model("AdminProfile", adminProfileSchema);
