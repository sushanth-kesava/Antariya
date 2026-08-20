const nodemailer = require("nodemailer");
const https = require("https");
const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const { buildInvoicePdf } = require("./invoice.service");
const Product = require("../models/Product");

let cachedTransporter = null;

function resolveFromAddress() {
  if (env.emailFrom) {
    return env.emailFrom;
  }

  return `"${env.mailFromName}" <${env.mailFromEmail}>`;
}

function hasMailConfig() {
  return Boolean(
    (env.resendApiKey || (env.smtpHost && env.smtpUser && env.smtpPass)) && env.mailFromEmail
  );
}

function useResend() {
  return Boolean(env.resendApiKey);
}

// Log SMTP config status on module load (visible in Render logs at boot)
console.log("[Mail] Config Check:", {
  transport: env.resendApiKey ? "RESEND (HTTPS API)" : "SMTP",
  host: env.smtpHost || "NOT SET",
  port: env.smtpPort,
  user: env.smtpUser ? env.smtpUser.slice(0, 4) + "***" : "NOT SET",
  pass: env.smtpPass ? "SET (" + env.smtpPass.length + " chars)" : "NOT SET",
  from: env.mailFromEmail || "NOT SET",
  resendKey: env.resendApiKey ? "SET (" + env.resendApiKey.slice(0, 6) + "...)" : "NOT SET",
  ready: hasMailConfig(),
});

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
    connectionTimeout: 10000,  // 10s to establish connection
    greetingTimeout: 10000,    // 10s for SMTP greeting
    socketTimeout: 15000,      // 15s for socket inactivity
  });

  return cachedTransporter;
}

async function sendMail({ to, subject, html, text, attachments }) {
  // --- Use Resend HTTPS API if configured ---
  if (useResend()) {
    return sendViaResend({ to, subject, html, text, attachments });
  }

  // --- Fallback to SMTP ---
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

/**
 * Send email via Resend HTTPS API (no SMTP port needed)
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */
function sendViaResend({ to, subject, html, text, attachments }) {
  return new Promise((resolve, reject) => {
    const from = resolveFromAddress();
    const resendAttachments = Array.isArray(attachments)
      ? attachments
          .map((attachment) => {
            if (!attachment || !attachment.filename) {
              return null;
            }

            const payload = {
              filename: attachment.filename,
            };

            if (attachment.contentType) {
              payload.type = attachment.contentType;
            }

            if (attachment.cid) {
              payload.content_id = attachment.cid;
            }

            if (Buffer.isBuffer(attachment.content)) {
              payload.content = attachment.content.toString("base64");
              return payload;
            }

            if (typeof attachment.content === "string" && attachment.content.trim()) {
              payload.content = attachment.content;
              return payload;
            }

            if (attachment.path && fs.existsSync(attachment.path)) {
              payload.content = fs.readFileSync(attachment.path).toString("base64");
              return payload;
            }

            return null;
          })
          .filter(Boolean)
      : [];

    const body = JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || undefined,
      ...(resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
    });

    const options = {
      hostname: "api.resend.com",
      port: 443,
      path: "/emails",
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Mail] ✉️  Email sent via Resend to ${to} | Subject: "${subject}"`);
          resolve({ sent: true, skipped: false, provider: "resend", response: data });
        } else {
          console.error(`[Mail] Resend API error (${res.statusCode}):`, data);
          reject(new Error(`Resend API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.write(body);
    req.end();
  });
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
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Welcome to ${safeAppName}</title></head><body style="margin:0;padding:0;background:#faf8f5;font-family:'Georgia','Times New Roman',serif;color:#1a1a2e;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:20px 0;"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);"><tr><td style="background:#0d1b3e;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9a96e;border-radius:4px;"><tr><td align="center" style="padding:32px 28px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:72px;height:72px;border:2px solid #c9a96e;border-radius:50%;"><span style="font-size:32px;font-weight:700;color:#c9a96e;font-family:'Georgia',serif;line-height:68px;">A</span></td></tr></table><h1 style="margin:14px 0 0;font-size:28px;letter-spacing:0.18em;color:#ffffff;font-weight:400;font-family:'Georgia','Times New Roman',serif;text-transform:uppercase;">ANTARIYA</h1><p style="margin:8px 0 0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#c9a96e;font-weight:400;">Premium Embroidery. Personalized For You.</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:40px 28px 10px;background:#ffffff;"><h2 style="margin:0;font-size:34px;font-weight:400;color:#0d1b3e;font-family:'Georgia','Times New Roman',serif;line-height:1.2;">Welcome to ${safeAppName}!</h2><table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr><td style="width:40px;height:1px;background:#c9a96e;"></td><td style="padding:0 10px;"><span style="font-size:14px;color:#c9a96e;">&#10022;&#10022;&#10022;</span></td><td style="width:40px;height:1px;background:#c9a96e;"></td></tr></table></td></tr><tr><td style="padding:20px 36px 12px;background:#ffffff;"><p style="margin:0;font-size:16px;line-height:1.7;color:#2d2d44;">Hi <strong>${safeName}</strong>,</p><p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#4a4a5a;">Thanks for signing up with Google. We are excited to have you on board. Explore a world of premium embroidery designs crafted just for you.</p></td></tr><tr><td style="padding:16px 36px 8px;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:12px;overflow:hidden;"><tr><td align="center" style="padding:22px 20px 6px;"><p style="margin:0;font-size:20px;font-weight:400;color:#0d1b3e;font-family:'Georgia','Times New Roman',serif;">What you can do on ${safeAppName}</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px auto 0;"><tr><td style="width:40px;height:2px;background:#c9a96e;border-radius:2px;"></td></tr></table></td></tr><tr><td style="padding:20px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="56" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:50px;height:50px;border:2px solid #c9a96e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="font-size:22px;">&#128087;</span></td></tr></table></td><td style="padding-left:14px;vertical-align:top;"><p style="margin:0;font-size:15px;font-weight:700;color:#0d1b3e;">1. Browse curated embroidery-ready products.</p><p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5a5a6a;">Explore premium quality apparel curated for your style.</p></td></tr></table></td></tr><tr><td style="padding:18px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="56" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:50px;height:50px;border:2px solid #c9a96e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="font-size:22px;">&#10024;</span></td></tr></table></td><td style="padding-left:14px;vertical-align:top;"><p style="margin:0;font-size:15px;font-weight:700;color:#0d1b3e;">2. Use the customization studio to create unique designs.</p><p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5a5a6a;">Personalize your favorite pieces with names, initials or custom embroidery.</p></td></tr></table></td></tr><tr><td style="padding:18px 24px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="56" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:50px;height:50px;border:2px solid #c9a96e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="font-size:22px;">&#128230;</span></td></tr></table></td><td style="padding-left:14px;vertical-align:top;"><p style="margin:0;font-size:15px;font-weight:700;color:#0d1b3e;">3. Track orders and manage your wishlist.</p><p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5a5a6a;">Stay updated on your orders and save your favorites from your portal.</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:28px 36px 12px;background:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0d1b3e;border:1px solid #c9a96e;border-radius:8px;padding:0;"><a href="${safeWebsiteUrl}" target="_blank" style="display:inline-block;padding:15px 40px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c9a96e;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">&#9734; &nbsp;LOGIN TO ${safeAppName.toUpperCase()}</a></td></tr></table></td></tr><tr><td style="padding:20px 36px 28px;background:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-right:10px;"><span style="font-size:20px;">&#127911;</span></td><td valign="middle"><p style="margin:0;font-size:14px;line-height:1.6;color:#5a5a6a;">Need help? Reply to this email and our team will assist you.</p></td></tr></table></td></tr><tr><td style="background:#0d1b3e;padding:20px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" width="25%" style="padding:4px 2px;"><p style="margin:0;font-size:18px;">&#128142;</p><p style="margin:4px 0 0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;font-weight:700;font-family:Arial,sans-serif;">Premium<br/>Quality</p></td><td width="1" style="background:#2a3a5e;">&nbsp;</td><td align="center" width="25%" style="padding:4px 2px;"><p style="margin:0;font-size:18px;">&#9997;</p><p style="margin:4px 0 0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;font-weight:700;font-family:Arial,sans-serif;">Expert<br/>Craftsmanship</p></td><td width="1" style="background:#2a3a5e;">&nbsp;</td><td align="center" width="25%" style="padding:4px 2px;"><p style="margin:0;font-size:18px;">&#9989;</p><p style="margin:4px 0 0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;font-weight:700;font-family:Arial,sans-serif;">Secure<br/>Shopping</p></td><td width="1" style="background:#2a3a5e;">&nbsp;</td><td align="center" width="25%" style="padding:4px 2px;"><p style="margin:0;font-size:18px;">&#128666;</p><p style="margin:4px 0 0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;font-weight:700;font-family:Arial,sans-serif;">Fast &amp; Reliable<br/>Delivery</p></td></tr></table></td></tr><tr><td style="background:#faf8f5;padding:24px 36px 12px;"><p style="margin:0;font-size:13px;line-height:1.6;color:#5a5a6a;text-align:center;">This is an automated message from ${safeAppName}.</p><p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5a5a6a;text-align:center;">Please <strong>do not share</strong> your account credentials with anyone.</p></td></tr><tr><td align="center" style="background:#faf8f5;padding:16px 36px 8px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:0 8px;"><a href="https://facebook.com/antariyaofficial" style="display:inline-block;width:36px;height:36px;background:#0d1b3e;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;"><span style="color:#ffffff;font-size:16px;font-weight:700;font-family:Arial,sans-serif;">f</span></a></td><td style="padding:0 8px;"><a href="https://instagram.com/antariyaofficial" style="display:inline-block;width:36px;height:36px;background:#0d1b3e;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;"><span style="color:#ffffff;font-size:15px;font-family:Arial,sans-serif;">&#9678;</span></a></td><td style="padding:0 8px;"><a href="https://pinterest.com/antariyaofficial" style="display:inline-block;width:36px;height:36px;background:#0d1b3e;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;"><span style="color:#ffffff;font-size:16px;font-weight:700;font-family:Arial,sans-serif;">P</span></a></td></tr></table></td></tr><tr><td align="center" style="background:#faf8f5;padding:8px 36px 24px;"><p style="margin:0;font-size:12px;color:#9a9a9a;font-family:Arial,sans-serif;">&copy; ${new Date().getFullYear()} ${safeAppName}. All rights reserved.</p></td></tr></table></td></tr></table></td></tr></table></body></html>`,
  };
}

