const { z } = require("zod");

const createCouponSchema = z.object({
  code: z.string().min(3).max(20),
  title: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  discountType: z.enum(["percentage", "flat", "free_shipping"]),
  discountValue: z.number().min(0),
  maxDiscount: z.number().min(0).nullable().optional(),
  minOrderValue: z.number().min(0).optional().default(0),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
  maxUses: z.number().int().min(1).nullable().optional(),
  maxUsesPerUser: z.number().int().min(1).optional().default(1),
  showOnHero: z.boolean().optional().default(false),
  heroBannerText: z.string().max(150).optional(),
  heroBannerColor: z.string().max(20).optional(),
  applicableCategories: z.array(z.string()).optional(),
});

const validateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(20),
  subtotal: z.number().min(0),
});

module.exports = { createCouponSchema, validateCouponSchema };
