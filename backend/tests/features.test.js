/**
 * Unit tests for the three feature additions:
 *   - Restricted coupon schema (visibility + allowedEmails)
 *   - Category slug generation
 *   - Cloudinary public_id extraction (barcode image cleanup)
 *
 * Run with: npx jest tests/features.test.js
 * These are pure-logic tests — no database required.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-features";
process.env.SUPERADMIN_ALLOWED_EMAILS = "testadmin@example.com";
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/antariya_test";

describe("Coupon schema — restricted coupons", () => {
  const { createCouponSchema, validateCouponSchema } = require("../src/schemas/coupon.schemas");

  it("accepts a public coupon without allowedEmails", () => {
    const r = createCouponSchema.safeParse({
      code: "PUBLIC10", title: "Public", discountType: "percentage", discountValue: 10,
      validFrom: "2026-01-01", validUntil: "2026-12-31",
    });
    expect(r.success).toBe(true);
    expect(r.data.visibility).toBe("public");
  });

  it("accepts a restricted coupon with a comma-separated email string", () => {
    const r = createCouponSchema.safeParse({
      code: "VIP20", title: "VIP", discountType: "flat", discountValue: 20000,
      validFrom: "2026-01-01", validUntil: "2026-12-31",
      visibility: "restricted", allowedEmails: "a@x.com, b@y.com",
    });
    expect(r.success).toBe(true);
    expect(r.data.visibility).toBe("restricted");
  });

  it("accepts allowedEmails as an array", () => {
    const r = createCouponSchema.safeParse({
      code: "VIP21", title: "VIP", discountType: "flat", discountValue: 20000,
      validFrom: "2026-01-01", validUntil: "2026-12-31",
      visibility: "restricted", allowedEmails: ["a@x.com", "b@y.com"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid visibility value", () => {
    const r = createCouponSchema.safeParse({
      code: "BAD1", title: "Bad", discountType: "percentage", discountValue: 10,
      validFrom: "2026-01-01", validUntil: "2026-12-31", visibility: "secret",
    });
    expect(r.success).toBe(false);
  });

  it("validateCoupon passes quantity through", () => {
    const r = validateCouponSchema.safeParse({ code: "X", subtotal: 1000, quantity: 3 });
    expect(r.success).toBe(true);
    expect(r.data.quantity).toBe(3);
  });
});

describe("Category slugify", () => {
  const Category = require("../src/models/Category");

  it("lowercases and hyphenates", () => {
    expect(Category.slugify("Anime Collection")).toBe("anime-collection");
  });
  it("handles ampersands", () => {
    expect(Category.slugify("Coupons & Offers")).toBe("coupons-and-offers");
  });
  it("strips leading/trailing separators", () => {
    expect(Category.slugify("  --Fit--  ")).toBe("fit");
  });
  it("collapses non-alphanumerics", () => {
    expect(Category.slugify("100% Cotton (Premium)")).toBe("100-cotton-premium");
  });
});

describe("Barcode — Cloudinary public_id extraction", () => {
  const BarcodeService = require("../src/services/barcode.service");

  it("extracts public_id from a versioned delivery URL", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1699999999/antariya/barcodes/SKU123.png";
    expect(BarcodeService._extractCloudinaryPublicId(url)).toBe("antariya/barcodes/SKU123");
  });
  it("returns null for a non-parseable url", () => {
    expect(BarcodeService._extractCloudinaryPublicId("not-a-url")).toBeNull();
  });
});