function welcomeProductImage(product, fallbackImage) {
  const images = [product?.image, ...(product?.images || []), ...(product?.galleryImages || [])];
  return images.find((image) => typeof image === "string" && image.trim()) || fallbackImage;
}

function getWelcomeHeroImage() {
  if (env.welcomeHeroImageUrl) {
    return env.welcomeHeroImageUrl;
  }

  const backendUrl = String(env.backendUrl || "").replace(/\/$/, "");
  if (backendUrl) {
    return `${backendUrl}/assets/hero_card.png`;
  }

  const frontendUrl = String(env.frontendUrl || "").replace(/\/$/, "");
  return frontendUrl
    ? `${frontendUrl}/assets/hero_card.png`
    : "https://placehold.co/720x780/6b6259/ffffff?text=Antariya+Collection";
}

function buildInlineWelcomeHeroAttachment() {
  const heroPath = path.resolve(__dirname, "../assets/hero_card.png");
  if (!fs.existsSync(heroPath)) {
    return null;
  }

  return {
    filename: "hero_card.png",
    content: fs.readFileSync(heroPath),
    contentType: "image/png",
    cid: "welcome-hero-card",
  };
}

async function selectWelcomeProducts(email) {
  try {
    const products = await Product.find({ published: true, stock: { $gt: 0 } })
      .select("name price image images galleryImages")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    if (products.length <= 3) {
      return products;
    }

    let hash = 0;
    for (const character of String(email || "")) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }

    const start = hash % products.length;
    return [0, 1, 2].map((offset) => products[(start + offset) % products.length]);
  } catch (error) {
    console.error("[Mail] Could not load welcome products:", error.message || error);
    return [];
  }
}

