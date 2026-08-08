const Coupon = require("../models/Coupon");

// ─── Helpers ──────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize a raw email list into a clean, lowercase, de-duplicated array.
 * Accepts either an array of strings or a comma / newline separated string
 * (as produced by a textarea or a parsed CSV column).
 * Returns { emails, invalid } so the caller can report import status.
 */
function normalizeEmailList(input) {
  let raw = [];
  if (Array.isArray(input)) {
    raw = input;
  } else if (typeof input === "string") {
    raw = input.split(/[\n,;]+/);
  }

  const seen = new Set();
  const emails = [];
  const invalid = [];

  for (const entry of raw) {
    const email = String(entry || "").trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      invalid.push(email);
      continue;
    }
    if (seen.has(email)) continue; // duplicate removal
    seen.add(email);
    emails.push(email);
  }

  return { emails, invalid };
}

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
      heroImage,
      applicableCategories,
      visibility,
      allowedEmails,
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

    // Resolve visibility + allowed emails (for restricted coupons).
    const resolvedVisibility = visibility === "restricted" ? "restricted" : "public";
    const { emails: normalizedAllowed, invalid: invalidEmails } = normalizeEmailList(allowedEmails);

    if (resolvedVisibility === "restricted" && normalizedAllowed.length === 0) {
      return res.status(400).json({
        success: false,
        message: "A restricted coupon needs at least one valid allowed email.",
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
      heroImage: heroImage ? String(heroImage).trim() : "",
      applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : [],
      visibility: resolvedVisibility,
      allowedEmails: resolvedVisibility === "restricted" ? normalizedAllowed : [],
      createdBy: req.auth?.email || "superadmin",
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      import: {
        allowedCount: coupon.allowedEmails.length,
        invalidSkipped: invalidEmails.length,
      },
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

    // Handle visibility / allowed-email changes for restricted coupons.
    if (updates.visibility !== undefined) {
      updates.visibility = updates.visibility === "restricted" ? "restricted" : "public";
    }
    if (updates.allowedEmails !== undefined) {
      const { emails } = normalizeEmailList(updates.allowedEmails);
      updates.allowedEmails = emails;
    }
    // If switching (back) to public, clear the allow-list to avoid stale data.
    if (updates.visibility === "public") {
      updates.allowedEmails = [];
    }

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
      // Restricted coupons must never surface on the public homepage banner.
      visibility: "public",
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    })
      .select("code title description discountType discountValue maxDiscount minOrderValue heroBannerText heroBannerColor heroImage validUntil")
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

    // ─── Restricted coupon: email allow-list gate ──────────────────────────
    // A restricted coupon may only be redeemed by customers whose account
    // email is on the allowed list. Requires an authenticated user.
    if (coupon.visibility === "restricted") {
      const normalizedEmail = String(userEmail || "").trim().toLowerCase();
      const allowed = Array.isArray(coupon.allowedEmails) && normalizedEmail
        && coupon.allowedEmails.includes(normalizedEmail);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "This coupon is not available for your account.",
        });
      }
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
        freeShipping: coupon.discountType === "free_shipping" || coupon.freeDelivery === true,
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


// --- Customer: List coupons the logged-in user is eligible to see -----------
// Returns all currently-valid PUBLIC coupons PLUS any RESTRICTED coupons whose
// allowedEmails list contains the authenticated user's email. This is what the
// checkout / dashboard "available coupons" UI should call so restricted offers
// (e.g. "Antariya's Waitlisted Insiders") surface to the exact customers they
// were created for -- without ever leaking onto the public homepage hero banner
// (which stays on getHeroCoupons).
async function getAvailableCoupons(req, res, next) {
  try {
    const now = new Date();
    const userEmail = String(req.auth?.email || "").trim().toLowerCase();

    const coupons = await Coupon.find({
      active: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        { visibility: "public" },
        ...(userEmail
          ? [{ visibility: "restricted", allowedEmails: userEmail }]
          : []),
      ],
    })
      .select(
        "code title description discountType discountValue maxDiscount minOrderValue minQuantity heroBannerText heroBannerColor heroImage validUntil visibility freeDelivery maxUses currentUses"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Hide coupons that have already hit their global usage cap so we never
    // advertise something the customer can't actually redeem.
    const redeemable = coupons.filter(
      (c) => c.maxUses == null || (c.currentUses || 0) < c.maxUses
    );

    return res.status(200).json({ success: true, coupons: redeemable });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createCoupon,
  listCoupons,
  updateCoupon,
  deleteCoupon,
  getHeroCoupons,
  getAvailableCoupons,
  validateCoupon,
  recordCouponUsage,
};
