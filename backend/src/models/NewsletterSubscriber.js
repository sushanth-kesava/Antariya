const mongoose = require("mongoose");

/**
 * A storefront newsletter subscriber. Distinct from WaitlistSubscriber (which
 * is the pre-launch VIP list). Supports one-click unsubscribe via a token.
 */
const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    name: { type: String, default: "", trim: true, maxlength: 120 },
    source: { type: String, default: "website", trim: true, maxlength: 80 },
    status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed", index: true },
    unsubscribeToken: { type: String, default: null, index: true },
    unsubscribedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "newsletter_subscribers",
  }
);

module.exports =
  mongoose.models.NewsletterSubscriber || mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);
