const nodemailer = require("nodemailer");
const env = require("../config/env");

let cachedTransporter = null;

function resolveFromAddress() {
  if (env.emailFrom) {
    return env.emailFrom;
  }

  return `"${env.mailFromName}" <${env.mailFromEmail}>`;
}

function hasMailConfig() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.mailFromEmail);
}

function getTransporter() {
  if (!hasMailConfig()) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  return cachedTransporter;
}

async function sendMail({ to, subject, html, text }) {
  const transporter = getTransporter();

  if (!transporter) {
    return {
      sent: false,
      skipped: true,
      reason: "Mail transport is not configured",
    };
  }

  await transporter.sendMail({
    from: resolveFromAddress(),
    to,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    skipped: false,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildWelcomeMessage(displayName) {
  const appName = env.appName || "StitchMart";
  const safeName = escapeHtml(displayName || "there");
  const safeAppName = escapeHtml(appName);
  const websiteUrl = env.frontendUrl || "http://localhost:9002";
  const safeWebsiteUrl = escapeHtml(websiteUrl);

  return {
    subject: `Welcome to ${appName} - Your account is ready`,
    text:
      `Hi ${displayName || "there"},\n\n` +
      `Welcome to ${appName}. Your account has been created successfully using Google sign-in.\n\n` +
      `You can now login and explore:\n` +
      `- Curated embroidery marketplace\n` +
      `- Custom design studio\n` +
      `- Order tracking and wishlist\n\n` +
      `Login here: ${websiteUrl}\n\n` +
      `Regards,\n${appName} Team`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Welcome to ${safeAppName}</title>
        </head>
        <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                  <tr>
                    <td style="background:linear-gradient(135deg,#0f766e,#0ea5a4);padding:30px 28px;">
                      <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#ccfbf1;font-weight:700;">Welcome</p>
                      <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;color:#ffffff;">${safeAppName}</h1>
                      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#e6fffb;">Your account is now active. Start exploring premium designs and personalized embroidery experiences.</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:30px 28px 8px;">
                      <p style="margin:0;font-size:17px;line-height:1.6;color:#111827;">Hi <strong>${safeName}</strong>,</p>
                      <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#374151;">Thanks for signing up with Google. We are excited to have you on board.</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 28px 6px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d1fae5;background:#f0fdfa;border-radius:12px;">
                        <tr>
                          <td style="padding:16px 18px;">
                            <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0f766e;">What you can do on ${safeAppName}</p>
                            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#134e4a;">1. Browse curated embroidery-ready products.</p>
                            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#134e4a;">2. Use the customization studio to create unique designs.</p>
                            <p style="margin:0;font-size:14px;line-height:1.6;color:#134e4a;">3. Track orders and manage your wishlist from your portal.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:24px 28px 8px;">
                      <a href="${safeWebsiteUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 34px;border-radius:10px;">Login to ${safeAppName}</a>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 28px 30px;">
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">Need help? Reply to this email and our team will assist you.</p>
                      <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#9ca3af;">This is an automated message from ${safeAppName}. Please do not share your account credentials with anyone.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

async function sendWelcomeEmail({ to, displayName }) {
  const message = buildWelcomeMessage(displayName);
  return sendMail({ to, ...message });
}

function buildWaitlistConfirmationMessage({ displayName }) {
  const appName = env.appName || "StitchMart";
  const safeName = escapeHtml(displayName || "there");
  const safeAppName = escapeHtml(appName);
  const websiteUrl = env.frontendUrl || "https://antariyaofficial.com";
  const safeWebsiteUrl = escapeHtml(websiteUrl);

  return {
    subject: `You are on the ${appName} VIP waitlist`,
    text:
      `Hi ${displayName || "there"},\n\n` +
      `Thanks for joining the ${appName} VIP waitlist. You are now in line for early access and launch updates.\n\n` +
      `We will email you when invites open.\n\n` +
      `Website: ${websiteUrl}\n\n` +
      `Regards,\n${appName} Team`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${safeAppName} VIP Waitlist</title>
        </head>
        <body style="margin:0;padding:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
                  <tr>
                    <td style="background:#111827;padding:28px;">
                      <p style="margin:0;font-size:12px;letter-spacing:0.09em;text-transform:uppercase;color:#fbbf24;font-weight:700;">VIP Waitlist</p>
                      <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;color:#ffffff;">${safeAppName}</h1>
                      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#e5e7eb;">You are confirmed for priority launch updates and early access drops.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px 28px 12px;">
                      <p style="margin:0;font-size:17px;line-height:1.6;color:#111827;">Hi <strong>${safeName}</strong>,</p>
                      <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#374151;">Thanks for joining our VIP waitlist. We have secured your spot and will email you first when launch access opens.</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:16px 28px 8px;">
                      <a href="${safeWebsiteUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 30px;border-radius:10px;">Visit ${safeAppName}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 28px 28px;">
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#57534e;">This email confirms your VIP waitlist registration.</p>
                      <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;">${safeAppName} Team</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

async function sendWaitlistConfirmationEmail({ to, displayName }) {
  const message = buildWaitlistConfirmationMessage({ displayName });
  return sendMail({ to, ...message });
}

module.exports = {
  sendWelcomeEmail,
  sendWaitlistConfirmationEmail,
  hasMailConfig,
};