async function buildAntariyaWelcomeMessage({ email, displayName }) {
  const appName = env.appName || "Antariya";
  const websiteUrl = env.frontendUrl || "https://antariyaofficial.com";
  const products = await selectWelcomeProducts(email);
  const fallbackImage = env.welcomeHeroImageUrl || welcomeProductImage(products[0], "https://placehold.co/600x630/efe9e1/1a1a1a?text=Antariya");
  const safeName = escapeHtml(displayName || "there");
  const safeAppName = escapeHtml(appName);
  const safeWebsiteUrl = escapeHtml(websiteUrl);
  const safeHeroImage = escapeHtml(fallbackImage);
  const productCards = [0, 1, 2].map((index) => {
    const product = products[index] || {};
    const image = escapeHtml(welcomeProductImage(product, fallbackImage));
    const name = escapeHtml(product.name || "Explore the collection");
    const price = Number(product.price);
    const formattedPrice = Number.isFinite(price) ? `&#8377;${price.toLocaleString("en-IN")}` : "Discover now";
    return `<td class="product-col" width="33.3%" valign="top" style="padding:0 5px;font-family:Arial,Helvetica,sans-serif;text-align:center;"><a href="${safeWebsiteUrl}" style="color:#1a1a1a;text-decoration:none;"><img src="${image}" width="170" alt="${name}" style="display:block;width:100%;height:170px;object-fit:cover;background:#e4ded4;margin-bottom:14px;"/><div style="font-size:12px;font-weight:bold;letter-spacing:.5px;color:#1a1a1a;text-transform:uppercase;margin-bottom:6px;">${name}</div><div style="font-size:13px;color:#333;margin-bottom:10px;">${formattedPrice}</div><span style="font-size:12px;font-weight:bold;border-bottom:1px solid #1a1a1a;">SHOP NOW &rarr;</span></a></td>`;
  }).join("");

  return {
    subject: `Welcome to ${appName} - Your account is ready`,
    text: `Hi ${displayName || "there"},\n\nWelcome to ${appName}. Your account is ready.\n\nExplore the latest collection: ${websiteUrl}\n\nRegards,\n${appName} Team`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Welcome to ${safeAppName}</title><style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none}a{text-decoration:none}@media screen and (max-width:600px){.email-container{width:100%!important}.stack-col{display:block!important;width:100%!important}.hero-img{width:100%!important;height:auto!important}.product-col{display:block!important;width:100%!important;padding:0 0 20px!important}}</style></head><body style="margin:0;padding:0;background:#f4f1ec;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#fff;"><tr><td align="center" style="padding:36px 20px 28px;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:8px;color:#1a1a1a;">${safeAppName.toUpperCase()}</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:4px;color:#6b6b6b;margin-top:6px;">CLOTHING CO.</div></td></tr><tr><td style="background:#efe9e1;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="stack-col" width="52%" valign="middle" style="padding:44px 30px 44px 40px;font-family:Arial,Helvetica,sans-serif;"><div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:30px;color:#a9835c;margin-bottom:6px;">Welcome to</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:40px;letter-spacing:3px;color:#1a1a1a;line-height:1.1;">${safeAppName.toUpperCase()}</div><div style="width:46px;height:2px;background:#1a1a1a;margin:18px 0 20px;"></div><p style="margin:0 0 14px;font-size:15px;font-weight:bold;color:#1a1a1a;line-height:1.5;">Hi ${safeName},</p><p style="margin:0 0 14px;font-size:15px;font-weight:bold;color:#1a1a1a;line-height:1.5;">We're excited to have you with us.</p><p style="margin:0 0 26px;font-size:14px;color:#4d4d4d;line-height:1.6;">Discover thoughtfully designed clothing made to bring effortless style into your everyday wardrobe.</p><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;"><a href="${safeWebsiteUrl}" style="display:block;padding:15px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1.5px;color:#fff;font-weight:bold;">EXPLORE THE COLLECTION</a></td></tr></table></td><td class="stack-col" width="48%" valign="top" style="padding:0;"><img src="${safeHeroImage}" alt="${safeAppName} collection" class="hero-img" width="288" style="display:block;width:100%;height:auto;"/></td></tr></table></td></tr><tr><td style="padding:46px 30px 40px;font-family:Arial,Helvetica,sans-serif;text-align:center;"><div style="font-size:15px;letter-spacing:2px;font-weight:bold;color:#1a1a1a;margin-bottom:30px;">YOUR ACCOUNT IS READY</div><p style="margin:0 auto;color:#4d4d4d;font-size:14px;line-height:1.6;max-width:470px;">Your account is ready to explore collections, save favorites, track orders, and check out faster.</p></td></tr><tr><td style="background:#f7f4ef;padding:44px 30px 40px;font-family:Arial,Helvetica,sans-serif;"><div style="text-align:center;font-size:22px;letter-spacing:1.5px;font-weight:bold;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;padding-bottom:8px;">DISCOVER WHAT'S NEW</div><div style="text-align:center;padding-bottom:30px;font-size:14px;font-weight:bold;color:#1a1a1a;">New season. New energy. New style.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${productCards}</tr></table></td></tr><tr><td style="background:#efe6da;padding:30px;font-family:Arial,Helvetica,sans-serif;text-align:center;"><div style="font-size:12px;font-weight:bold;letter-spacing:.5px;color:#1a1a1a;margin-bottom:4px;">NEED HELP?</div><div style="font-size:12px;color:#4d4d4d;line-height:1.5;">Our support team is here for you at <a href="mailto:support@antariya.com" style="color:#1a1a1a;font-weight:bold;">support@antariya.com</a>.</div></td></tr><tr><td style="background:#1a1a1a;padding:36px 30px 30px;font-family:Arial,Helvetica,sans-serif;text-align:center;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:3px;color:#fff;">${safeAppName.toUpperCase()}</div><div style="font-size:9px;letter-spacing:2px;color:#a8a8a8;margin-top:4px;">CLOTHING CO.</div><div style="border-top:1px solid #3a3a3a;margin-top:22px;padding-top:22px;font-size:11px;color:#8a8a8a;">&copy; 2026 ${safeAppName} Clothing Co. All rights reserved.</div></td></tr></table></td></tr></table></body></html>`,
  };
}

