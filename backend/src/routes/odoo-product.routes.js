const express = require("express");
const router = express.Router();
const {
  getOdooProducts,
  getOdooProductById,
  searchOdooProducts,
  getOdooCategories,
} = require("../controllers/odoo-product.controller");

/**
 * Odoo Product Routes
 * Fetches products directly from Odoo without caching locally
 * When mounted at /api/odoo/products:
 *   GET /api/odoo/products/search?q=query
 *   GET /api/odoo/products/categories
 *   GET /api/odoo/products
 *   GET /api/odoo/products/:id
 */

// Search endpoint (must be before :id to avoid conflict)
router.get("/search", searchOdooProducts);

// Categories endpoint (must be before :id to avoid conflict)
router.get("/categories", getOdooCategories);

// List products with pagination and filtering
router.get("/", getOdooProducts);

// Get single product by ID (must be last)
router.get("/:id", getOdooProductById);

module.exports = router;
