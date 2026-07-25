/**
 * Mail Test Route (Admin-only)
 * POST /api/admin/mail/test
 * Body: { "to": "test@example.com" }
 *
 * Sends a test email to verify SMTP configuration is working.
 */
const express = require("express");
const router = express.Router();
const { sendMail } = require("../services/mail.service");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

router.post("/test", requireAuth, requireRole("superadmin"), async (req, res) => {
  const { to } = req.body;

  if (!to) {
    return res.status(400).json({ success: false, message: "Missing 'to' email address" });
  }

  try {
    const result = await sendMail({
      to,
      subject: "✅ Antariya Mail System - Test Email",
      html: `
        <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 30px; text-align: center;">
          <h1 style="color: #0d1b3e; margin-bottom: 10px;">🎉 It Works!</h1>
          <p style="color: #4a4a5a; font-size: 16px; line-height: 1.6;">
            Your Antariya mailing system is <strong>live and operational</strong>.
          </p>
          <hr style="border: none; border-top: 1px solid #c9a96e; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">
            Sent at ${new Date().toISOString()} via Nodemailer SMTP
          </p>
        </div>
      `,
      text: "Antariya Mail System Test - It Works! Your mailing system is live and operational.",
    });

    if (result.skipped) {
      return res.status(503).json({
        success: false,
        message: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM_EMAIL in environment.",
      });
    }

    return res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: error.message,
    });
  }
});

module.exports = router;
