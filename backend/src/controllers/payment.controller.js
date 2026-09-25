const crypto = require("crypto");
const Razorpay = require("razorpay");
const env = require("../config/env");
const PendingOrder = require("../models/PendingOrder");
const { fulfillPaidOrder } = require("../services/fulfillment.service");

const MIN_RAZORPAY_AMOUNT_PAISE = 100;

/**
 * Pure server-side verification of a Razorpay payment signature.
 * Returns true only when the HMAC-SHA256 of `${order_id}|${payment_id}`
 * (keyed with the Razorpay secret) matches the signature Razorpay sent.
 * Use this to bind payment verification to any server action (e.g. order
 * creation) so an order can never be persisted without a real payment.
 */
function isValidRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!isRazorpayConfigured()) {
    return false;
  }
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }
  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto.createHmac("sha256", env.razorpayKeySecret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const actualBuf = Buffer.from(String(razorpaySignature), "utf8");
  return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function isRazorpayConfigured() {
  return Boolean(env.razorpayKeyId) && Boolean(env.razorpayKeySecret);
}

function getRazorpayClient() {
  if (!isRazorpayConfigured()) {
    return null;
  }

  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
  });
}

async function createRazorpayOrder(req, res, next) {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(500).json({
        success: false,
        message: "Razorpay is not configured",
      });
    }

    const amount = Number.parseInt(String(req.body?.amount), 10);
    const currency = typeof req.body?.currency === "string" && req.body.currency.trim().length > 0 ? req.body.currency.trim().toUpperCase() : "INR";
    const receipt = typeof req.body?.receipt === "string" && req.body.receipt.trim().length > 0 ? req.body.receipt.trim() : `receipt_${Date.now()}`;

    if (!Number.isFinite(amount) || amount < MIN_RAZORPAY_AMOUNT_PAISE) {
      return res.status(400).json({
        success: false,
        message: `Amount must be at least ${MIN_RAZORPAY_AMOUNT_PAISE} paise`,
      });
    }

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
    });

    // --- Persist a server-side cart snapshot (PendingOrder) ------------------
    // This is what makes a captured payment recoverable without the browser:
    // the webhook and the reconciliation script rebuild the real Order from
    // this snapshot. Keyed by the Razorpay order id. Best-effort: never fail
    // order creation if the snapshot write fails (older clients omit items).
    const snapshotItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (snapshotItems.length > 0 && req.auth?.sub && req.auth?.email) {
      try {
        await PendingOrder.findOneAndUpdate(
          { razorpayOrderId: order.id },
          {
            $set: {
              razorpayOrderId: order.id,
              auth: { sub: req.auth.sub, email: req.auth.email, role: req.auth.role || "customer" },
              items: snapshotItems.map((it) => ({
                productId: String(it.productId),
                quantity: Number(it.quantity),
                variantSku: it.variantSku ? String(it.variantSku) : "",
                customization: it.customization,
              })),
              couponCode: typeof req.body?.couponCode === "string" ? req.body.couponCode : "",
              amount: order.amount,
              currency: order.currency,
              status: "pending",
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (snapErr) {
        console.error(`[Payment] Failed to persist PendingOrder snapshot for ${order.id}: ${snapErr.message}`);
      }
    } else {
      console.warn(`[Payment] create-order without cart snapshot (order ${order.id}) — payment will NOT be auto-recoverable if the browser fails.`);
    }
    // ------------------------------------------------------------------------

    return res.status(201).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    if (error?.statusCode === 401 || error?.status === 401) {
      return res.status(401).json({
        success: false,
        message: "Razorpay authentication failed",
      });
    }

    if (error?.statusCode >= 400 && error?.statusCode < 500) {
      return res.status(400).json({
        success: false,
        message: error?.error?.description || error.message || "Failed to create Razorpay order",
      });
    }

    return next(error);
  }
}

function verifyPaymentSignature(req, res) {
  const razorpayOrderId = String(req.body?.razorpay_order_id || "").trim();
  const razorpayPaymentId = String(req.body?.razorpay_payment_id || "").trim();
  const razorpaySignature = String(req.body?.razorpay_signature || "").trim();

  if (!isRazorpayConfigured()) {
    return res.status(500).json({
      success: false,
      message: "Razorpay is not configured",
    });
  }

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({
      success: false,
      message: "Missing payment verification fields",
    });
  }

  if (!isValidRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment signature",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Payment verified",
  });
}

/**
 * Issue a refund against a captured Razorpay payment. Amount is optional —
 * when omitted, Razorpay refunds the full captured amount. `amountPaise` must
 * be an integer number of paise when provided (partial refund).
 * Returns the Razorpay refund object. Throws if Razorpay isn't configured.
 */
