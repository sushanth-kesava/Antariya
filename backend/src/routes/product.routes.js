const express = require("express");
const {
  getProducts,
  getMarketplaceLayout,
  getProductById,
  uploadProductImages,
  productImageUploadMiddleware,
  createProduct,
  deleteProduct,
  getProductReviews,
  createProductReview,
  getReviewModerationQueue,
  updateReviewModeration,
  getReviewModerationActivity,
  getReviewEligibility,
  getInventoryReport,
  adjustStock,
  getStockHistory,
  updateInventorySettings,
  exportInventoryCsv,
  importInventoryCsv,
} = require("../controllers/product.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", getProducts);
router.get("/marketplace", getMarketplaceLayout);
router.get("/admin/inventory", requireAuth, requireRole("admin", "superadmin"), getInventoryReport);
router.get("/admin/stock-history", requireAuth, requireRole("admin", "superadmin"), getStockHistory);
router.get("/admin/inventory/export", requireAuth, requireRole("admin", "superadmin"), exportInventoryCsv);
router.post("/admin/inventory/import", requireAuth, requireRole("admin", "superadmin"), importInventoryCsv);
router.post("/:productId/adjust-stock", requireAuth, requireRole("admin", "superadmin"), adjustStock);
router.patch("/:productId/inventory-settings", requireAuth, requireRole("admin", "superadmin"), updateInventorySettings);
router.get("/admin/reviews/activity", requireAuth, requireRole("admin", "superadmin"), getReviewModerationActivity);
router.get("/admin/reviews", requireAuth, requireRole("admin", "superadmin"), getReviewModerationQueue);
router.patch("/admin/reviews/:reviewId", requireAuth, requireRole("admin", "superadmin"), updateReviewModeration);
router.post("/upload-images", requireAuth, requireRole("admin", "superadmin"), productImageUploadMiddleware, uploadProductImages);
router.get("/:id/review-eligibility", requireAuth, getReviewEligibility);
router.get("/:id/reviews", getProductReviews);
router.post("/:id/reviews", requireAuth, createProductReview);
router.get("/:id", getProductById);
router.post("/", requireAuth, requireRole("admin", "superadmin"), createProduct);
router.delete("/:id", requireAuth, requireRole("admin", "superadmin"), deleteProduct);

module.exports = router;
