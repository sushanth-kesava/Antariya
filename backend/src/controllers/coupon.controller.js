const Coupon = require("../models/Coupon");

// ─── Superadmin: Create a new coupon ─────────────────────────────────────────
async function createCoupon(req, res, next) {
  try {
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderValue,
      minQuantity,
      validFrom,
      validUntil,
      maxUses,
      maxUsesPerUser,
      showOnHero,
      heroBannerText,
      heroBannerColor,
      applicableCategories,
    } = req.body;

    if (!code || !title || !discountType || discountValue === undefined || !validFrom || !validUntil) {
      return res.status(400).json({
        success: false,
        message: "code, title, discountType, discountValue, validFrom, and validUntil are required",
      });
    }

    const normalizedCode = String(code).trim().toUpperCase().replace(/\s+/g, "");

    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Coupon code must be between 3 and 20 characters",
      });
    }

    // Check for duplicate
    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Coupon code "${normalizedCode}" already exists`,
      });
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      discountType,
      discountValue: Number(discountValue),
      maxDiscount: maxDiscount != null ? Number(maxDiscount) : null,
      minOrderValue: Number(minOrderValue || 0),
      minQuantity: Number(minQuantity || 0),
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      maxUses: maxUses != null ? Number(maxUses) : null,
      maxUsesPerUser: Number(maxUsesPerUser || 1),
      showOnHero: Boolean(showOnHero),
      heroBannerText: heroBannerText ? String(heroBannerText).trim() : "",
      heroBannerColor: heroBannerColor || "#1a1a1a",
      applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : [],
      createdBy: req.auth?.email || "superadmin",
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon,
    });
  } catch (error) {
    return next(error);
  }
}

// ─── Superadmin: List all coupons ────────────────────────────────────────────
async function listCoupons(req, res, next) {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean({ virtuals: true });
    return res.status(200).json({ success: true, coupons });
  } catch (error) {
    return next(error);
  }
}

// ─── Superadmin: Update a coupon ─────────────────────────────────────────────
async function updateCoupon(req, res, next) {
  try {
    const { couponId } = req.params;
    const updates = { ...req.body };

    // Don't allow changing code after creation
    delete updates.code;
    delete updates.currentUses;
    delete updates.usageLog;

    if (updates.discountValue !== undefined) updates.discountValue = Number(updates.discountValue);
    if (updates.maxDiscount !== undefined) updates.maxDiscount = updates.maxDiscount != null ? Number(updates.maxDiscount) : null;
    if (updates.minOrderValue !== undefined) updates.minOrderValue = Number(updates.minOrderValue);
    if (updates.maxUses !== undefined) updates.maxUses = updates.maxUses != null ? Number(updates.maxUses) : null;
    if (updates.validFrom) updates.validFrom = new Date(updates.validFrom);
    if (updates.validUntil) updates.validUntil = new Date(updates.validUntil);

    const coupon = await Coupon.findByIdAndUpdate(couponId, updates, { new: true, runValidators: true });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    return res.status(200).json({ success: true, message: "Coupon updated", coupon });
  } catch (error) {
    return next(error);
  }
}

// ─── Superadmin: Delete a coupon ─────────────────────────────────────────────
async function deleteCoupon(req, res, next) {
  try {
    const { couponId } = req.params;
    const coupon = await Coupon.findByIdAndDelete(couponId);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    return res.status(200).json({ success: true, message: "Coupon deleted" });
  } catch (error) {
    return next(error);
  }
}

// ─── Public: Get active hero coupons (for the homepage banner) ───────────────
async function getHeroCoupons(req, res, next) {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      active: true,
      showOnHero: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    })
      .select("code title description discountType discountValue maxDiscount minOrderValue heroBannerText heroBannerColor validUntil")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.status(200).json({ success: true, coupons });
  } catch (error) {
    return next(error);
  }
}

// ─── Customer: Validate & apply a coupon code ────────────────────────────────
async function validateCoupon(req, res, next) {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const subtotal = Number(req.body?.subtotal || 0); // in paise
    const quantity = Number(req.body?.quantity || 0); // total items in cart
    const userId = req.auth?.sub || null;
    const userEmail = req.auth?.email || null;

    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ code });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid coupon code" });
    }

    const now = new Date();

    if (!coupon.active) {
      return res.status(400).json({ success: false, message: "This coupon is no longer active" });
    }

    if (now < coupon.validFrom) {
      return res.status(400).json({ success: false, message: "This coupon is not yet active" });
    }

    if (now > coupon.validUntil) {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
    }

    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      return res.status(400).json({ success: false, message: "This coupon has reached its usage limit" });
    }

    // Per-user limit check
    if (userId && coupon.maxUsesPerUser > 0) {
      const userUseCount = coupon.usageLog.filter(
        (log) => log.userId === userId || log.email === userEmail
      ).length;

      if (userUseCount >= coupon.maxUsesPerUser) {
        return res.status(400).json({ success: false, message: "You have already used this coupon" });
      }
    }

    // Min order check
    if (subtotal < coupon.minOrderValue) {
      const minInRupees = Math.ceil(coupon.minOrderValue / 100);
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${minInRupees} to use this coupon`,
      });
    }

    // Min quantity check
    if (coupon.minQuantity > 0 && quantity < coupon.minQuantity) {
      return res.status(400).json({
        success: false,
        message: `You need at least ${coupon.minQuantity} item(s) in your cart to use this coupon`,
      });
    }

    // Calculate discount
    let discount = 0;

    if (coupon.discountType === "percentage") {
      discount = Math.round((subtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else if (coupon.discountType === "flat") {
      discount = coupon.discountValue;
    } else if (coupon.discountType === "free_shipping") {
      discount = 0; // handled in checkout as shipping = 0
    }

    // Never discount more than the subtotal
    if (discount > subtotal) {
      discount = subtotal;
    }

    return res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      coupon: {
        code: coupon.code,
        title: coupon.title,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount, // actual discount amount in paise
        freeShipping: coupon.discountType === "free_shipping",
      },
    });
  } catch (error) {
    return next(error);
  }
}

// ─── Internal: Record coupon usage after successful order ────────────────────
async function recordCouponUsage({ code, userId, email, orderId }) {
  if (!code) return;

  try {
    await Coupon.findOneAndUpdate(
      { code: String(code).toUpperCase() },
      {
        $inc: { currentUses: 1 },
        $push: {
          usageLog: {
            userId: userId || "anonymous",
            email: email || "",
            orderId: orderId || "",
            usedAt: new Date(),
          },
        },
      }
    );
  } catch (error) {
    console.error("[Coupon] Failed to record usage:", error.message);
  }
}

module.exports = {
  createCoupon,
  listCoupons,
  updateCoupon,
  deleteCoupon,
  getHeroCoupons,
  validateCoupon,
  recordCouponUsage,
};
