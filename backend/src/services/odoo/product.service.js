const authService = require("./auth.service");

const ANTARIYA_META_PREFIX = "__ANTARIYA_META__::";

function parseAntariyaMetadata(rawDescriptionSale) {
  if (typeof rawDescriptionSale !== "string") {
    return {};
  }

  if (!rawDescriptionSale.startsWith(ANTARIYA_META_PREFIX)) {
    return {};
  }

  try {
    return JSON.parse(rawDescriptionSale.slice(ANTARIYA_META_PREFIX.length)) || {};
  } catch {
    return {};
  }
}

function buildAntariyaMetadataText(metadata = {}) {
  return `${ANTARIYA_META_PREFIX}${JSON.stringify({
    dealerId: metadata.dealerId || null,
    dealerName: metadata.dealerName || null,
    dealerEmail: metadata.dealerEmail || null,
    imageUrls: Array.isArray(metadata.imageUrls) ? metadata.imageUrls : [],
    customizable: Boolean(metadata.customizable),
    fileDownloadLink: metadata.fileDownloadLink || null,
    galleryImages: Array.isArray(metadata.galleryImages) ? metadata.galleryImages : [],
  })}`;
}

function normalizeOdooImageList(metadata = {}, odooProduct = null) {
  const candidateImages = [
    ...(Array.isArray(metadata.imageUrls) ? metadata.imageUrls : []),
    ...(Array.isArray(metadata.galleryImages) ? metadata.galleryImages : []),
  ]
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  const binaryImages = [];

  if (odooProduct?.image_1920) binaryImages.push(odooProduct.image_1920);
  if (odooProduct?.image_1024) binaryImages.push(odooProduct.image_1024);
  if (odooProduct?.image_512) binaryImages.push(odooProduct.image_512);

  return Array.from(new Set([...candidateImages, ...binaryImages]));
}

function decodeImageForOdoo(imageValue) {
  if (typeof imageValue !== "string") {
    return null;
  }

  const trimmed = imageValue.trim();
  if (!trimmed.startsWith("data:")) {
    return null;
  }

  const base64Index = trimmed.indexOf("base64,");
  if (base64Index === -1) {
    return null;
  }

  return trimmed.slice(base64Index + 7);
}

async function findOrCreateCategory(categoryName) {
  const normalizedCategory = String(categoryName || "").trim();

  if (!normalizedCategory) {
    return null;
  }

  const client = await authService.getClient();
  const categoryIds = await client.call("product.category", "search", [["name", "=", normalizedCategory]], { limit: 1 });

  if (Array.isArray(categoryIds) && categoryIds.length > 0) {
    return categoryIds[0];
  }

  return client.call("product.category", "create", [{ name: normalizedCategory }]);
}

/**
 * Transform raw Odoo product data to API response format.
 * Safely handles missing fields.
 */
