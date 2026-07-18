const nodemailer = require("nodemailer");
const env = require("../config/env");
const { buildInvoicePdf } = require("./invoice.service");

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

async function sendMail({ to, subject, html, text, attachments }) {
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
    ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
  });

  console.log(`[Mail] ✉️  Email sent to ${to} | Subject: "${subject}"`);

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
  const appName = env.appName || "Antariya";
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
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Welcome to ${safeAppName}</title></head><body style="margin:0;padding:0;background:#faf8f5;font-family:'Georgia','Times New Roman',serif;color:#1a1a2e;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:20px 0;"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);"><tr><td style="background:#0d1b3e;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9a96e;border-radius:4px;"><tr><td align="center" style="padding:32px 28px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:72px;height:72px;border:2px solid #c9a96e;border-radius:50%;"><span style="font-size:32px;font-weight:700;color:#c9a96e;font-family:'Georgia',serif;line-height:68px;">A</span></td></tr></table><h1 style="margin:14px 0 0;font-size:28px;letter-spacing:0.18em;color:#ffffff;font-weight:400;font-family:'Georgia','Times New Roman',serif;text-transform:uppercase;">ANTARIYA</h1><p style="margin:8px 0 0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#c9a96e;font-weight:400;">Premium Embroidery. Personalized For You.</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:40px 28px 10px;background:#ffffff;"><h2 style="margin:0;font-size:34px;font-weight:400;color:#0d1b3e;font-family:'Georgia','Times New Roman',serif;line-height:1.2;">Welcome to ${safeAppName}!</h2><table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr><td style="width:40px;height:1px;background:#c9a96e;"></td><td style="padding:0 10px;"><span style="font-size:14px;color:#c9a96e;">&#10022;&#10022;&#10022;</span></td><td style="width:40px;height:1px;background:#c9a96e;"></td></tr></table></td></tr><tr><td style="padding:20px 36px 12px;background:#ffffff;"><p style="margin:0;font-size:16px;line-height:1.7;color:#2d2d44;">Hi <strong>${safeName}</strong>,</p><p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#4a4a5a;">Thanks for signing up with Google. We are excited to have you on board. Explore a world of premium embroidery designs crafted just for you.</p></td></tr><tr><td style="padding:16px 36px 8px;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:12px;overflow:hidden;"><tr><td align="center" style="padding:22px 20px 6px;"><p style="margin:0;font-size:20px;font-weight:400;color:#0d1b3e;font-family:'Georgia','Times New Roman',serif;">What you can do on ${safeAppName}</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px auto 0;"><tr><td style="width:40px;height:2px;background:#c9a96e;border-radius:2px;"></td></tr></table></td></tr><tr><td style="padding:20px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="56" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:50px;height:50px;border:2px solid #c9a96e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="font-size:22px;">&#128087;</span></td></tr></table></td><td style="padding-left:14px;vertical-align:top;"><p style="margin:0;font-size:15px;font-weight:700;color:#0d1b3e;">1. Browse curated embroidery-ready products.</p><p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5a5a6a;">Explore premium quality apparel curated for your style.</p></td></tr></table></td></tr><tr><td style="padding:18px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="56" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:50px;height:50px;border:2px solid #c9a96e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="font-size:22px;">&#10024;</span></td></tr></table></td><td style="padding-left:14px;vertical-align:top;"><p style="margin:0;font-size:15px;font-weight:700;color:#0d1b3e;">2. Use the customization studio to create unique designs.</p><p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5a5a6a;">Personalize your favorite pieces with names, initials or custom embroidery.</p></td></tr></table></td></tr><tr><td style="padding:18px 24px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="56" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:50px;height:50px;border:2px solid #c9a96e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="font-size:22px;">&#128230;</span></td></tr></table></td><td style="padding-left:14px;vertical-align:top;"><p style="margin:0;font-size:15px;font-weight:700;color:#0d1b3e;">3. Track orders and manage your wishlist.</p><p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5a5a6a;">Stay updated on your orders and save your favorites from your portal.</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:28px 36px 12px;background:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0d1b3e;border:1px solid #c9a96e;border-radius:8px;padding:0;"><a href="${safeWebsiteUrl}" target="_blank" style="display:inline-block;padding:15px 40px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c9a96e;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">&#9734; &nbsp;LOGIN TO ${safeAppName.toUpperCase()}</a></td></tr></table></td></tr><tr><td style="padding:20px 36px 28px;background:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-right:10px;"><span style="font-size:20px;">&#127911;</span></td><td valign="middle"><p style="margin:0;font-size:14px;line-height:1.6;color:#5a5a6a;">Need help? Reply to this email and our team will assist you.</p></td></tr></table></td></tr><tr><td style="background:#0d1b3e;padding:20px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" width="25%" style="padding:4px 2px;"><p style="margin:0;font-size:18px;">&#128142;</p><p style="margin:4px 0 0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;font-weight:700;font-family:Arial,sans-serif;">Premium<br/>Quality</p></td><td width="1" style="background:#2a3a5e;">&nbsp;</td><td align="center" width="25%" style="padding:4px 2px;"><p style="margin:0;font-size:18px;">&#9997;</p><p style="margin:4px 0 0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;font-weight:700;font-family:Arial,sans-serif;">Expert<br/>Craftsmanship</p></td><td width="1" style="background:#2a3a5e;">&nbsp;</td><td align="center" width="25%" style="padding:4px 2px;"><p style="margin:0;font-size:18px;">&#9989;</p><p style="margin:4px 0 0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;font-weight:700;font-family:Arial,sans-serif;">Secure<br/>Shopping</p></td><td width="1" style="background:#2a3a5e;">&nbsp;</td><td align="center" width="25%" style="padding:4px 2px;"><p style="margin:0;font-size:18px;">&#128666;</p><p style="margin:4px 0 0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;font-weight:700;font-family:Arial,sans-serif;">Fast &amp; Reliable<br/>Delivery</p></td></tr></table></td></tr><tr><td style="background:#faf8f5;padding:24px 36px 12px;"><p style="margin:0;font-size:13px;line-height:1.6;color:#5a5a6a;text-align:center;">This is an automated message from ${safeAppName}.</p><p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5a5a6a;text-align:center;">Please <strong>do not share</strong> your account credentials with anyone.</p></td></tr><tr><td align="center" style="background:#faf8f5;padding:16px 36px 8px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:0 8px;"><a href="https://facebook.com/antariyaofficial" style="display:inline-block;width:36px;height:36px;background:#0d1b3e;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;"><span style="color:#ffffff;font-size:16px;font-weight:700;font-family:Arial,sans-serif;">f</span></a></td><td style="padding:0 8px;"><a href="https://instagram.com/antariyaofficial" style="display:inline-block;width:36px;height:36px;background:#0d1b3e;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;"><span style="color:#ffffff;font-size:15px;font-family:Arial,sans-serif;">&#9678;</span></a></td><td style="padding:0 8px;"><a href="https://pinterest.com/antariyaofficial" style="display:inline-block;width:36px;height:36px;background:#0d1b3e;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;"><span style="color:#ffffff;font-size:16px;font-weight:700;font-family:Arial,sans-serif;">P</span></a></td></tr></table></td></tr><tr><td align="center" style="background:#faf8f5;padding:8px 36px 24px;"><p style="margin:0;font-size:12px;color:#9a9a9a;font-family:Arial,sans-serif;">&copy; 2025 ${safeAppName}. All rights reserved.</p></td></tr></table></td></tr></table></td></tr></table></body></html>`,
  };
}

