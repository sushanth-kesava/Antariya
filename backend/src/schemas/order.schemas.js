const { z } = require("zod");

const customizationSchema = z.object({
  symbol: z.string().max(100).optional(),
  threadColor: z.string().max(50).optional(),
  fabricColor: z.string().max(50).optional(),
  size: z.enum(["Small", "Medium", "Large"]).optional(),
  placement: z.string().max(100).optional(),
  referenceImage: z.string().max(500000).optional(), // base64 data URL
  referenceImageName: z.string().max(255).optional(),
  notes: z.string().max(300).optional(),
}).optional();

const orderItemSchema = z.object({
  productId: z.string().min(1, "productId is required").max(50),
  quantity: z.number().int().min(1, "quantity must be at least 1").max(100),
  variantSku: z.string().max(100).optional(),
  customization: customizationSchema,
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, "At least one item is required").max(50),
  paymentMethod: z.string().max(20).optional(),
  razorpay_order_id: z.string().max(100).optional(),
  razorpay_payment_id: z.string().max(100).optional(),
  razorpay_signature: z.string().max(200).optional(),
  shippingAddress: z.object({
    fullName: z.string().min(1).max(200).optional(),
    phone: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    pincode: z.string().max(10).optional(),
    country: z.string().max(100).optional(),
  }).optional(),
});

module.exports = {
  createOrderSchema,
};
