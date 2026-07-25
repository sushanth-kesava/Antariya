/**
 * Mail Utilities - High-level email helpers
 * Wraps mail.service.js and mail.queue.js with common use cases
 */

const mailService = require("./mail.service");
const { enqueue } = require("./mail.queue");
const env = require("../config/env");
const { wrapBrandedEmail } = mailService;

/**
 * Send email with queue fallback
 * Supports: plain text, HTML, attachments
 */
async function send({ to, subject, html, text, attachments = [] }) {
  if (!to || !subject) {
    throw new Error("email: to and subject are required");
  }

  const plainText = text || (html ? stripHtml(html) : "");

  try {
    const result = await mailService.sendMail({
      to,
      subject,
      html,
      text: plainText,
      attachments,
    });

    return result;
  } catch (error) {
    console.error("[Mail] Error sending email to", to, error.message);
    throw error;
  }
}

/**
 * Queue email for later delivery (with retry)
 */
function queue({ to, subject, html, text, type = "transactional", metadata = {} }) {
  if (!to || !subject) {
    throw new Error("queue: to and subject are required");
  }

  const plainText = text || (html ? stripHtml(html) : "");

  enqueue(mailService.sendMail, {
    type,
    payload: {
      to,
      subject,
      html,
      text: plainText,
    },
    metadata: {
      ...metadata,
      queuedAt: new Date().toISOString(),
    },
  });
}

/**
 * Send welcome email to new user
 */
async function sendWelcome({ email, displayName }) {
  const { subject, text, html } = mailService.buildWelcomeMessage(displayName);

  return queue({
    to: email,
    subject,
    html,
    text,
    type: "welcome",
    metadata: { userId: email },
  });
}

/**
 * Send order confirmation email
 */
async function sendOrderConfirmation({ email, orderId, orderNumber, items, total }) {
  const subject = `Order Confirmed - ${orderNumber}`;
  const html = wrapBrandedEmail({ title: `Order Confirmed - ${orderNumber}`, bodyHtml: buildOrderConfirmationHtml({
    orderId,
    orderNumber,
    items,
    total,
  }) });
  const text = buildOrderConfirmationText({ orderNumber, items, total });

  return queue({
    to: email,
    subject,
    html,
    text,
    type: "order_confirmation",
    metadata: { orderId, orderNumber },
  });
}

/**
 * Send payment receipt with invoice PDF
 */
async function sendPaymentReceipt({ email, orderId, invoicePath, total, paymentMethod }) {
  const subject = `Payment Receipt - Order #${orderId}`;
  const html = wrapBrandedEmail({ title: `Payment Receipt`, bodyHtml: buildPaymentReceiptHtml({ orderId, total, paymentMethod }) });
  const text = `Payment received for order #${orderId}. Total: Rs${total}`;

  const attachments = invoicePath
    ? [
        {
          filename: `invoice-${orderId}.pdf`,
          path: invoicePath,
        },
      ]
    : [];

  return queue({
    to: email,
    subject,
    html,
    text,
    type: "payment_receipt",
    metadata: { orderId, paymentMethod },
  });
}

/**
 * Send shipping notification
 */
async function sendShippingNotification({ email, orderId, trackingNumber, carrier, estimatedDelivery }) {
  const subject = `Your order is on the way - #${orderId}`;
  const html = wrapBrandedEmail({ title: `Your Order is on the Way!`, bodyHtml: buildShippingNotificationHtml({
    orderId,
    trackingNumber,
    carrier,
    estimatedDelivery,
  }) });
  const text = `Order #${orderId} shipped via ${carrier}. Tracking: ${trackingNumber}`;

  return queue({
    to: email,
    subject,
    html,
    text,
    type: "shipping_notification",
    metadata: { orderId, trackingNumber, carrier },
  });
}

/**
 * Send newsletter
 */
async function sendNewsletter({ email, campaignId, title, content, unsubscribeUrl }) {
  const subject = title;
  const html = wrapBrandedEmail({ title, bodyHtml: buildNewsletterHtml({ content, unsubscribeUrl }), unsubscribeUrl });
  const text = `${title}\n\n${stripHtml(content)}`;

  return queue({
    to: email,
    subject,
    html,
    text,
    type: "newsletter",
    metadata: { campaignId },
  });
}

/**
 * Send password reset email
 */
async function sendPasswordReset({ email, resetUrl, userName }) {
  const appName = env.appName || "Antariya";
  const subject = `Reset your ${appName} password`;
  const html = wrapBrandedEmail({ title: `Reset Your Password`, bodyHtml: buildPasswordResetHtml({ userName, resetUrl, appName }) });
  const text = `Hi ${userName},\nClick to reset: ${resetUrl}\nValid for 24 hours.`;

  return queue({
    to: email,
    subject,
    html,
    text,
    type: "password_reset",
    metadata: { action: "password_reset" },
  });
}

/**
 * Send admin notification
 */
async function sendAdminNotification({ subject, html, text, metadata = {} }) {
  const adminEmail = env.adminAllowedEmails?.[0] || env.mailFromEmail;

  if (!adminEmail) {
    console.warn("[Mail] Admin email not configured, skipping notification");
    return;
  }

  return queue({
    to: adminEmail,
    subject: `[ADMIN] ${subject}`,
    html,
    text,
    type: "admin_notification",
    metadata,
  });
}

// --- HTML Builders ---