async function sendWelcomeEmail({ to, displayName }) {
  const message = buildWelcomeMessage(displayName);
  return sendMail({ to, ...message });
}

function buildWaitlistConfirmationMessage({ displayName }) {
  const appName = env.appName || "Antariya";
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
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${safeAppName} VIP Waitlist</title></head><body style="margin:0;padding:0;background:#faf8f5;font-family:'Georgia','Times New Roman',serif;color:#1a1a2e;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:20px 0;"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);"><tr><td style="background:#0d1b3e;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9a96e;border-radius:4px;"><tr><td align="center" style="padding:32px 28px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:72px;height:72px;border:2px solid #c9a96e;border-radius:50%;"><span style="font-size:32px;font-weight:700;color:#c9a96e;font-family:'Georgia',serif;line-height:68px;">A</span></td></tr></table><h1 style="margin:14px 0 0;font-size:28px;letter-spacing:0.18em;color:#ffffff;font-weight:400;font-family:'Georgia','Times New Roman',serif;text-transform:uppercase;">ANTARIYA</h1><p style="margin:8px 0 0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#c9a96e;font-weight:400;">Premium Embroidery. Personalized For You.</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:40px 28px 10px;background:#ffffff;"><h2 style="margin:0;font-size:30px;font-weight:400;color:#0d1b3e;font-family:'Georgia','Times New Roman',serif;line-height:1.2;">You're on the VIP Waitlist!</h2><table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr><td style="width:40px;height:1px;background:#c9a96e;"></td><td style="padding:0 10px;"><span style="font-size:14px;color:#c9a96e;">&#10022;&#10022;&#10022;</span></td><td style="width:40px;height:1px;background:#c9a96e;"></td></tr></table></td></tr><tr><td style="padding:20px 36px 12px;background:#ffffff;"><p style="margin:0;font-size:16px;line-height:1.7;color:#2d2d44;">Hi <strong>${safeName}</strong>,</p><p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#4a4a5a;">Thanks for joining our VIP waitlist. We have secured your spot and will notify you first when launch access opens.</p></td></tr><tr><td style="padding:16px 36px 8px;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:12px;background:#fdfcfa;"><tr><td style="padding:20px 24px;"><p style="margin:0;font-size:15px;font-weight:700;color:#0d1b3e;">&#127775; What you'll get:</p><p style="margin:10px 0 4px;font-size:14px;line-height:1.7;color:#4a4a5a;">&#8226; Early access to our premium embroidery collection</p><p style="margin:0 0 4px;font-size:14px;line-height:1.7;color:#4a4a5a;">&#8226; Exclusive launch-day discounts</p><p style="margin:0;font-size:14px;line-height:1.7;color:#4a4a5a;">&#8226; Priority notifications before anyone else</p></td></tr></table></td></tr><tr><td align="center" style="padding:28px 36px 12px;background:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0d1b3e;border:1px solid #c9a96e;border-radius:8px;padding:0;"><a href="${safeWebsiteUrl}" target="_blank" style="display:inline-block;padding:15px 40px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c9a96e;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">&#9734; &nbsp;VISIT ${safeAppName.toUpperCase()}</a></td></tr></table></td></tr><tr><td style="padding:20px 36px 28px;background:#ffffff;"><p style="margin:0;font-size:13px;line-height:1.6;color:#5a5a6a;">This email confirms your VIP waitlist registration. We'll be in touch soon!</p></td></tr><tr><td style="background:#0d1b3e;padding:16px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><p style="margin:0;font-size:12px;color:#c9a96e;letter-spacing:0.05em;font-family:Arial,sans-serif;">PREMIUM QUALITY &nbsp;&#8226;&nbsp; EXPERT CRAFTSMANSHIP &nbsp;&#8226;&nbsp; SECURE SHOPPING</p></td></tr></table></td></tr><tr><td align="center" style="background:#faf8f5;padding:20px 36px;"><p style="margin:0;font-size:12px;color:#9a9a9a;font-family:Arial,sans-serif;">&copy; 2025 ${safeAppName}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

