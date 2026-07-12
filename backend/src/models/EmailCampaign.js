const mongoose = require("mongoose");

/**
 * A broadcast email (newsletter / announcement) sent to an audience segment.
 * The campaign records who it targeted, how many were queued, and how many
 * ultimately sent/failed (updated as the mail queue drains).
 */
const emailCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    subject: { type: String, required: true, trim: true, maxlength: 240 },
    html: { type: String, required: true },
    // Audience segment this campaign targeted.
    audience: {
      type: String,
      enum: ["all_customers", "newsletter", "waitlist", "admins", "custom"],
      default: "newsletter",
      index: true,
    },
    // Snapshot of recipient emails at send time (deduped, lowercased).
    recipientCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "queued", "sending", "sent", "failed"],
      default: "draft",
      index: true,
    },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    createdBy: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "email_campaigns",
  }
);

emailCampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.models.EmailCampaign || mongoose.model("EmailCampaign", emailCampaignSchema);