async function buildReferenceWelcomeMessage({ email, displayName }) {
  const appName = env.appName || "Antariya";
  const websiteUrl = env.frontendUrl || "https://antariyaofficial.com";
  const products = await selectWelcomeProducts(email);
  const heroImage = env.welcomeHeroImageUrl || welcomeProductImage(products[0], "https://placehold.co/720x780/6b6259/ffffff?text=Antariya+Collection");
  const safeName = escapeHtml(displayName || "there");
  const safeAppName = escapeHtml(appName);
  const safeWebsiteUrl = escapeHtml(websiteUrl);
  const safeHeroImage = escapeHtml(heroImage);
  const features = [
    ["coat.png", "Explore our", "latest collections"],
    ["like--v1.png", "Save your", "favorite pieces"],
    ["shopping-bag--v1.png", "Track your", "orders"],
    ["user--v1.png", "Manage your", "personal details"],
    ["lock--v1.png", "Faster &amp; secure", "checkout"],
  ].map(([icon, firstLine, secondLine]) => `<td class="icon-cell" width="20%" align="center" valign="top" style="font-family:Arial,Helvetica,sans-serif;text-align:center;padding:0 4px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center" style="width:56px;height:56px;background:#f3ece1;border-radius:50%;" width="56" height="56"><img src="https://img.icons8.com/ios/50/${icon}" width="24" height="24" alt="" style="display:block;margin:16px auto;"/></td></tr></table><div style="font-size:12px;color:#1a1a1a;line-height:1.4;margin-top:10px;">${firstLine}<br/>${secondLine}</div></td>`).join("");
  const productCards = [0, 1, 2].map((index) => {
    const product = products[index] || {};
    const image = escapeHtml(welcomeProductImage(product, heroImage));
    const name = escapeHtml(product.name || "Explore the collection");
    const price = Number(product.price);
    const formattedPrice = Number.isFinite(price) ? `&#8377;${price.toLocaleString("en-IN")}` : "Discover now";
    return `<td class="product-col" width="33.3%" valign="top" style="padding:0 9px;font-family:Arial,Helvetica,sans-serif;text-align:center;"><a href="${safeWebsiteUrl}" style="color:#1a1a1a;text-decoration:none;"><img src="${image}" width="210" alt="${name}" style="display:block;width:100%;height:190px;object-fit:cover;background:#e4ded4;margin-bottom:14px;"/><div style="font-size:12px;font-weight:bold;letter-spacing:.5px;color:#1a1a1a;text-transform:uppercase;margin-bottom:6px;">${name}</div><div style="font-size:13px;color:#333;margin-bottom:10px;">${formattedPrice}</div><span style="font-size:12px;font-weight:bold;border-bottom:1px solid #1a1a1a;">SHOP NOW &rarr;</span></a></td>`;
  }).join("");

  return {
    subject: `Welcome to ${appName} - Your account is ready`,
    text: `Hi ${displayName || "there"},\n\nWelcome to ${appName}. Your account is ready.\n\nExplore the latest collection: ${websiteUrl}\n\nRegards,\n${appName} Team`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Welcome to ${safeAppName}</title><style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none}@media screen and (max-width:720px){.email-container{width:100%!important}.stack-col{display:block!important;width:100%!important}.hero-img{width:100%!important;height:auto!important}.icon-cell{width:33.3%!important;display:inline-block!important;padding-bottom:20px!important}.product-col{display:block!important;width:100%!important;padding:0 0 24px!important}.footer-link{display:block!important;padding:6px 0!important}}</style></head><body style="margin:0;padding:0;background:#f4f1ec;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" class="email-container" width="720" cellpadding="0" cellspacing="0" border="0" style="width:720px;max-width:720px;background:#fff;"><tr><td align="center" style="padding:36px 20px 28px;background:#fff;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;letter-spacing:9px;color:#1a1a1a;font-weight:400;">${safeAppName.toUpperCase()}</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:4px;color:#6b6b6b;margin-top:6px;">CLOTHING CO.</div></td></tr><tr><td style="background:#efe9e1;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="stack-col" width="52%" valign="middle" style="padding:48px 36px 48px 48px;font-family:Arial,Helvetica,sans-serif;"><div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:34px;color:#a9835c;margin-bottom:6px;">Welcome to</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:48px;letter-spacing:4px;color:#1a1a1a;font-weight:400;line-height:1.1;">${safeAppName.toUpperCase()}</div><div style="width:48px;height:2px;background:#1a1a1a;margin:18px 0 20px;"></div><p style="margin:0 0 14px;font-size:16px;font-weight:bold;color:#1a1a1a;line-height:1.5;">Hi ${safeName},</p><p style="margin:0 0 14px;font-size:16px;font-weight:bold;color:#1a1a1a;line-height:1.5;">We're excited to have you with us.</p><p style="margin:0 0 28px;font-size:15px;color:#4d4d4d;line-height:1.6;">Discover thoughtfully designed clothing made to bring effortless style into your everyday wardrobe.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#1a1a1a;"><a href="${safeWebsiteUrl}" style="display:block;padding:16px 30px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:1.5px;color:#fff;font-weight:bold;">EXPLORE THE COLLECTION</a></td></tr></table></td><td class="stack-col" width="48%" valign="top" style="padding:0;"><img src="${safeHeroImage}" alt="${safeAppName} collection" class="hero-img" width="346" style="display:block;width:100%;height:auto;"/></td></tr></table></td></tr><tr><td style="background:#fff;padding:48px 38px 42px;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:34px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #d8cfc2;width:72px;"></td><td style="padding:0 18px;font-size:18px;letter-spacing:2px;font-weight:bold;color:#1a1a1a;white-space:nowrap;">YOUR ACCOUNT IS READY</td><td style="border-top:1px solid #d8cfc2;width:72px;"></td></tr></table></td></tr><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${features}</tr></table></td></tr></table></td></tr><tr><td style="background:#f7f4ef;padding:48px 38px 44px;font-family:Arial,Helvetica,sans-serif;"><div style="text-align:center;padding-bottom:8px;font-size:25px;letter-spacing:1.5px;font-weight:bold;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;">DISCOVER WHAT'S NEW</div><div style="text-align:center;padding-bottom:32px;font-size:15px;font-weight:bold;color:#1a1a1a;">New season. New energy. New style.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${productCards}</tr></table></td></tr><tr><td style="background:#efe6da;padding:30px 42px;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="stack-col" width="50%" valign="middle" style="padding-right:20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="width:48px;height:48px;background:#fff;border-radius:50%;" width="48" height="48"><img src="https://img.icons8.com/ios/50/headset.png" width="23" height="23" alt="Support" style="display:block;margin:13px auto;"/></td></tr></table></td><td valign="middle"><div style="font-size:12px;font-weight:bold;letter-spacing:.5px;color:#1a1a1a;margin-bottom:4px;">NEED HELP?</div><div style="font-size:12px;color:#4d4d4d;line-height:1.5;">Our support team is always<br/>here for you.</div></td></tr></table></td><td class="stack-col" width="50%" valign="middle" style="border-left:1px solid #d8cfc2;padding-left:32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="width:48px;height:48px;background:#fff;border-radius:50%;" width="48" height="48"><img src="https://img.icons8.com/ios/50/new-post.png" width="23" height="23" alt="Email" style="display:block;margin:13px auto;"/></td></tr></table></td><td valign="middle"><div style="font-size:12px;color:#4d4d4d;margin-bottom:4px;">Email us at</div><a href="mailto:support@antariya.com" style="font-size:12px;font-weight:bold;color:#1a1a1a;">support@antariya.com</a></td></tr></table></td></tr></table></td></tr><tr><td style="background:#1a1a1a;padding:38px 42px 30px;font-family:Arial,Helvetica,sans-serif;color:#fff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="stack-col" width="35%" valign="top" style="padding-bottom:20px;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#fff;">${safeAppName.toUpperCase()}</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#a8a8a8;margin-top:4px;">CLOTHING CO.</div></td><td class="stack-col" width="65%" valign="top" align="right" style="padding-bottom:20px;"><a class="footer-link" href="${safeWebsiteUrl}" style="font-size:12px;color:#fff;letter-spacing:.5px;margin-left:24px;">SHOP</a><a class="footer-link" href="${safeWebsiteUrl}" style="font-size:12px;color:#fff;letter-spacing:.5px;margin-left:24px;">COLLECTIONS</a><a class="footer-link" href="${safeWebsiteUrl}" style="font-size:12px;color:#fff;letter-spacing:.5px;margin-left:24px;">ABOUT US</a><a class="footer-link" href="mailto:support@antariya.com" style="font-size:12px;color:#fff;letter-spacing:.5px;margin-left:24px;">CONTACT</a></td></tr><tr><td colspan="2" style="border-top:1px solid #3a3a3a;padding-top:22px;" align="center"><div style="font-size:11px;letter-spacing:2px;color:#a8a8a8;margin-bottom:14px;">FOLLOW US</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="padding:0 8px;"><a href="${safeWebsiteUrl}"><img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png" width="18" height="18" alt="Instagram"/></a></td><td style="padding:0 8px;"><a href="${safeWebsiteUrl}"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" width="18" height="18" alt="Facebook"/></a></td><td style="padding:0 8px;"><a href="${safeWebsiteUrl}"><img src="https://img.icons8.com/ios-filled/50/ffffff/pinterest.png" width="18" height="18" alt="Pinterest"/></a></td></tr></table><div style="font-size:11px;color:#8a8a8a;margin-top:22px;">&copy; 2026 ${safeAppName} Clothing Co. All rights reserved.</div></td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>`,
  };
}

