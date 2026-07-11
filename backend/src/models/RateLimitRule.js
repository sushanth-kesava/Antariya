const mongoose = require("mongoose");

/**
 * A configurable rate-limit rule. Rules are seeded from sensible defaults and
 * can be edited from the Governance module (window, max, enabled). The
 * rate-limit middleware reads the *effective* config for a rule key via the
 * ratelimit.service cache, falling back to the seeded default if the DB has no
 * override.
 */
const rateLimitRuleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    windowMs: { type: Number, required: true, min: 1000 },
    max: { type: Number, required: true, min: 1 },
    enabled: { type: Boolean, default: true },
    scope: { type: String, default: "ip" }, // informational: what the key is keyed on
    system: { type: Boolean, default: false },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "rate_limit_rules",
  }
);

module.exports =
  mongoose.models.RateLimitRule || mongoose.model("RateLimitRule", rateLimitRuleSchema);