async function refundRazorpayPayment({ paymentId, amountPaise, notes } = {}) {
  if (!isRazorpayConfigured()) {
    const err = new Error("Razorpay is not configured");
    err.statusCode = 500;
    throw err;
  }
  if (!paymentId) {
    const err = new Error("A Razorpay payment id is required to refund");
    err.statusCode = 400;
    throw err;
  }

  const client = getRazorpayClient();
  const payload = {};
  if (Number.isFinite(Number(amountPaise)) && Number(amountPaise) > 0) {
    payload.amount = Math.round(Number(amountPaise));
  }
  if (notes && typeof notes === "object") {
    payload.notes = notes;
  }

  return client.payments.refund(paymentId, payload);
}

/**
 * Verify a Razorpay WEBHOOK signature. Razorpay signs the RAW request body
 * with your webhook secret (set in the Razorpay Dashboard). This is a
 * DIFFERENT secret from the key secret used for checkout signatures.
 * `rawBody` MUST be the exact bytes received (see the express.raw() mount).
 */
function isValidWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret || !signature || !rawBody) {
    return false;
  }
  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(String(signature), "utf8");
  return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Razorpay webhook receiver. This is the SAFETY NET: even if the customer's
 * browser dies right after paying, Razorpay calls this endpoint server-to-
 * server on `payment.captured`, and we materialize the order from the
 * PendingOrder snapshot. Idempotent via fulfillPaidOrder (keyed by
 * razorpayOrderId), so it is safe if the browser also created the order.
 *
 * Mounted with express.raw() so req.body is the raw Buffer needed for the
 * signature check. ALWAYS returns 200 quickly on handled events so Razorpay
 * does not retry-storm; genuine signature failures return 400.
 */
async function handleRazorpayWebhook(req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body; // Buffer (express.raw)

    if (!env.razorpayWebhookSecret) {
      console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting webhook.");
      return res.status(500).json({ success: false, message: "Webhook not configured" });
    }
    if (!isValidWebhookSignature(rawBody, signature)) {
      console.warn("[Webhook] Invalid signature — rejected.");
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const event = payload?.event;

    // We care about payment success. `payment.captured` fires for auto-captured
    // payments; `order.paid` is a belt-and-suspenders alternative.
    if (event !== "payment.captured" && event !== "order.paid") {
      return res.status(200).json({ success: true, ignored: event });
    }

    const paymentEntity = payload?.payload?.payment?.entity || {};
    const razorpayOrderId = paymentEntity.order_id || payload?.payload?.order?.entity?.id || "";
    const razorpayPaymentId = paymentEntity.id || "";

    if (!razorpayOrderId) {
      console.warn(`[Webhook] ${event} without an order_id — ignored.`);
      return res.status(200).json({ success: true, ignored: "no_order_id" });
    }

    const pending = await PendingOrder.findOne({ razorpayOrderId });
    if (!pending) {
      // No snapshot: we cannot rebuild the cart. Log loudly so it surfaces in
      // reconciliation. (Happens only for orders created before this fix.)
      console.error(`[Webhook] ${event} for ${razorpayOrderId} but NO PendingOrder snapshot exists — needs manual reconciliation.`);
      return res.status(200).json({ success: true, warning: "no_snapshot" });
    }

    const result = await fulfillPaidOrder({
      auth: pending.auth,
      items: pending.items,
      couponCode: pending.couponCode,
      razorpayOrderId,
      razorpayPaymentId,
      source: "webhook",
    });

    console.log(`[Webhook] ${event} ${razorpayOrderId} -> order ${result.order.id} (created=${result.created})`);
    return res.status(200).json({ success: true, orderId: result.order.id, created: result.created });
  } catch (error) {
    // Record the failure on the snapshot for the reconciliation script, but
    // still return 200 so Razorpay doesn't hammer us — the cron will retry.
    try {
      const raw = req.body ? JSON.parse(req.body.toString("utf8")) : {};
      const oid = raw?.payload?.payment?.entity?.order_id;
      if (oid) {
        await PendingOrder.updateOne({ razorpayOrderId: oid }, { $set: { lastError: error.message } });
      }
    } catch (_) { /* ignore */ }
    console.error(`[Webhook] Handler error: ${error.message}`);
    return res.status(200).json({ success: false, message: "handled_with_error" });
  }
}

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature,
  isValidRazorpaySignature,
  isRazorpayConfigured,
  refundRazorpayPayment,
  isValidWebhookSignature,
  handleRazorpayWebhook,
};
