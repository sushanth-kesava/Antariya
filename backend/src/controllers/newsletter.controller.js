const crypto = require("crypto");
const NewsletterSubscriber = require("../models/NewsletterSubscriber");
const { sendMail, wrapBrandedEmail } = require("../services/mail.service");

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/**
 * POST /newsletter/subscribe  (public)
 * Body: { email, name?, source? }
 * Idempotent: re-subscribing an existing email just re-activates it.
 */
async function subscribe(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: "A valid email is required." });
    }

    const name = String(req.body.name || "").trim().slice(0, 120);
    const source = String(req.body.source || "website").trim().slice(0, 80);
    const token = crypto.randomBytes(16).toString("hex");

    const sub = await NewsletterSubscriber.findOneAndUpdate(
      { email },
      {
        $set: { status: "subscribed", unsubscribedAt: null },
        $setOnInsert: { email, name, source, unsubscribeToken: token },
      },
      { new: true, upsert: true }
    );

    // Fire-and-forget welcome email for newsletter subscriber
    sendMail({
      to: sub.email,
      subject: "Welcome to Antariya Newsletter — Successfully Subscribed!",
      html: wrapBrandedEmail({
        title: "Welcome to Antariya Newsletter",
        bodyHtml: `
          <h2 style="margin:0 0 12px;color:#1a1a2e;">Welcome to Antariya Newsletter!</h2>
          <p style="font-size:15px;line-height:1.7;color:#4a4a5a;">
            Hi there! Thanks for subscribing to the Antariya newsletter.
          </p>
          <p style="font-size:15px;line-height:1.7;color:#4a4a5a;">
            You'll now receive updates on:
          </p>
          <ul style="font-size:14px;line-height:2;color:#4a4a5a;">
            <li>New premium embroidery collections</li>
            <li>Exclusive deals and early access</li>
            <li>Industry tips and trends</li>
            <li>Special announcements</li>
          </ul>
          <p style="font-size:14px;color:#5a5a6a;margin-top:16px;">
            We're glad to have you in our community!
          </p>
        `
      }),
      text: "Welcome to the Antariya newsletter! You'll receive updates on new collections, exclusive deals, and more."
    }).catch((err) => console.error("[Newsletter] Failed to send welcome email:", err.message));

    return res.status(201).json({
      success: true,
      message: "You're subscribed! Watch your inbox for updates.",
      subscriber: { email: sub.email, status: sub.status },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ success: true, message: "You're already subscribed." });
    }
    return next(error);
  }
}

/**
 * GET/POST /newsletter/unsubscribe  (public)
 * Query/body: { email } (and optional token). One-click unsubscribe.
 */
async function unsubscribe(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email || req.query.email);
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const sub = await NewsletterSubscriber.findOne({ email });
    if (!sub) {
      return res.status(200).json({ success: true, message: "You are not subscribed." });
    }

    sub.status = "unsubscribed";
    sub.unsubscribedAt = new Date();
    await sub.save();

    return res.status(200).json({ success: true, message: "You've been unsubscribed." });
  } catch (error) {
    return next(error);
  }
}

module.exports = { subscribe, unsubscribe };
