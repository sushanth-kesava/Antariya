/**
 * Mail Utilities - High-level email helpers
 * Wraps mail.service.js and mail.queue.js with common use cases
 */

const mailService = require("./mail.service");
const { enqueue } = require("./mail.queue");
const env = require("../config/env");

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
  const html = buildOrderConfirmationHtml({
    orderId,
    orderNumber,
    items,
    total,
  });
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
  const html = buildPaymentReceiptHtml({ orderId, total, paymentMethod });
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
  const html = buildShippingNotificationHtml({
    orderId,
    trackingNumber,
    carrier,
    estimatedDelivery,
  });
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
  const html = buildNewsletterHtml({ content, unsubscribeUrl });
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
  const html = buildPasswordResetHtml({ userName, resetUrl, appName });
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
      (item) => `<tr>
      <td>${item.productName}</td>
      <td>${item.quantity}x</td>
      <td>Rs${item.price}</td>
      <td>Rs${item.quantity * item.price}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Order Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Order Confirmed!</h1>
          <p>Thank you for your order. Here is your confirmation:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead style="background: #f5f5f5;">
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <p style="font-size: 18px; font-weight: bold;">
            Total: Rs${total}
          </p>
          
          <p>Order #${orderNumber}</p>
          <p>We will send you tracking information as soon as your order ships.</p>
        </div>
      </body>
    </html>`;
}

function buildOrderConfirmationText({ orderNumber, items, total }) {
  const itemsText = items
    .map((item) => `${item.productName} x${item.quantity} = Rs${item.quantity * item.price}`)
    .join("\n");

  return `ORDER CONFIRMATION\n\nOrder Number: ${orderNumber}\nTotal: Rs${total}\n\nItems:\n${itemsText}\n\nWe will send tracking information as soon as your order ships.`;
}

function buildPaymentReceiptHtml({ orderId, total, paymentMethod }) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Payment Receipt</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Payment Received</h1>
          <p>Thank you for your payment.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px;">Order ID:</td>
              <td style="padding: 8px; font-weight: bold;">${orderId}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px;">Amount:</td>
              <td style="padding: 8px; font-weight: bold;">Rs${total}</td>
            </tr>
            <tr>
              <td style="padding: 8px;">Payment Method:</td>
              <td style="padding: 8px;">${paymentMethod}</td>
            </tr>
          </table>
          
          <p>Your invoice is attached. Please keep it for your records.</p>
        </div>
      </body>
    </html>`;
}

function buildShippingNotificationHtml({ orderId, trackingNumber, carrier, estimatedDelivery }) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Shipping Notification</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Your Order is on the Way!</h1>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px;">Order ID:</td>
              <td style="padding: 8px; font-weight: bold;">${orderId}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px;">Carrier:</td>
              <td style="padding: 8px;">${carrier}</td>
            </tr>
            <tr>
              <td style="padding: 8px;">Tracking:</td>
              <td style="padding: 8px; font-weight: bold; font-family: monospace;">${trackingNumber}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px;">Est. Delivery:</td>
              <td style="padding: 8px;">${estimatedDelivery}</td>
            </tr>
          </table>
        </div>
      </body>
    </html>`;
}

function buildNewsletterHtml({ content, unsubscribeUrl }) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Newsletter</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          ${content}
          <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">
            <a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a>
          </p>
        </div>
      </body>
    </html>`;
}

function buildPasswordResetHtml({ userName, resetUrl, appName }) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Password Reset Request</h1>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password on ${appName}.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block;">
              Reset Password
            </a>
          </p>
          
          <p>If you did not request this, you can ignore this email.</p>
          <p>This link expires in 24 hours.</p>
        </div>
      </body>
    </html>`;
}

// --- Utility Functions ---

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
