const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const {
  listCategories,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory,
  recountProducts,
} = require("../controllers/category.controller");

const router = express.Router();

// ─── Public (storefront) ─────────────────────────────────────────────────────
// Nested tree or flat list; supports ?flat=1 ?active=1 ?nav=1 ?search=term
router.get("/", listCategories);
// Products within a category subtree (self + descendants)
router.get("/:slug/products", getCategoryProducts);

// ─── Admin / Superadmin ──────────────────────────────────────────────────────
router.post("/", requireAuth, requireRole("admin", "superadmin"), createCategory);
router.post("/recount", requireAuth, requireRole("admin", "superadmin"), recountProducts);
router.patch("/:id", requireAuth, requireRole("admin", "superadmin"), updateCategory);
router.delete("/:id", requireAuth, requireRole("admin", "superadmin"), deleteCategory);

module.exports = router;