function buildOrderConfirmationHtml({ orderId, orderNumber, items, total }) {
  const itemsHtml = items
    .map(
      (item) => `<tr style="border-bottom:1px solid #e8e4de;">
      <td style="padding:10px 8px;font-size:14px;">${item.productName}</td>
      <td style="padding:10px 8px;font-size:14px;text-align:center;">${item.quantity}x</td>
      <td style="padding:10px 8px;font-size:14px;text-align:right;">₹${item.price}</td>
      <td style="padding:10px 8px;font-size:14px;text-align:right;font-weight:600;">₹${item.quantity * item.price}</td>
    </tr>`
    )
    .join("");

  return `
    <p style="font-size:15px;line-height:1.7;color:#2d2d44;">Thank you for your order! Here's your confirmation:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e8e4de;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#0d1b3e;">
          <th style="padding:12px 8px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;text-align:left;">Product</th>
          <th style="padding:12px 8px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;text-align:center;">Qty</th>
          <th style="padding:12px 8px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;text-align:right;">Price</th>
          <th style="padding:12px 8px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#c9a96e;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p style="font-size:18px;font-weight:600;color:#0d1b3e;margin:16px 0;">Total: ₹${total}</p>
    <p style="font-size:14px;color:#4a4a5a;">Order #${orderNumber}</p>
    <p style="font-size:14px;color:#4a4a5a;">We'll send you tracking information as soon as your order ships.</p>
  `;
}

function buildOrderConfirmationText({ orderNumber, items, total }) {
  const itemsText = items
    .map((item) => `${item.productName} x${item.quantity} = Rs${item.quantity * item.price}`)
    .join("\n");

  return `ORDER CONFIRMATION\n\nOrder Number: ${orderNumber}\nTotal: Rs${total}\n\nItems:\n${itemsText}\n\nWe will send tracking information as soon as your order ships.`;
}

function buildPaymentReceiptHtml({ orderId, total, paymentMethod }) {
  return `
    <p style="font-size:15px;line-height:1.7;color:#2d2d44;">Thank you for your payment.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e8e4de;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px 14px;font-size:14px;color:#4a4a5a;border-bottom:1px solid #e8e4de;">Order ID</td>
        <td style="padding:12px 14px;font-size:14px;font-weight:600;color:#0d1b3e;border-bottom:1px solid #e8e4de;">${orderId}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:12px 14px;font-size:14px;color:#4a4a5a;border-bottom:1px solid #e8e4de;">Amount</td>
        <td style="padding:12px 14px;font-size:16px;font-weight:700;color:#0d1b3e;border-bottom:1px solid #e8e4de;">\u20B9${total}</td>
      </tr>
      <tr>
        <td style="padding:12px 14px;font-size:14px;color:#4a4a5a;">Payment Method</td>
        <td style="padding:12px 14px;font-size:14px;color:#2d2d44;">${paymentMethod}</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#4a4a5a;margin-top:16px;">Your invoice is attached. Please keep it for your records.</p>
  `;
}

function buildShippingNotificationHtml({ orderId, trackingNumber, carrier, estimatedDelivery }) {
  return `
    <p style="font-size:15px;line-height:1.7;color:#2d2d44;">Great news — your order is on its way!</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e8e4de;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px 14px;font-size:14px;color:#4a4a5a;border-bottom:1px solid #e8e4de;">Order ID</td>
        <td style="padding:12px 14px;font-size:14px;font-weight:600;color:#0d1b3e;border-bottom:1px solid #e8e4de;">${orderId}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:12px 14px;font-size:14px;color:#4a4a5a;border-bottom:1px solid #e8e4de;">Carrier</td>
        <td style="padding:12px 14px;font-size:14px;color:#2d2d44;border-bottom:1px solid #e8e4de;">${carrier}</td>
      </tr>
      <tr>
        <td style="padding:12px 14px;font-size:14px;color:#4a4a5a;border-bottom:1px solid #e8e4de;">Tracking Number</td>
        <td style="padding:12px 14px;font-size:14px;font-weight:600;color:#0d1b3e;font-family:monospace;border-bottom:1px solid #e8e4de;">${trackingNumber}</td>
      </tr>
      <tr style="background:#faf8f5;">
        <td style="padding:12px 14px;font-size:14px;color:#4a4a5a;">Est. Delivery</td>
        <td style="padding:12px 14px;font-size:14px;font-weight:600;color:#0d1b3e;">${estimatedDelivery}</td>
      </tr>
    </table>
  `;
}

function buildNewsletterHtml({ content: bodyContent, unsubscribeUrl }) {
  return `${bodyContent || ""}`;
}

function buildPasswordResetHtml({ userName, resetUrl, appName }) {
  return `
    <p style="font-size:15px;line-height:1.7;color:#2d2d44;">Hi <strong>${userName || "there"}</strong>,</p>
    <p style="font-size:15px;line-height:1.7;color:#2d2d44;">We received a request to reset your password. Click the button below to set a new one:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
      <tr><td style="background:#0d1b3e;border:1px solid #c9a96e;border-radius:8px;">
        <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#c9a96e;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Reset Password</a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#6b6b7b;margin-top:20px;padding-top:16px;border-top:1px solid #e8e4de;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
  `;
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

module.exports = {
  send,
  queue,
  sendWelcome,
  sendOrderConfirmation,
  sendPaymentReceipt,
  sendShippingNotification,
  sendNewsletter,
  sendPasswordReset,
  sendAdminNotification,
};
