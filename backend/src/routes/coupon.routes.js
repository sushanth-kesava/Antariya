const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { createCouponSchema, validateCouponSchema } = require("../schemas/coupon.schemas");
const {
  createCoupon,
  listCoupons,
  updateCoupon,
  deleteCoupon,
  getHeroCoupons,
  validateCoupon,
} = require("../controllers/coupon.controller");

const router = express.Router();

// ─── Public routes ───────────────────────────────────────────────────────────
// Get active hero banner coupons (shown on homepage)
router.get("/hero", getHeroCoupons);

// ─── Authenticated customer routes ───────────────────────────────────────────
// Validate & calculate discount for a coupon code at checkout
router.post("/validate", requireAuth, validate(validateCouponSchema), validateCoupon);

// ─── Superadmin routes ───────────────────────────────────────────────────────
router.get("/", requireAuth, requireRole("superadmin"), listCoupons);
router.post("/", requireAuth, requireRole("superadmin"), validate(createCouponSchema), createCoupon);
router.patch("/:couponId", requireAuth, requireRole("superadmin"), updateCoupon);
router.delete("/:couponId", requireAuth, requireRole("superadmin"), deleteCoupon);

module.exports = router;