function transformProduct(odooProduct) {
  if (!odooProduct) return null;

  const metadata = parseAntariyaMetadata(odooProduct.description_sale);
  const galleryImages = normalizeOdooImageList(metadata, odooProduct);
  const primaryImage = metadata.imageUrls?.find((item) => typeof item === "string" && item.trim().length > 0)
    || galleryImages[0]
    || null;

  const images = galleryImages.length > 0 ? galleryImages : [];

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
    dealerId: metadata.dealerId || null,
    dealerName: metadata.dealerName || null,
    dealerEmail: metadata.dealerEmail || null,
    customizable: Boolean(metadata.customizable),
    fileDownloadLink: metadata.fileDownloadLink || null,
    image: primaryImage || (galleryImages.length > 0 ? galleryImages[0] : null),
    galleryImages,
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

    if (filters?.dealerId) {
      domain.push(["description_sale", "ilike", `"dealerId":"${String(filters.dealerId)}"`]);
    }

    if (filters?.customizable !== undefined) {
      domain.push(["description_sale", "ilike", `"customizable":${filters.customizable === true || filters.customizable === "true"}`]);
    }

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

async function getProductByName(productName) {
  if (!productName) {
    return null;
  }

  const client = await authService.getClient();

  try {
    const productIds = await client.call("product.product", "search", [
      [["name", "=", String(productName).trim()]],
      { limit: 1 },
    ]);

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return null;
    }

    const rawProducts = await client.call("product.product", "read", [productIds, [
      "id",
      "name",
      "default_code",
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
    ]]);

    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      return null;
    }

    return transformProduct(rawProducts[0]);
  } catch (err) {
    throw new Error(`Failed to fetch product by name from Odoo: ${err.message}`);
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

async function getProductsByIds(productIds) {
  const normalizedIds = Array.isArray(productIds)
    ? [...new Set(productIds.map((productId) => parseInt(productId, 10)).filter((productId) => Number.isInteger(productId) && productId > 0))]
    : [];

  if (normalizedIds.length === 0) {
    return [];
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

    const rawProducts = await client.call("product.product", "read", [normalizedIds, fields]);

    if (!Array.isArray(rawProducts)) {
      return [];
    }

    return rawProducts.map(transformProduct).filter(Boolean);
  } catch (err) {
    throw new Error(`Failed to fetch products by ids from Odoo: ${err.message}`);
  }
}

async function getCatalogSummary() {
  const client = await authService.getClient();

  try {
    const [productCount, categoriesResult, productsResult] = await Promise.all([
      client.call("product.product", "search_count", [["active", "=", true]]),
      getCategories({ limit: 1000 }),
      getProducts({ limit: 1000, filters: { active: true } }),
    ]);

    const uniqueDealers = new Set(
      (productsResult.products || [])
        .map((product) => product.dealerId)
        .filter((dealerId) => typeof dealerId === "string" && dealerId.trim().length > 0)
    );

    return {
      products: Number(productCount || 0),
      dealers: uniqueDealers.size,
      categories: Array.isArray(categoriesResult.categories)
        ? categoriesResult.categories.filter((category) => typeof category?.name === "string" && category.name.trim().length > 0).length
        : 0,
    };
  } catch (err) {
    throw new Error(`Failed to build catalog summary: ${err.message}`);
  }
}

async function createProduct(data) {
  const client = await authService.getClient();

  const categoryId = await findOrCreateCategory(data.category);
  const primaryImage = Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : data.image;

  const productValues = {
    name: String(data.name || "").trim(),
    description: String(data.description || "").trim(),
    description_sale: buildAntariyaMetadataText({
      dealerId: data.dealerId,
      dealerName: data.dealerName,
      dealerEmail: data.dealerEmail,
      imageUrls: data.images || (primaryImage ? [primaryImage] : []),
      galleryImages: data.galleryImages || data.images || (primaryImage ? [primaryImage] : []),
      customizable: Boolean(data.customizable),
      fileDownloadLink: data.fileDownloadLink || null,
    }),
    list_price: Number(data.price || 0),
    categ_id: categoryId || undefined,
    barcode: String(data.sku || "").trim() || undefined,
    type: "product",
    active: true,
  };

  const imageBase64 = decodeImageForOdoo(primaryImage);
  if (imageBase64) {
    productValues.image_1920 = imageBase64;
  }

  const createdId = await client.call("product.product", "create", [productValues]);

  return createdId ? getProductById(createdId) : null;
}

async function updateProduct(productId, data) {
  const client = await authService.getClient();
  const existing = await getProductById(productId);

  if (!existing) {
    throw new Error("Product not found");
  }

  const updateValues = {};

  if (data.name !== undefined) updateValues.name = String(data.name || "").trim();
  if (data.description !== undefined) updateValues.description = String(data.description || "").trim();
  if (data.price !== undefined) updateValues.list_price = Number(data.price || 0);
  if (data.category !== undefined) {
    updateValues.categ_id = await findOrCreateCategory(data.category);
  }
  if (data.sku !== undefined) updateValues.barcode = String(data.sku || "").trim();

  const imageUrls = Array.isArray(data.images)
    ? data.images
    : Array.isArray(data.galleryImages)
      ? data.galleryImages
      : data.image
        ? [data.image]
        : existing.images || [];

  const metadata = {
    dealerId: data.dealerId || existing.dealerId,
    dealerName: data.dealerName || existing.dealerName,
    dealerEmail: data.dealerEmail || existing.dealerEmail,
    imageUrls,
    galleryImages: imageUrls,
    customizable: typeof data.customizable === "boolean" ? data.customizable : existing.customizable,
    fileDownloadLink: data.fileDownloadLink !== undefined ? data.fileDownloadLink : existing.fileDownloadLink,
  };
  updateValues.description_sale = buildAntariyaMetadataText(metadata);

  const primaryImage = imageUrls[0];
  const imageBase64 = decodeImageForOdoo(primaryImage);
  if (imageBase64) {
    updateValues.image_1920 = imageBase64;
  }

  await client.call("product.product", "write", [[parseInt(productId, 10)], updateValues]);
  return getProductById(productId);
}

async function deleteProduct(productId) {
  const client = await authService.getClient();
  const existing = await getProductById(productId);

  if (!existing) {
    return false;
  }

  await client.call("product.product", "unlink", [[parseInt(productId, 10)]]);
  return true;
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
  getProductByName,
  searchProducts,
  getProductsByIds,
  getCatalogSummary,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  transformProduct,
  buildSearchDomain,
  buildFilterDomain,
  parseAntariyaMetadata,
  buildAntariyaMetadataText,
};
