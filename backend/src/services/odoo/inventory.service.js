const authService = require("./auth.service");

/**
 * Transform raw Odoo inventory/stock data to API response format.
 * Safely handles missing fields and aggregates quantities.
 */
function transformInventory(data) {
  if (!data) return null;

  return {
    sku: data.sku || data.default_code || "",
    productId: data.product_id,
    productName: data.product_name || "",
    availableQuantity: parseFloat(data.available_quantity || 0),
    reservedQuantity: parseFloat(data.reserved_quantity || 0),
    incomingQuantity: parseFloat(data.incoming_quantity || 0),
    outgoingQuantity: parseFloat(data.outgoing_quantity || 0),
    warehouseId: data.warehouse_id,
    warehouseName: data.warehouse_name || "",
    location: data.location_name || "",
    locationId: data.location_id,
    unit: data.unit_name || "Unit",
    lastUpdate: data.last_update || new Date().toISOString(),
  };
}

/**
 * Fetch all inventory records with pagination.
 * Returns inventory across all warehouses/locations.
 */
async function getAllInventory(options = {}) {
  const {
    offset = 0,
    limit = 50,
  } = options;

  const pageOffset = Math.max(0, parseInt(offset) || 0);
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));

  const client = await authService.getClient();

  try {
    // Query stock.quant for inventory
    const domain = [["quantity", ">", 0]]; // Only non-zero stock

    const count = await client.call("stock.quant", "search_count", [domain]);

    const quantIds = await client.call("stock.quant", "search", [
      domain,
      {
        limit: pageLimit,
        offset: pageOffset,
        order: "product_id",
      },
    ]);

    if (!quantIds || quantIds.length === 0) {
      return {
        inventory: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const fields = [
      "id",
      "product_id",
      "product_id.default_code",
      "product_id.name",
      "location_id",
      "location_id.name",
      "warehouse_id",
      "warehouse_id.name",
      "quantity",
      "reserved_quantity",
      "incoming_quantity",
      "outgoing_quantity",
      "product_uom_id",
      "product_uom_id.name",
    ];

    const quants = await client.call("stock.quant", "read", [quantIds, fields]);

    if (!Array.isArray(quants)) {
      return {
        inventory: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    // Transform quants to inventory format
    const inventory = quants
      .map((quant) => ({
        sku: quant["product_id.default_code"] || "",
        productId: quant.product_id ? quant.product_id[0] : null,
        productName: quant.product_id ? quant.product_id[1] : "",
        availableQuantity: parseFloat(quant.quantity || 0),
        reservedQuantity: parseFloat(quant.reserved_quantity || 0),
        incomingQuantity: parseFloat(quant.incoming_quantity || 0),
        outgoingQuantity: parseFloat(quant.outgoing_quantity || 0),
        warehouseId: quant.warehouse_id ? quant.warehouse_id[0] : null,
        warehouseName: quant.warehouse_id ? quant.warehouse_id[1] : "",
        location: quant.location_id ? quant.location_id[1] : "",
        locationId: quant.location_id ? quant.location_id[0] : null,
        unit: quant.product_uom_id ? quant.product_uom_id[1] : "Unit",
      }))
      .filter(Boolean);

    return {
      inventory,
      total: count,
      offset: pageOffset,
      limit: pageLimit,
      hasMore: pageOffset + pageLimit < count,
    };
  } catch (err) {
    throw new Error(`Failed to fetch inventory: ${err.message}`);
  }
}

/**
 * Fetch inventory by product SKU.
 * Returns inventory across all warehouses for this SKU.
 */
async function getInventoryBySku(sku) {
  if (!sku || sku.trim().length === 0) {
    throw new Error("SKU is required");
  }

  const client = await authService.getClient();

  try {
    // Find product by SKU (default_code)
    const productIds = await client.call("product.product", "search", [
      [["default_code", "=", sku.trim()]],
      { limit: 1 },
    ]);

    if (!productIds || productIds.length === 0) {
      return null;
    }

    const productId = productIds[0];

    // Find all stock.quant records for this product
    const quantIds = await client.call("stock.quant", "search", [
      [["product_id", "=", productId]],
      { order: "warehouse_id" },
    ]);

    if (!quantIds || quantIds.length === 0) {
      return [];
    }

    const fields = [
      "id",
      "product_id",
      "product_id.default_code",
      "product_id.name",
      "location_id",
      "location_id.name",
      "warehouse_id",
      "warehouse_id.name",
      "quantity",
      "reserved_quantity",
      "incoming_quantity",
      "outgoing_quantity",
      "product_uom_id",
      "product_uom_id.name",
    ];

    const quants = await client.call("stock.quant", "read", [quantIds, fields]);

    if (!Array.isArray(quants)) {
      return [];
    }

    return quants
      .map((quant) => ({
        sku: quant["product_id.default_code"] || "",
        productId: quant.product_id ? quant.product_id[0] : null,
        productName: quant.product_id ? quant.product_id[1] : "",
        availableQuantity: parseFloat(quant.quantity || 0),
        reservedQuantity: parseFloat(quant.reserved_quantity || 0),
        incomingQuantity: parseFloat(quant.incoming_quantity || 0),
        outgoingQuantity: parseFloat(quant.outgoing_quantity || 0),
        warehouseId: quant.warehouse_id ? quant.warehouse_id[0] : null,
        warehouseName: quant.warehouse_id ? quant.warehouse_id[1] : "",
        location: quant.location_id ? quant.location_id[1] : "",
        locationId: quant.location_id ? quant.location_id[0] : null,
        unit: quant.product_uom_id ? quant.product_uom_id[1] : "Unit",
      }))
      .filter(Boolean);
  } catch (err) {
    throw new Error(`Failed to fetch inventory by SKU: ${err.message}`);
  }
}

/**
 * Fetch inventory by product ID.
 * Returns inventory across all warehouses for this product.
 */
async function getInventoryByProductId(productId) {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify product exists
    const productCheck = await client.call("product.product", "read", [
      [parseInt(productId)],
      ["id", "default_code"],
    ]);

    if (!Array.isArray(productCheck) || productCheck.length === 0) {
      return null;
    }

    // Find all stock.quant records for this product
    const quantIds = await client.call("stock.quant", "search", [
      [["product_id", "=", parseInt(productId)]],
      { order: "warehouse_id" },
    ]);

    if (!quantIds || quantIds.length === 0) {
      return [];
    }

    const fields = [
      "id",
      "product_id",
      "product_id.default_code",
      "product_id.name",
      "location_id",
      "location_id.name",
      "warehouse_id",
      "warehouse_id.name",
      "quantity",
      "reserved_quantity",
      "incoming_quantity",
      "outgoing_quantity",
      "product_uom_id",
      "product_uom_id.name",
    ];

    const quants = await client.call("stock.quant", "read", [quantIds, fields]);

    if (!Array.isArray(quants)) {
      return [];
    }

    return quants
      .map((quant) => ({
        sku: quant["product_id.default_code"] || "",
        productId: quant.product_id ? quant.product_id[0] : null,
        productName: quant.product_id ? quant.product_id[1] : "",
        availableQuantity: parseFloat(quant.quantity || 0),
        reservedQuantity: parseFloat(quant.reserved_quantity || 0),
        incomingQuantity: parseFloat(quant.incoming_quantity || 0),
        outgoingQuantity: parseFloat(quant.outgoing_quantity || 0),
        warehouseId: quant.warehouse_id ? quant.warehouse_id[0] : null,
        warehouseName: quant.warehouse_id ? quant.warehouse_id[1] : "",
        location: quant.location_id ? quant.location_id[1] : "",
        locationId: quant.location_id ? quant.location_id[0] : null,
        unit: quant.product_uom_id ? quant.product_uom_id[1] : "Unit",
      }))
      .filter(Boolean);
  } catch (err) {
    throw new Error(`Failed to fetch inventory by product ID: ${err.message}`);
  }
}

/**
 * Fetch warehouse summary for a product.
 * Returns total available/reserved/incoming/outgoing across all locations.
 */
async function getWarehouseSummary(productId) {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  const inventory = await getInventoryByProductId(productId);

  if (!Array.isArray(inventory) || inventory.length === 0) {
    return null;
  }

  // Group by warehouse
  const warehouses = {};
  inventory.forEach((item) => {
    const warehouseId = item.warehouseId || "default";
    if (!warehouses[warehouseId]) {
      warehouses[warehouseId] = {
        warehouseId,
        warehouseName: item.warehouseName,
        sku: item.sku,
        productId: item.productId,
        productName: item.productName,
        totalAvailable: 0,
        totalReserved: 0,
        totalIncoming: 0,
        totalOutgoing: 0,
        locations: [],
      };
    }

    warehouses[warehouseId].totalAvailable += item.availableQuantity;
    warehouses[warehouseId].totalReserved += item.reservedQuantity;
    warehouses[warehouseId].totalIncoming += item.incomingQuantity;
    warehouses[warehouseId].totalOutgoing += item.outgoingQuantity;
    warehouses[warehouseId].locations.push({
      location: item.location,
      locationId: item.locationId,
      available: item.availableQuantity,
      reserved: item.reservedQuantity,
      incoming: item.incomingQuantity,
      outgoing: item.outgoingQuantity,
    });
  });

  return Object.values(warehouses);
}

module.exports = {
  getAllInventory,
  getInventoryBySku,
  getInventoryByProductId,
  getWarehouseSummary,
  transformInventory,
};