async function sendWaitlistConfirmationEmail({ to, displayName }) {
  const message = buildWaitlistConfirmationMessage({ displayName });
  return sendMail({ to, ...message });
}

function buildOrderInvoiceMessage({ displayName, order }) {
  const appName = env.appName || "Antariya";
  const safeName = escapeHtml(displayName || "there");
  const safeAppName = escapeHtml(appName);
  const websiteUrl = env.frontendUrl || "https://antariyaofficial.com";
  const shortId = order?.id ? String(order.id).slice(-8).toUpperCase() : "N/A";
  const total = Number(order?.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    subject: `Your ${appName} order is confirmed - Invoice INV-${shortId}`,
    text:
      `Hi ${displayName || "there"},\n\n` +
      `Thank you for your order with ${appName}. Your order (INV-${shortId}) is confirmed.\n\n` +
      `Order total: Rs. ${total}\n\n` +
      `Your invoice is attached to this email as a PDF.\n\n` +
      `Track your orders: ${websiteUrl}/portal/customer\n\n` +
      `Regards,\n${appName} Team`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:0;background:#faf8f5;font-family:'Georgia','Times New Roman',serif;color:#1a1a2e;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:20px 0;"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);"><tr><td style="background:#0d1b3e;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9a96e;border-radius:4px;"><tr><td align="center" style="padding:28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:60px;height:60px;border:2px solid #c9a96e;border-radius:50%;"><span style="font-size:26px;font-weight:700;color:#c9a96e;font-family:'Georgia',serif;line-height:56px;">A</span></td></tr></table><h1 style="margin:10px 0 0;font-size:24px;letter-spacing:0.18em;color:#ffffff;font-weight:400;font-family:'Georgia','Times New Roman',serif;text-transform:uppercase;">ANTARIYA</h1><p style="margin:6px 0 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#c9a96e;">Order Confirmed &#10003;</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:36px 28px 10px;background:#ffffff;"><h2 style="margin:0;font-size:28px;font-weight:400;color:#0d1b3e;font-family:'Georgia','Times New Roman',serif;">Thank you for your order!</h2><p style="margin:8px 0 0;font-size:14px;color:#c9a96e;letter-spacing:0.05em;">Invoice INV-${shortId}</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px auto 0;"><tr><td style="width:40px;height:1px;background:#c9a96e;"></td><td style="padding:0 10px;"><span style="font-size:14px;color:#c9a96e;">&#10022;&#10022;&#10022;</span></td><td style="width:40px;height:1px;background:#c9a96e;"></td></tr></table></td></tr><tr><td style="padding:20px 36px 12px;background:#ffffff;"><p style="margin:0;font-size:16px;line-height:1.7;color:#2d2d44;">Hi <strong>${safeName}</strong>,</p><p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#4a4a5a;">Thank you for shopping with ${safeAppName}. Your order is confirmed and is now being processed. Your detailed invoice is attached to this email as a PDF.</p></td></tr><tr><td style="padding:16px 36px 8px;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:12px;background:#fdfcfa;"><tr><td style="padding:20px 24px;text-align:center;"><p style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#5a5a6a;">Order Total</p><p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0d1b3e;font-family:'Georgia',serif;">&#8377; ${total}</p></td></tr></table></td></tr><tr><td align="center" style="padding:28px 36px 12px;background:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0d1b3e;border:1px solid #c9a96e;border-radius:8px;padding:0;"><a href="${escapeHtml(websiteUrl)}/portal/customer" target="_blank" style="display:inline-block;padding:15px 40px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c9a96e;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">&#9734; &nbsp;VIEW MY ORDERS</a></td></tr></table></td></tr><tr><td style="padding:16px 36px 28px;background:#ffffff;"><p style="margin:0;font-size:14px;line-height:1.6;color:#5a5a6a;font-style:italic;text-align:center;">Every Stitch Tells a Story.</p></td></tr><tr><td style="background:#0d1b3e;padding:16px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><p style="margin:0;font-size:12px;color:#c9a96e;letter-spacing:0.05em;font-family:Arial,sans-serif;">PREMIUM QUALITY &nbsp;&#8226;&nbsp; EXPERT CRAFTSMANSHIP &nbsp;&#8226;&nbsp; FAST DELIVERY</p></td></tr></table></td></tr><tr><td align="center" style="background:#faf8f5;padding:20px 36px;"><p style="margin:0;font-size:12px;color:#9a9a9a;font-family:Arial,sans-serif;">&copy; 2025 ${safeAppName}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

// Generate the invoice PDF and email it to the customer as an attachment.
async function sendOrderInvoiceEmail({ to, displayName, order, buyer }) {
  const message = buildOrderInvoiceMessage({ displayName, order });
  const shortId = order?.id ? String(order.id).slice(-8).toUpperCase() : "invoice";
  let attachments = [];
  try {
    const pdfBuffer = buildInvoicePdf(order, buyer || { name: displayName, email: to });
    attachments = [
      {
        filename: `Antariya-Invoice-INV-${shortId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];
  } catch (error) {
    // If PDF generation fails, still send the confirmation email without the attachment.
    // eslint-disable-next-line no-console
    console.error("Invoice PDF generation failed:", error.message);
  }
  return sendMail({ to, ...message, attachments });
}

/**
 * Wrap arbitrary body HTML in the branded Antariya email shell (header with
 * brand name + footer). Used for campaigns and templated emails so every
 * message looks consistent. `bodyHtml` is inserted as-is (already trusted /
 * sanitized by the composer). An optional unsubscribe URL renders a footer link.
 */
function wrapBrandedEmail({ title, bodyHtml, unsubscribeUrl }) {
  const appName = env.appName || "Antariya";
  const safeAppName = escapeHtml(appName);
  const safeTitle = escapeHtml(title || appName);
  const websiteUrl = env.frontendUrl || "https://antariyaofficial.com";
  const safeWebsiteUrl = escapeHtml(websiteUrl);
  const unsubscribeBlock = unsubscribeUrl
    ? `<p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;">Don't want these emails? <a href="${escapeHtml(
        unsubscribeUrl
      )}" style="color:#0f766e;">Unsubscribe</a>.</p>`
    : "";

  return `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${safeTitle}</title></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
        <tr><td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr><td style="background:linear-gradient(135deg,#0f766e,#0ea5a4);padding:26px 28px;">
              <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;">${safeAppName}</h1>
            </td></tr>
            <tr><td style="padding:28px;">${bodyHtml}</td></tr>
            <tr><td style="padding:18px 28px 30px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">Visit us at <a href="${safeWebsiteUrl}" style="color:#0f766e;">${safeWebsiteUrl}</a></p>
              ${unsubscribeBlock}
              <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;">© ${new Date().getFullYear()} ${safeAppName}. All rights reserved.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
}

/** Substitute {{key}} placeholders in a string with values from `vars`. */
function renderPlaceholders(template, vars = {}) {
  return String(template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : match
  );
}

/**
 * Send a branded email built from a raw subject + body HTML (already the inner
 * content — it gets wrapped in the branded shell). Used by campaigns.
 */
async function sendBrandedEmail({ to, subject, bodyHtml, unsubscribeUrl, vars }) {
  const renderedSubject = renderPlaceholders(subject, vars);
  const renderedBody = renderPlaceholders(bodyHtml, vars);
  const html = wrapBrandedEmail({ title: renderedSubject, bodyHtml: renderedBody, unsubscribeUrl });
  // Plain-text fallback: strip tags from the rendered body.
  const text = renderedBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
return sendMail({ to, subject: renderedSubject, html, text });
}

/**
 * Send a password reset email with a secure link.
 */
async function sendPasswordResetEmail(to, resetUrl, displayName) {
  if (!hasMailConfig()) {
    console.warn("[Mail] Skipping password reset email — SMTP not configured");
    return;
  }

  const name = displayName || to.split("@")[0];
  const subject = "Reset your Antariya password";
  const html = wrapBrandedEmail(`
    <h2 style="color:#1a1a1a;margin:0 0 16px">Password Reset Request</h2>
    <p style="color:#333;font-size:15px;line-height:1.6">
      Hi ${escapeHtml(name)},
    </p>
    <p style="color:#333;font-size:15px;line-height:1.6">
      We received a request to reset your password. Click the button below to set a new password.
      This link expires in 30 minutes.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${resetUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
        Reset Password
      </a>
    </div>
    <p style="color:#666;font-size:13px;line-height:1.5">
      If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
    </p>
    <p style="color:#999;font-size:12px;margin-top:20px">
      If the button doesn't work, copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" style="color:#555;word-break:break-all">${resetUrl}</a>
    </p>
  `);

  return sendMail({ to, subject, html });
}

module.exports = {
  sendWelcomeEmail,
  sendWaitlistConfirmationEmail,
  sendOrderInvoiceEmail,
  sendMail,
  sendBrandedEmail,
  wrapBrandedEmail,
  renderPlaceholders,
  escapeHtml,
  hasMailConfig,
  sendPasswordResetEmail,
};
