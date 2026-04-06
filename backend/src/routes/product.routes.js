const express = require("express");
const {
  getProducts,
  getProductById,
  createProduct,
  deleteProduct,
  seedProducts,
  getProductReviews,
  createProductReview,
  getReviewModerationQueue,
  updateReviewModeration,
  getReviewModerationActivity,
} = require("../controllers/product.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", getProducts);
router.get("/admin/reviews/activity", requireAuth, getReviewModerationActivity);
router.get("/admin/reviews", requireAuth, getReviewModerationQueue);
router.patch("/admin/reviews/:reviewId", requireAuth, updateReviewModeration);
router.get("/:id/reviews", getProductReviews);
router.post("/:id/reviews", requireAuth, createProductReview);
router.get("/:id", getProductById);
router.post("/", requireAuth, createProduct);
router.delete("/:id", requireAuth, deleteProduct);
router.post("/seed", seedProducts);

module.exports = router;
