const productService = require("../services/odoo/product.service");

/**
 * GET /api/odoo/products
 * Fetch products with pagination, search, and filtering.
 * Query params: offset, limit, search, categoryId, minPrice, maxPrice, active, sort
 */
async function getOdooProducts(req, res, next) {
  try {
    const {
      offset = 0,
      limit = 20,
      search = "",
      categoryId,
      minPrice,
      maxPrice,
      active,
      sort = "id",
    } = req.query;

    const filters = {};
    if (categoryId) filters.categoryId = categoryId;
    if (minPrice !== undefined) filters.minPrice = minPrice;
    if (maxPrice !== undefined) filters.maxPrice = maxPrice;
    if (active !== undefined) filters.active = active;

    const result = await productService.getProducts({
      offset,
      limit,
      search,
      filters,
      sort,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error fetching Odoo products:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch products",
    });
  }
}

/**
 * GET /api/odoo/products/:id
 * Fetch a single product by ID.
 */
async function getOdooProductById(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Product ID is required",
      });
    }

    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("Error fetching Odoo product:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch product",
    });
  }
}

/**
 * GET /api/odoo/products/search?q=query
 * Search products by query string.
 * Query params: q (required), offset, limit
 */
async function searchOdooProducts(req, res, next) {
  try {
    const { q, offset = 0, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Search query (q) is required",
      });
    }

    const result = await productService.searchProducts(q, {
      offset,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error searching Odoo products:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Search failed",
    });
  }
}

/**
 * GET /api/odoo/categories
 * Fetch product categories from Odoo.
 */
async function getOdooCategories(req, res, next) {
  try {
    const { offset = 0, limit = 50 } = req.query;

    const result = await productService.getCategories({
      offset,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error fetching Odoo categories:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch categories",
    });
  }
}

module.exports = {
  getOdooProducts,
  getOdooProductById,
  searchOdooProducts,
  getOdooCategories,
};
