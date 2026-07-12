const mongoose = require("mongoose");

/**
 * A reusable email template authored in the ERP Communications module.
 * Body is stored as HTML with optional {{placeholders}} that are substituted
 * at send time (e.g. {{name}}, {{email}}). `key` is a stable identifier for
 * system templates; user-created templates get an auto key.
 */
const emailTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 240 },
    html: { type: String, required: true },
    description: { type: String, default: "", trim: true, maxlength: 400 },
    // Placeholder keys the template expects, for the composer UI (informational).
    placeholders: { type: [String], default: [] },
    system: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "email_templates",
  }
);

module.exports = mongoose.models.EmailTemplate || mongoose.model("EmailTemplate", emailTemplateSchema);
