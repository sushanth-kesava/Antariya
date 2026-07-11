const crypto = require("crypto");
const Razorpay = require("razorpay");
const env = require("../config/env");

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

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature,
  isValidRazorpaySignature,
  isRazorpayConfigured,
  refundRazorpayPayment,
};
