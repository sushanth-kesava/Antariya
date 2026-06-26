const authService = require("./auth.service");

/**
 * Transform raw Odoo product data to API response format.
 * Safely handles missing fields.
 */
function transformProduct(odooProduct) {
  if (!odooProduct) return null;

  const images = Array.isArray(odooProduct.image_1920) ? [odooProduct.image_1920] : [];
  if (odooProduct.image_1024) images.push(odooProduct.image_1024);
  if (odooProduct.image_512) images.push(odooProduct.image_512);

  return {
    id: odooProduct.id,
    name: odooProduct.name || "",
    sku: odooProduct.default_code || odooProduct.sku || "",
    description: odooProduct.description || odooProduct.description_sale || "",
    category: odooProduct.categ_id ? odooProduct.categ_id[1] : null,
    categoryId: odooProduct.categ_id ? odooProduct.categ_id[0] : null,
    price: parseFloat(odooProduct.list_price || 0),
    cost: parseFloat(odooProduct.standard_price || 0),
    images: images.filter(Boolean),
    variants: odooProduct.product_variant_ids || [],
    barcode: odooProduct.barcode || "",
    active: odooProduct.active !== false,
    type: odooProduct.type || "product",
    uom: odooProduct.uom_id ? odooProduct.uom_id[1] : "Unit",
  };
}

/**
 * Build search domain for Odoo.
 * Searches across name, SKU, barcode, and description.
 */
function buildSearchDomain(query) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const q = query.trim();
  return [
    "|",
    "|",
    "|",
    ["name", "ilike", q],
    ["default_code", "ilike", q],
    ["barcode", "ilike", q],
    ["description", "ilike", q],
  ];
}

/**
 * Build filter domain for Odoo.
 * Supports filtering by category and price range.
 */
function buildFilterDomain(filters = {}) {
  const domain = [];

  if (filters.categoryId) {
    domain.push(["categ_id", "=", parseInt(filters.categoryId)]);
  }

  if (filters.minPrice !== undefined) {
    domain.push(["list_price", ">=", parseFloat(filters.minPrice)]);
  }

  if (filters.maxPrice !== undefined) {
    domain.push(["list_price", "<=", parseFloat(filters.maxPrice)]);
  }

  if (filters.active !== undefined) {
    domain.push(["active", "=", filters.active === "true" || filters.active === true]);
  }

  return domain;
}

/**
 * Fetch products from Odoo with pagination, search, and filtering.
 */
async function getProducts(options = {}) {
  const {
    offset = 0,
    limit = 20,
    search = "",
    filters = {},
    sort = "id",
  } = options;

  // Validate pagination params
  const pageOffset = Math.max(0, parseInt(offset) || 0);
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const client = await authService.getClient();

  try {
    // Build domain (search + filters)
    let domain = [];

    // Add search domain
    const searchDomain = buildSearchDomain(search);
    domain = domain.concat(searchDomain);

    // Add filter domain
    const filterDomain = buildFilterDomain(filters);
    domain = domain.concat(filterDomain);

    // Always filter active products
    domain.push(["active", "=", true]);

    // Get total count
    const count = await client.call("product.product", "search_count", [domain]);

    // Fetch products
    const productIds = await client.call("product.product", "search", [
      domain,
      {
        limit: pageLimit,
        offset: pageOffset,
        order: sort,
      },
    ]);

    if (!productIds || productIds.length === 0) {
      return {
        products: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    // Read full product details
    const fields = [
      "id",
      "name",
      "default_code",
      "sku",
      "description",
      "description_sale",
      "list_price",
      "standard_price",
      "categ_id",
      "barcode",
      "active",
      "type",
      "uom_id",
      "image_1920",
      "image_1024",
      "image_512",
      "product_variant_ids",
    ];

    const rawProducts = await client.call("product.product", "read", [productIds, fields]);

    if (!Array.isArray(rawProducts)) {
      return {
        products: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const products = rawProducts.map(transformProduct).filter(Boolean);

    return {
      products,
      total: count,
      offset: pageOffset,
      limit: pageLimit,
      hasMore: pageOffset + pageLimit < count,
    };
  } catch (err) {
    throw new Error(`Failed to fetch products from Odoo: ${err.message}`);
  }
}

/**
 * Fetch a single product by ID.
 */
async function getProductById(productId) {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  const client = await authService.getClient();

  try {
    const fields = [
      "id",
      "name",
      "default_code",
      "sku",
      "description",
      "description_sale",
      "list_price",
      "standard_price",
      "categ_id",
      "barcode",
      "active",
      "type",
      "uom_id",
      "image_1920",
      "image_1024",
      "image_512",
      "product_variant_ids",
    ];

    const results = await client.call("product.product", "read", [
      [parseInt(productId)],
      fields,
    ]);

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    return transformProduct(results[0]);
  } catch (err) {
    throw new Error(`Failed to fetch product from Odoo: ${err.message}`);
  }
}

/**
 * Search products by query string.
 * Uses pagination and returns structured results.
 */
async function searchProducts(query, options = {}) {
  if (!query || query.trim().length === 0) {
    throw new Error("Search query is required");
  }

  const {
    offset = 0,
    limit = 20,
  } = options;

  const pageOffset = Math.max(0, parseInt(offset) || 0);
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const client = await authService.getClient();

  try {
    const searchDomain = buildSearchDomain(query);
    searchDomain.push(["active", "=", true]);

    // Get total count
    const count = await client.call("product.product", "search_count", [searchDomain]);

    // Fetch product IDs
    const productIds = await client.call("product.product", "search", [
      searchDomain,
      {
        limit: pageLimit,
        offset: pageOffset,
        order: "name",
      },
    ]);

    if (!productIds || productIds.length === 0) {
      return {
        products: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    // Read full product details
    const fields = [
      "id",
      "name",
      "default_code",
      "sku",
      "description",
      "description_sale",
      "list_price",
      "standard_price",
      "categ_id",
      "barcode",
      "active",
      "type",
      "uom_id",
      "image_1920",
      "image_1024",
      "image_512",
      "product_variant_ids",
    ];

    const rawProducts = await client.call("product.product", "read", [productIds, fields]);

    if (!Array.isArray(rawProducts)) {
      return {
        products: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const products = rawProducts.map(transformProduct).filter(Boolean);

    return {
      products,
      total: count,
      offset: pageOffset,
      limit: pageLimit,
      hasMore: pageOffset + pageLimit < count,
    };
  } catch (err) {
    throw new Error(`Search failed: ${err.message}`);
  }
}

/**
 * Fetch product categories from Odoo.
 */
async function getCategories(options = {}) {
  const { offset = 0, limit = 50 } = options;

  const pageOffset = Math.max(0, parseInt(offset) || 0);
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));

  const client = await authService.getClient();

  try {
    const categoryIds = await client.call("product.category", "search", [
      [],
      {
        limit: pageLimit,
        offset: pageOffset,
        order: "name",
      },
    ]);

    if (!categoryIds || categoryIds.length === 0) {
      return { categories: [] };
    }

    const categories = await client.call("product.category", "read", [
      categoryIds,
      ["id", "name", "parent_id"],
    ]);

    return {
      categories: Array.isArray(categories) ? categories : [],
    };
  } catch (err) {
    throw new Error(`Failed to fetch categories: ${err.message}`);
  }
}

module.exports = {
  getProducts,
  getProductById,
  searchProducts,
  getCategories,
  transformProduct,
  buildSearchDomain,
  buildFilterDomain,
};
