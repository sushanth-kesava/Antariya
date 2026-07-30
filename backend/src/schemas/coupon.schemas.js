const { z } = require("zod");

// Accepts a comma/newline-separated string OR an array of email strings.
const emailListSchema = z.union([z.string(), z.array(z.string())]).optional();

const createCouponSchema = z.object({
  code: z.string().min(3).max(20),
  title: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  discountType: z.enum(["percentage", "flat", "free_shipping"]),
  discountValue: z.number().min(0),
  maxDiscount: z.number().min(0).nullable().optional(),
  minOrderValue: z.number().min(0).optional().default(0),
  minQuantity: z.number().int().min(0).optional().default(0),
  freeDelivery: z.boolean().optional(),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
  maxUses: z.number().int().min(1).nullable().optional(),
  maxUsesPerUser: z.number().int().min(1).optional().default(1),
  showOnHero: z.boolean().optional().default(false),
  heroBannerText: z.string().max(150).optional(),
  heroBannerColor: z.string().max(20).optional(),
  // Accepts a Cloudinary URL or a base64 data URL fallback (can be large).
  heroImage: z.string().max(3_000_000).optional(),
  applicableCategories: z.array(z.string()).optional(),
  // Restricted (private) coupon support
  visibility: z.enum(["public", "restricted"]).optional().default("public"),
  allowedEmails: emailListSchema,
});

const validateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(20),
  subtotal: z.number().min(0),
  quantity: z.number().int().min(0).optional().default(0),
});

module.exports = { createCouponSchema, validateCouponSchema };