async function buildStyledWelcomeMessage({ email, displayName }) {
  const message = await buildReferenceWelcomeMessage({ email, displayName });
  const heroImage = escapeHtml(getWelcomeHeroImage());
  const inlineHeroAttachment = buildInlineWelcomeHeroAttachment();
  const heroImageSrc = inlineHeroAttachment ? "cid:welcome-hero-card" : heroImage;

  message.html = message.html
    .replace(
      /class="email-container" width="720" cellpadding="0" cellspacing="0" border="0" style="width:720px;max-width:720px;background:#fff;"/,
      'class="email-container" width="820" cellpadding="0" cellspacing="0" border="0" style="width:820px;max-width:820px;background:#fff;"'
    )
    .replace(
      /<td class="stack-col" width="52%" valign="middle" style="padding:48px 36px 48px 48px;font-family:Arial,Helvetica,sans-serif;">/,
      '<td class="stack-col" width="45%" valign="middle" style="padding:44px 30px 44px 42px;font-family:Arial,Helvetica,sans-serif;">'
    )
    .replace(
      /<td class="stack-col" width="(?:48|50)%" valign="top" style="padding:0;"><img src="[^"]+" alt="[^"]+" class="hero-img" width="\d+" style="display:block;width:100%;height:auto;"\/><\/td>/,
      `<td class="stack-col" width="55%" valign="top" style="padding:0;"><img src="${heroImageSrc}" alt="${escapeHtml(
        env.appName || "Antariya"
      )} collection" class="hero-img" width="451" style="display:block;width:100%;height:460px;object-fit:cover;object-position:center top;"/></td>`
    )
    .replace(
      /<img src="https:\/\/img\.icons8\.com\/ios\/50\/(headset|new-post)\.png" width="23" height="23" alt="(Support|Email)" style="display:block;margin:13px auto;"\/>/g,
      '<img src="https://img.icons8.com/ios/ffffff/$1.png" width="23" height="23" alt="$2" style="display:block;margin:13px auto;"/>'
    )
    .replace(/background:#fff;border-radius:50%;/g, 'background:#1a1a1a;border-radius:50%;')
    .replace(/width="48" height="48"><img src="https:\/\/img\.icons8\.com\/ios\/ffffff\/(headset|new-post)\.png"/g, 'width="48" height="48" style="background:#1a1a1a;border-radius:50%;"><img src="https://img.icons8.com/ios/ffffff/$1.png"')
    .replace(/style="background:#1a1a1a;padding:38px 42px 30px;/, 'style="background:#111;padding:34px 42px 28px;')
    .replace(/font-size:22px;letter-spacing:3px;color:#fff;/, 'font-size:22px;letter-spacing:4px;color:#fff;')
    .replace(/font-size:11px;letter-spacing:2px;color:#a8a8a8;margin-bottom:14px;/, 'font-size:12px;letter-spacing:2px;color:#fff;margin-bottom:14px;')
    .replace(
      /<tr><td class="stack-col" width="35%"[\s\S]*?<tr><td colspan="2" style="border-top:1px solid #3a3a3a;padding-top:22px;" align="center">/,
      '<tr><td colspan="2" align="center" style="padding:0 0 12px;">'
    )
    .replace(
      /<div style="font-size:12px;letter-spacing:2px;color:#fff;margin-bottom:14px;">FOLLOW US<\/div>/,
      '<span style="display:inline-block;font-size:12px;letter-spacing:2px;color:#fff;margin:0 22px 0 0;vertical-align:middle;">FOLLOW US</span>'
    )
    .replace(
      /<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="padding:0 8px;">/,
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="display:inline-block;vertical-align:middle;"><tr><td style="padding:0 8px;">'
    )
    .replace(/ios-filled\/50\/ffffff\/instagram-new\.png/g, 'ios/ffffff/instagram-new.png')
    .replace(/width="18" height="18" alt="(Instagram|Facebook|Pinterest)"/g, 'width="26" height="26" alt="$1"')
    .replace(
      /<div style="font-size:11px;color:#8a8a8a;margin-top:22px;">&copy; 2026 \${safeAppName} Clothing Co\. All rights reserved\.<\/div>/,
      '<div style="font-size:14px;color:#fff;margin-top:20px;">&copy; 2026 ${safeAppName} Clothing Co. All rights reserved.</div>'
    )
    .replace(
      /<td style="background:#fff;padding:48px 38px 42px;font-family:Arial,Helvetica,sans-serif;">/,
      '<td style="background:#fff;padding:34px 38px 46px;font-family:Arial,Helvetica,sans-serif;">'
    )
    .replace(/border-top:1px solid #d8cfc2;width:72px;/g, 'border-top:1px solid #d8cfc2;width:120px;')
    .replace(
      /padding:0 18px;font-size:18px;letter-spacing:2px;font-weight:bold;color:#1a1a1a;white-space:nowrap;/,
      'padding:0 22px;font-size:19px;letter-spacing:2px;font-weight:bold;color:#1a1a1a;white-space:nowrap;'
    )
    .replace(/width="210" alt=/g, 'width="220" alt=')
    .replace(/height:190px;object-fit:cover/g, 'height:220px;object-fit:cover');

  if (inlineHeroAttachment) {
    message.attachments = [...(message.attachments || []), inlineHeroAttachment];
  }

  return message;
}

async function sendWelcomeEmail({ to, displayName }) {
  const message = await buildStyledWelcomeMessage({ email: to, displayName });
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
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${safeAppName} VIP Waitlist</title></head><body style="margin:0;padding:0;background:#faf8f5;font-family:'Georgia','Times New Roman',serif;color:#1a1a2e;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:20px 0;"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);"><tr><td style="background:#0d1b3e;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9a96e;border-radius:4px;"><tr><td align="center" style="padding:32px 28px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:72px;height:72px;border:2px solid #c9a96e;border-radius:50%;"><span style="font-size:32px;font-weight:700;color:#c9a96e;font-family:'Georgia',serif;line-height:68px;">A</span></td></tr></table><h1 style="margin:14px 0 0;font-size:28px;letter-spacing:0.18em;color:#ffffff;font-weight:400;font-family:'Georgia','Times New Roman',serif;text-transform:uppercase;">ANTARIYA</h1><p style="margin:8px 0 0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#c9a96e;font-weight:400;">Premium Embroidery. Personalized For You.</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:40px 28px 10px;background:#ffffff;"><h2 style="margin:0;font-size:30px;font-weight:400;color:#0d1b3e;font-family:'Georgia','Times New Roman',serif;line-height:1.2;">You're on the VIP Waitlist!</h2><table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr><td style="width:40px;height:1px;background:#c9a96e;"></td><td style="padding:0 10px;"><span style="font-size:14px;color:#c9a96e;">&#10022;&#10022;&#10022;</span></td><td style="width:40px;height:1px;background:#c9a96e;"></td></tr></table></td></tr><tr><td style="padding:20px 36px 12px;background:#ffffff;"><p style="margin:0;font-size:16px;line-height:1.7;color:#2d2d44;">Hi <strong>${safeName}</strong>,</p><p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#4a4a5a;">Thanks for joining our VIP waitlist. We have secured your spot and will notify you first when launch access opens.</p></td></tr><tr><td style="padding:16px 36px 8px;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:12px;background:#fdfcfa;"><tr><td style="padding:20px 24px;"><p style="margin:0;font-size:15px;font-weight:700;color:#0d1b3e;">&#127775; What you'll get:</p><p style="margin:10px 0 4px;font-size:14px;line-height:1.7;color:#4a4a5a;">&#8226; Early access to our premium embroidery collection</p><p style="margin:0 0 4px;font-size:14px;line-height:1.7;color:#4a4a5a;">&#8226; Exclusive launch-day discounts</p><p style="margin:0;font-size:14px;line-height:1.7;color:#4a4a5a;">&#8226; Priority notifications before anyone else</p></td></tr></table></td></tr><tr><td align="center" style="padding:28px 36px 12px;background:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0d1b3e;border:1px solid #c9a96e;border-radius:8px;padding:0;"><a href="${safeWebsiteUrl}" target="_blank" style="display:inline-block;padding:15px 40px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c9a96e;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">&#9734; &nbsp;VISIT ${safeAppName.toUpperCase()}</a></td></tr></table></td></tr><tr><td style="padding:20px 36px 28px;background:#ffffff;"><p style="margin:0;font-size:13px;line-height:1.6;color:#5a5a6a;">This email confirms your VIP waitlist registration. We'll be in touch soon!</p></td></tr><tr><td style="background:#0d1b3e;padding:16px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><p style="margin:0;font-size:12px;color:#c9a96e;letter-spacing:0.05em;font-family:Arial,sans-serif;">PREMIUM QUALITY &nbsp;&#8226;&nbsp; EXPERT CRAFTSMANSHIP &nbsp;&#8226;&nbsp; SECURE SHOPPING</p></td></tr></table></td></tr><tr><td align="center" style="background:#faf8f5;padding:20px 36px;"><p style="margin:0;font-size:12px;color:#9a9a9a;font-family:Arial,sans-serif;">&copy; ${new Date().getFullYear()} ${safeAppName}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`,
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
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:0;background:#faf8f5;font-family:'Georgia','Times New Roman',serif;color:#1a1a2e;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:20px 0;"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);"><tr><td style="background:#0d1b3e;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9a96e;border-radius:4px;"><tr><td align="center" style="padding:28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:60px;height:60px;border:2px solid #c9a96e;border-radius:50%;"><span style="font-size:26px;font-weight:700;color:#c9a96e;font-family:'Georgia',serif;line-height:56px;">A</span></td></tr></table><h1 style="margin:10px 0 0;font-size:24px;letter-spacing:0.18em;color:#ffffff;font-weight:400;font-family:'Georgia','Times New Roman',serif;text-transform:uppercase;">ANTARIYA</h1><p style="margin:6px 0 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#c9a96e;">Order Confirmed &#10003;</p></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:36px 28px 10px;background:#ffffff;"><h2 style="margin:0;font-size:28px;font-weight:400;color:#0d1b3e;font-family:'Georgia','Times New Roman',serif;">Thank you for your order!</h2><p style="margin:8px 0 0;font-size:14px;color:#c9a96e;letter-spacing:0.05em;">Invoice INV-${shortId}</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px auto 0;"><tr><td style="width:40px;height:1px;background:#c9a96e;"></td><td style="padding:0 10px;"><span style="font-size:14px;color:#c9a96e;">&#10022;&#10022;&#10022;</span></td><td style="width:40px;height:1px;background:#c9a96e;"></td></tr></table></td></tr><tr><td style="padding:20px 36px 12px;background:#ffffff;"><p style="margin:0;font-size:16px;line-height:1.7;color:#2d2d44;">Hi <strong>${safeName}</strong>,</p><p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#4a4a5a;">Thank you for shopping with ${safeAppName}. Your order is confirmed and is now being processed. Your detailed invoice is attached to this email as a PDF.</p></td></tr><tr><td style="padding:16px 36px 8px;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:12px;background:#fdfcfa;"><tr><td style="padding:20px 24px;text-align:center;"><p style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#5a5a6a;">Order Total</p><p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0d1b3e;font-family:'Georgia',serif;">&#8377; ${total}</p></td></tr></table></td></tr><tr><td align="center" style="padding:28px 36px 12px;background:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0d1b3e;border:1px solid #c9a96e;border-radius:8px;padding:0;"><a href="${escapeHtml(websiteUrl)}/portal/customer" target="_blank" style="display:inline-block;padding:15px 40px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c9a96e;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">&#9734; &nbsp;VIEW MY ORDERS</a></td></tr></table></td></tr><tr><td style="padding:16px 36px 28px;background:#ffffff;"><p style="margin:0;font-size:14px;line-height:1.6;color:#5a5a6a;font-style:italic;text-align:center;">Every Stitch Tells a Story.</p></td></tr><tr><td style="background:#0d1b3e;padding:16px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><p style="margin:0;font-size:12px;color:#c9a96e;letter-spacing:0.05em;font-family:Arial,sans-serif;">PREMIUM QUALITY &nbsp;&#8226;&nbsp; EXPERT CRAFTSMANSHIP &nbsp;&#8226;&nbsp; FAST DELIVERY</p></td></tr></table></td></tr><tr><td align="center" style="background:#faf8f5;padding:20px 36px;"><p style="margin:0;font-size:12px;color:#9a9a9a;font-family:Arial,sans-serif;">&copy; ${new Date().getFullYear()} ${safeAppName}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`,
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
    <body style="margin:0;padding:0;background:#faf8f5;font-family:Georgia,'Times New Roman',serif;color:#1a1a2e;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:24px 0;">
        <tr><td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:94%;background:#ffffff;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);">
            <!-- Header: Dark navy with gold accents -->
            <tr><td style="background:#0d1b3e;padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9a96e;border-radius:4px;">
                    <tr><td align="center" style="padding:28px 24px;">
                      <img src="https://res.cloudinary.com/doefhzx01/image/upload/v1775491590/Antariya-icon__1_-removebg-preview_z1vqp1.png" alt="Antariya" width="52" height="52" style="display:block;width:52px;height:52px;border-radius:50%;border:2px solid #c9a96e;" />
                      <h1 style="margin:10px 0 0;font-size:22px;letter-spacing:0.15em;color:#ffffff;font-weight:400;font-family:Georgia,'Times New Roman',serif;text-transform:uppercase;">ANTARIYA</h1>
                      <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#c9a96e;font-weight:400;">Premium Embroidery · Personalized For You</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>
            <!-- Title bar -->
            <tr><td align="center" style="padding:28px 28px 0;background:#ffffff;">
              <h2 style="margin:0;font-size:22px;font-weight:400;color:#0d1b3e;font-family:Georgia,'Times New Roman',serif;">${safeTitle}</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 0;">
                <tr>
                  <td style="width:30px;height:1px;background:#c9a96e;"></td>
                  <td style="padding:0 8px;"><span style="font-size:12px;color:#c9a96e;">✦</span></td>
                  <td style="width:30px;height:1px;background:#c9a96e;"></td>
                </tr>
              </table>
            </td></tr>
            <!-- Body content -->
            <tr><td style="padding:24px 32px 28px;background:#ffffff;font-size:15px;line-height:1.7;color:#2d2d44;">${bodyHtml}</td></tr>
            <!-- Footer -->
            <tr><td style="background:#0d1b3e;padding:20px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="center">
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#a8a8b8;">Visit us at <a href="${safeWebsiteUrl}" style="color:#c9a96e;text-decoration:none;">${safeWebsiteUrl}</a></p>
                </td></tr>
              </table>
              ${unsubscribeBlock}
              <p style="margin:10px 0 0;font-size:11px;line-height:1.6;color:#6b6b7b;text-align:center;">© ${new Date().getFullYear()} ${safeAppName}. All rights reserved.</p>
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
  const html = wrapBrandedEmail({
    title: "Password Reset Request",
    bodyHtml: `
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
    `
  });

  return sendMail({ to, subject, html });
}

/**
 * Send an order notification email to all superadmin/admin users so they
 * are immediately aware of new purchases (online or POS).
 */
async function sendAdminOrderNotificationEmail({ order, customerEmail, customerName, source }) {
  if (!hasMailConfig()) {
    return { sent: false, skipped: true, reason: "Mail not configured" };
  }

  const adminEmails = Array.isArray(env.superAdminAllowedEmails) ? env.superAdminAllowedEmails : [];
  if (adminEmails.length === 0) {
    return { sent: false, skipped: true, reason: "No admin emails configured" };
  }

  const shortId = order.id ? order.id.slice(-8).toUpperCase() : "N/A";
  const sourceLabel = source ? ` [${source}]` : "";
  const subject = `🛒 New Order Received${sourceLabel} - INV-${shortId}`;

  const formatINR = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "N/A";
  const orderNo = (order.id || "N/A").slice(-8).toUpperCase();
  const statusText = order.status || (order.paymentStatus === "paid" ? "Confirmed" : "Pending");
  const couponCode = order.coupon?.code ? escapeHtml(order.coupon.code) : "";
  const itemRows = (order.items || [])
    .map((item) => {
      const baseName = escapeHtml(item.name || "Product");
      const sku = item.variantSku ? ` <span style="color:#7A7460;font-size:12px;">(${escapeHtml(item.variantSku)})</span>` : "";
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return `
        <tr>
          <td style="padding:12px 0 12px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="top" style="font-family:'Cormorant Garamond', Georgia, serif; font-size:22px; color:#1E1B17; font-weight:600; line-height:26px;">
                  ${baseName}${sku}
                </td>
                <td width="90" valign="top" align="right" style="font-family:'Inter', Arial, sans-serif; font-size:15px; color:#1E1B17; font-weight:600; white-space:nowrap;">
                  ${formatINR(price * qty)}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="font-family:'Inter', Arial, sans-serif; font-size:13px; color:#7A7460; line-height:20px; padding-top:4px;">
                  ${escapeHtml(item.category || "Premium product")} &nbsp;·&nbsp; ${escapeHtml(item.fabric || "Premium fabric")} &nbsp;·&nbsp; ${escapeHtml(item.description || "Everyday essentials")}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="font-family:'Inter', Arial, sans-serif; font-size:11px; color:#A39C84; letter-spacing:0.5px; padding-top:6px;">
                  ${item.variantSku ? `SKU ${escapeHtml(item.variantSku)} &nbsp;·&nbsp;` : ""} QTY ${qty}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join("");

  const discountRow = Number(order.discount) > 0
    ? `<tr>
        <td style="padding:6px 0; color:#6E2A2A;">Discount${couponCode ? ` <span style="color:#A39C84;">(${couponCode})</span>` : ""}</td>
        <td align="right" style="padding:6px 0; color:#6E2A2A; font-weight:600;">−${formatINR(order.discount)}</td>
      </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>New Order — Antariya</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap');
      body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #E9E4D8; }
      @media screen and (max-width: 600px) {
        .email-container { width: 100% !important; }
        .fluid-pad { padding-left: 24px !important; padding-right: 24px !important; }
        .stack { display: block !important; width: 100% !important; text-align: left !important; padding-bottom: 10px !important; }
        .masthead-cell { display:block !important; width:100% !important; border-right: none !important; border-bottom: 1px solid #C9C0AA !important; padding: 14px 0 !important; text-align:left !important; }
        .masthead-cell:last-child { border-bottom: none !important; }
        .h1 { font-size: 30px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#E9E4D8;">
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
      Order No. ${escapeHtml(orderNo)} — Antariya ${escapeHtml((order.items || [])[0]?.name || "Order")} — ${formatINR(order.total)}&nbsp;&nbsp;&nbsp;&nbsp;
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#E9E4D8;">
      <tr>
        <td align="center" style="padding: 44px 16px;">
          <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:#FAF7F0;">
            <tr>
              <td align="center" style="padding: 44px 40px 0 40px;" class="fluid-pad">
                <div style="font-family:'Inter', Arial, sans-serif; font-size:11px; letter-spacing:4px; color:#5C6E5A; text-transform:uppercase;">The Order Journal</div>
                <div style="font-family:'Cormorant Garamond', Georgia, serif; font-weight:600; font-size:44px; color:#1E1B17; padding-top:10px; letter-spacing:0.5px;" class="h1">Antariya</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 22px 40px 0 40px;" class="fluid-pad">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="border-top:3px solid #1E1B17; font-size:0; line-height:0;">&nbsp;</td></tr>
                  <tr><td style="border-top:1px solid #1E1B17; font-size:0; line-height:1px; padding-top:3px;">&nbsp;</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 14px 40px 0 40px;" class="fluid-pad">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="masthead-cell" width="34%" style="border-right:1px solid #C9C0AA; padding: 4px 16px 4px 0; font-family:'Inter', Arial, sans-serif;">
                      <div style="font-size:9.5px; letter-spacing:1.5px; color:#8C8368; text-transform:uppercase;">Order No.</div>
                      <div style="font-size:14px; color:#1E1B17; font-weight:600; padding-top:3px;">${escapeHtml(orderNo)}</div>
                    </td>
                    <td class="masthead-cell" width="33%" style="border-right:1px solid #C9C0AA; padding: 4px 16px; font-family:'Inter', Arial, sans-serif;">
                      <div style="font-size:9.5px; letter-spacing:1.5px; color:#8C8368; text-transform:uppercase;">Dated</div>
                      <div style="font-size:14px; color:#1E1B17; font-weight:600; padding-top:3px;">${escapeHtml(orderDate)}</div>
                    </td>
                    <td class="masthead-cell" width="33%" align="right" style="padding: 4px 0 4px 16px; font-family:'Inter', Arial, sans-serif;">
                      <div style="font-size:9.5px; letter-spacing:1.5px; color:#8C8368; text-transform:uppercase;">Status</div>
                      <div style="font-size:14px; color:#3F6B47; font-weight:600; padding-top:3px;">${escapeHtml(statusText)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 26px 40px 0 40px; font-family:'Cormorant Garamond', Georgia, serif; font-style:italic; font-size:19px; line-height:28px; color:#3A362F;" class="fluid-pad">
                An order was placed by <strong style="font-style:normal;">${escapeHtml(customerName || "Customer")}</strong> and has been received for fulfilment.
              </td>
            </tr>
            <tr>
              <td style="padding: 30px 40px 0 40px;" class="fluid-pad">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1E1B17;">
                  <tr>
                    <td colspan="3" style="padding-top:10px; font-family:'Inter', Arial, sans-serif; font-size:9.5px; letter-spacing:1.5px; color:#8C8368; text-transform:uppercase;">
                      Item on order
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #C9C0AA; padding-bottom:18px;">
                  <tr>
                    <td style="padding: 12px 0 20px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        ${itemRows}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 22px 40px 0 40px;" class="fluid-pad">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'Inter', Arial, sans-serif; font-size:14px;">
                  <tr>
                    <td style="padding:6px 0; color:#7A7460;">Subtotal</td>
                    <td align="right" style="padding:6px 0; color:#1E1B17;">${formatINR(order.subtotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0; color:#7A7460;">Shipping</td>
                    <td align="right" style="padding:6px 0; color:#1E1B17;">${Number(order.shipping) > 0 ? formatINR(order.shipping) : "Free"}</td>
                  </tr>
                  ${discountRow}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 40px 0 40px;" class="fluid-pad">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:3px solid #1E1B17;">
                  <tr>
                    <td style="padding: 18px 0 26px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td valign="bottom" style="font-family:'Inter', Arial, sans-serif; font-size:11px; letter-spacing:2px; color:#8C8368; text-transform:uppercase;">Total due</td>
                          <td align="right" valign="bottom" style="font-family:'Cormorant Garamond', Georgia, serif; font-size:38px; font-weight:600; color:#1E1B17;">${formatINR(order.total)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 40px 0 40px;" class="fluid-pad">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #C9C0AA;">
                  <tr>
                    <td style="padding: 18px 22px;" class="fluid-pad">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'Inter', Arial, sans-serif; font-size:12.5px; line-height:22px;">
                        <tr>
                          <td class="stack" width="50%" style="color:#8C8368; vertical-align:top;">Order ID</td>
                          <td class="stack" width="50%" align="right" style="color:#1E1B17; vertical-align:top;">${escapeHtml(order.id || "N/A")}</td>
                        </tr>
                        <tr>
                          <td class="stack" width="50%" style="color:#8C8368; vertical-align:top;">Payment</td>
                          <td class="stack" width="50%" align="right" style="color:#1E1B17; vertical-align:top;">
                            ${(order.paymentMethod === "upi" ? "Online (UPI/Card/NetBanking)" : order.paymentMethod || "Online (UPI/Card/NetBanking)")}&nbsp;
                            <span style="color:#3F6B47; font-weight:600;">&#10003; Paid</span>
                          </td>
                        </tr>
                        <tr>
                          <td class="stack" width="50%" style="color:#8C8368; vertical-align:top;">Razorpay ID</td>
                          <td class="stack" width="50%" align="right" style="color:#1E1B17; vertical-align:top;">${escapeHtml(order.razorpayPaymentId || "—")}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 32px 40px 44px 40px;" class="fluid-pad">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#1E1B17;">
                      <a href="${escapeHtml(env.frontendUrl || "https://antariyaofficial.com")}" style="display:inline-block; padding:15px 38px; font-family:'Inter', Arial, sans-serif; font-size:12.5px; letter-spacing:2px; text-transform:uppercase; color:#FAF7F0; text-decoration:none;">View Order</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="background-color:#1E3A2B; padding: 26px 40px;" class="fluid-pad">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="font-family:'Inter', Arial, sans-serif; font-size:12px; color:#CBD9CE; padding-bottom:8px;">
                      Visit us at <a href="https://antariyaofficial.com" style="color:#FAF7F0; text-decoration:underline;">antariyaofficial.com</a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-family:'Inter', Arial, sans-serif; font-size:11px; color:#8FA694;">
                      © 2026 Antariya. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const results = [];
  for (const adminEmail of adminEmails) {
    try {
      const result = await sendMail({ to: adminEmail, subject, html });
      results.push(result);
    } catch (err) {
      console.error(`[Mail] Failed to notify admin ${adminEmail}:`, err.message);
      results.push({ sent: false, error: err.message });
    }
  }

  return results;
}

async function sendAdminCancellationEmail({ order, customerEmail, customerName, reason }) {
  if (!hasMailConfig()) {
    return { sent: false, skipped: true, reason: "Mail not configured" };
  }

  const adminEmails = Array.isArray(env.superAdminAllowedEmails) ? env.superAdminAllowedEmails : [];
  if (adminEmails.length === 0) {
    return { sent: false, skipped: true, reason: "No admin emails configured" };
  }

  const shortId = order.id ? order.id.slice(-8).toUpperCase() : "N/A";
  const subject = `❌ Order Cancelled - INV-${shortId}`;

  const formatINR = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemRows = (order.items || [])
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${escapeHtml(item.name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;">${formatINR(item.price * item.quantity)}</td>
        </tr>`
    )
    .join("");

  const reasonSection = reason
    ? `<p style="margin:12px 0;font-size:14px;color:#6b7280;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
    : "";

  const bodyHtml = `
    <div style="margin-bottom:16px;">
      <p style="font-size:16px;font-weight:600;color:#dc2626;margin:0 0 8px;">⚠️ Order Cancellation Notice</p>
      <p style="font-size:14px;color:#374151;margin:0;">A customer has cancelled their order.</p>
    </div>
    <table style="width:100%;margin:12px 0;font-size:14px;color:#374151;">
      <tr><td style="padding:4px 0;font-weight:600;">Customer:</td><td>${escapeHtml(customerName || "N/A")}</td></tr>
      <tr><td style="padding:4px 0;font-weight:600;">Email:</td><td>${escapeHtml(customerEmail || "N/A")}</td></tr>
      <tr><td style="padding:4px 0;font-weight:600;">Order ID:</td><td style="font-family:monospace;">${escapeHtml(order.id || "N/A")}</td></tr>
      <tr><td style="padding:4px 0;font-weight:600;">Order Total:</td><td style="font-weight:700;">${formatINR(order.total)}</td></tr>
      <tr><td style="padding:4px 0;font-weight:600;">Payment Method:</td><td>${escapeHtml(order.paymentMethod === "upi" ? "Online (UPI/Card/NetBanking)" : order.paymentMethod || "N/A")}</td></tr>
    </table>
    ${reasonSection}
    <p style="font-size:13px;font-weight:600;color:#6b7280;margin:16px 0 8px;">CANCELLED ITEMS:</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#fef2f2;">
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#991b1b;">Item</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;color:#991b1b;">Qty</th>
        <th style="padding:8px 12px;text-align:right;font-size:13px;color:#991b1b;">Amount</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Inventory has been automatically released back to available stock.</p>
  `;

  const html = wrapBrandedEmail({ title: "Order Cancelled", bodyHtml });

  const results = [];
  for (const adminEmail of adminEmails) {
    try {
      await sendMail({ to: adminEmail, subject, html });
      results.push({ sent: true, to: adminEmail });
    } catch (err) {
      results.push({ sent: false, to: adminEmail, error: err.message });
    }
  }

  return results;
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
  sendAdminOrderNotificationEmail,
  sendAdminCancellationEmail,
};
