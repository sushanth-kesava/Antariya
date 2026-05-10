const express = require("express");
const {
  getProducts,
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
} = require("../controllers/product.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", getProducts);
router.get("/admin/reviews/activity", requireAuth, requireRole("admin", "superadmin"), getReviewModerationActivity);
router.get("/admin/reviews", requireAuth, requireRole("admin", "superadmin"), getReviewModerationQueue);
router.patch("/admin/reviews/:reviewId", requireAuth, requireRole("admin", "superadmin"), updateReviewModeration);
router.post("/upload-images", requireAuth, requireRole("admin", "superadmin"), productImageUploadMiddleware, uploadProductImages);
router.get("/:id/reviews", getProductReviews);
router.post("/:id/reviews", requireAuth, createProductReview);
router.get("/:id", getProductById);
router.post("/", requireAuth, requireRole("admin", "superadmin"), createProduct);
router.delete("/:id", requireAuth, requireRole("admin", "superadmin"), deleteProduct);

module.exports = router;
