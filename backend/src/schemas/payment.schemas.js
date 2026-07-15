const { z } = require("zod");

const createRazorpayOrderSchema = z.object({
  amount: z.number().int().min(100, "Amount must be at least 100 paise (₹1)").max(50000000), // max ₹5 lakh
  currency: z.string().length(3).toUpperCase().optional().default("INR"),
  receipt: z.string().max(40).optional(),
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
