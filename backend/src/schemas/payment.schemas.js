const { z } = require("zod");

const snapshotItemSchema = z.object({
  productId: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(100),
  variantSku: z.string().max(100).optional(),
  customization: z.any().optional(),
});

const createRazorpayOrderSchema = z.object({
  amount: z.number().int().min(100, "Amount must be at least 100 paise (₹1)").max(50000000), // max ₹5 lakh
  currency: z.string().length(3).toUpperCase().optional().default("INR"),
  receipt: z.string().max(40).optional(),
  // Cart snapshot — persisted server-side (PendingOrder) so a captured payment
  // can be fulfilled by the webhook / reconciliation script even if the
  // customer's browser never completes the order-creation call. Optional so
  // older clients keep working.
  items: z.array(snapshotItemSchema).max(50).optional(),
  couponCode: z.string().max(20).optional(),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, "razorpay_order_id is required").max(100),
  razorpay_payment_id: z.string().min(1, "razorpay_payment_id is required").max(100),
  razorpay_signature: z.string().min(1, "razorpay_signature is required").max(200),
});

module.exports = {
  createRazorpayOrderSchema,
  verifyPaymentSchema,
};
