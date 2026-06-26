const authService = require("./auth.service");
const ShippingProviderManager = require("../shipping");

/**
 * Odoo Shipping Service
 * Manages shipments (stock.picking) and integrates with shipping providers.
 * Supports: Shipment creation, tracking, labels, courier status, delivery estimates.
 */

/**
 * Transform raw Odoo stock.picking to API response format.
 */
function transformShipment(oodoShipment) {
  if (!oodoShipment) return null;

  return {
    id: oodoShipment.id,
    name: oodoShipment.name || "",
    origin: oodoShipment.origin || "", // Link to sales order
    pickingType: oodoShipment.picking_type_id ? oodoShipment.picking_type_id[1] : "outgoing",
    partnerName: oodoShipment.partner_id ? oodoShipment.partner_id[1] : "",
    customerId: oodoShipment.partner_id ? oodoShipment.partner_id[0] : null,
    state: oodoShipment.state || "draft", // draft, confirmed, assigned, done, cancel
    pickingState: oodoShipment.state,
    scheduledDate: oodoShipment.scheduled_date,
    date: oodoShipment.date,
    address: {
      street: oodoShipment.partner_id ? oodoShipment.partner_id[2] || "" : "",
      city: oodoShipment.partner_id ? oodoShipment.partner_id[3] || "" : "",
      state: oodoShipment.partner_id ? oodoShipment.partner_id[4] || "" : "",
      zip: oodoShipment.partner_id ? oodoShipment.partner_id[5] || "" : "",
      country: oodoShipment.partner_id ? oodoShipment.partner_id[6] || "" : "",
    },
    lineItems: oodoShipment.move_ids_without_package || [],
    weight: parseFloat(oodoShipment.shipping_weight || 0),
    shippingProvider: oodoShipment.shipping_provider || null,
    trackingNumber: oodoShipment.carrier_tracking_ref || null,
    courierName: oodoShipment.carrier_id ? oodoShipment.carrier_id[1] : null,
    expectedDeliveryDate: oodoShipment.expected_delivery_date || null,
  };
}

/**
 * Get all shipments with pagination and filtering.
 * @param {object} options - Query options
 * @returns {Promise<{shipments, total, offset, limit, hasMore}>}
 */
async function getShipments(options = {}) {
  const {
    offset = 0,
    limit = 20,
    customerId,
    state,
    origin,
    search,
    provider,
    trackingNumber,
  } = options;

  const pageOffset = Math.max(0, parseInt(offset) || 0);
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const client = await authService.getClient();

  try {
    // Build search domain
    let domain = [["picking_type_id.code", "=", "outgoing"]]; // Only outgoing shipments

    if (customerId) {
      domain.push(["partner_id", "=", parseInt(customerId)]);
    }

    if (state) {
      domain.push(["state", "=", state]);
    }

    if (origin) {
      domain.push(["origin", "ilike", origin]);
    }

    if (search && search.trim().length > 0) {
      domain.push(["|", ["name", "ilike", search], ["origin", "ilike", search]]);
    }

    if (provider) {
      domain.push(["shipping_provider", "=", provider]);
    }

    if (trackingNumber) {
      domain.push(["carrier_tracking_ref", "ilike", trackingNumber]);
    }

    // Get total count
    const count = await client.call("stock.picking", "search_count", [domain]);

    // Fetch shipment IDs
    const shipmentIds = await client.call("stock.picking", "search", [
      domain,
      {
        limit: pageLimit,
        offset: pageOffset,
        order: "scheduled_date desc",
      },
    ]);

    if (!shipmentIds || shipmentIds.length === 0) {
      return {
        shipments: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const fields = [
      "id",
      "name",
      "origin",
      "picking_type_id",
      "partner_id",
      "state",
      "scheduled_date",
      "date",
      "move_ids_without_package",
      "shipping_weight",
      "shipping_provider",
      "carrier_tracking_ref",
      "carrier_id",
      "expected_delivery_date",
    ];

    const shipments = await client.call("stock.picking", "read", [shipmentIds, fields]);

    if (!Array.isArray(shipments)) {
      return {
        shipments: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const transformed = shipments.map(transformShipment).filter(Boolean);

    return {
      shipments: transformed,
      total: count,
      offset: pageOffset,
      limit: pageLimit,
      hasMore: pageOffset + pageLimit < count,
    };
  } catch (err) {
    throw new Error(`Failed to fetch shipments: ${err.message}`);
  }
}

/**
 * Get shipment by ID with full details.
 */
async function getShipmentById(shipmentId) {
  if (!shipmentId) {
    throw new Error("Shipment ID is required");
  }

  const client = await authService.getClient();

  try {
    const fields = [
      "id",
      "name",
      "origin",
      "picking_type_id",
      "partner_id",
      "state",
      "scheduled_date",
      "date",
      "move_ids_without_package",
      "shipping_weight",
      "shipping_provider",
      "carrier_tracking_ref",
      "carrier_id",
      "expected_delivery_date",
    ];

    const results = await client.call("stock.picking", "read", [[parseInt(shipmentId)], fields]);

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    return transformShipment(results[0]);
  } catch (err) {
    throw new Error(`Failed to fetch shipment: ${err.message}`);
  }
}

/**
 * Create shipment from sales order.
 * Generates stock.picking from sale.order.
 */
async function createShipment(data) {
  if (!data.salesOrderId) {
    throw new Error("Sales order ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify SO exists
    const soResults = await client.call("sale.order", "read", [
      [parseInt(data.salesOrderId)],
      ["id", "state"],
    ]);

    if (!Array.isArray(soResults) || soResults.length === 0) {
      throw new Error("Sales order not found");
    }

    const so = soResults[0];
    if (so.state !== "sale") {
      throw new Error("Sales order must be confirmed before creating shipment");
    }

    // Get picking associated with SO
    const pickingResults = await client.call("stock.picking", "search", [
      [["origin", "=", so.name]],
    ]);

    if (!pickingResults || pickingResults.length === 0) {
      throw new Error("No shipment found for this sales order");
    }

    const pickingId = pickingResults[0];
    const shipment = await getShipmentById(pickingId);

    return shipment;
  } catch (err) {
    throw new Error(`Failed to create shipment: ${err.message}`);
  }
}

/**
 * Confirm shipment (prepare for shipping).
 */
async function confirmShipment(shipmentId) {
  if (!shipmentId) {
    throw new Error("Shipment ID is required");
  }

  const client = await authService.getClient();

  try {
    const shipment = await getShipmentById(shipmentId);
    if (!shipment) {
      throw new Error("Shipment not found");
    }

    if (shipment.state !== "draft") {
      throw new Error(`Shipment cannot be confirmed. Current state: ${shipment.state}`);
    }

    // Confirm shipment
    await client.call("stock.picking", "action_confirm", [[parseInt(shipmentId)]]);

    return await getShipmentById(shipmentId);
  } catch (err) {
    throw new Error(`Failed to confirm shipment: ${err.message}`);
  }
}

/**
 * Link shipment to shipping provider (save tracking number).
 */
async function linkProvider(shipmentId, data) {
  if (!shipmentId) {
    throw new Error("Shipment ID is required");
  }

  if (!data.provider) {
    throw new Error("Shipping provider is required");
  }

  if (!data.trackingNumber) {
    throw new Error("Tracking number is required");
  }

  const client = await authService.getClient();

  try {
    const shipment = await getShipmentById(shipmentId);
    if (!shipment) {
      throw new Error("Shipment not found");
    }

    // Update shipment with provider info
    await client.call("stock.picking", "write", [
      [parseInt(shipmentId)],
      {
        shipping_provider: data.provider,
        carrier_tracking_ref: data.trackingNumber,
      },
    ]);

    return await getShipmentById(shipmentId);
  } catch (err) {
    throw new Error(`Failed to link provider: ${err.message}`);
  }
}

/**
 * Get tracking information from provider.
 */
async function getTrackingInfo(shipmentId, providerName = null) {
  if (!shipmentId) {
    throw new Error("Shipment ID is required");
  }

  const shipment = await getShipmentById(shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found");
  }

  if (!shipment.trackingNumber) {
    throw new Error("Shipment has no tracking number");
  }

  try {
    const provider = providerName || shipment.shippingProvider || "shiprocket";
    const shippingProvider = ShippingProviderManager.getProvider(provider);

    const tracking = await shippingProvider.getTracking(shipment.trackingNumber);

    return {
      shipmentId: shipmentId,
      shipmentName: shipment.name,
      trackingNumber: shipment.trackingNumber,
      provider: provider,
      ...tracking,
    };
  } catch (err) {
    throw new Error(`Failed to get tracking info: ${err.message}`);
  }
}

/**
 * Get courier status from provider.
 */
async function getCourierStatus(shipmentId, providerName = null) {
  if (!shipmentId) {
    throw new Error("Shipment ID is required");
  }

  const shipment = await getShipmentById(shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found");
  }

  if (!shipment.trackingNumber) {
    throw new Error("Shipment has no tracking number");
  }

  try {
    const provider = providerName || shipment.shippingProvider || "shiprocket";
    const shippingProvider = ShippingProviderManager.getProvider(provider);

    const courierStatus = await shippingProvider.getCourierStatus(shipment.trackingNumber);

    return {
      shipmentId: shipmentId,
      shipmentName: shipment.name,
      trackingNumber: shipment.trackingNumber,
      provider: provider,
      ...courierStatus,
    };
  } catch (err) {
    throw new Error(`Failed to get courier status: ${err.message}`);
  }
}

/**
 * Generate shipping label from provider.
 */
async function getShippingLabel(shipmentId, providerName = null) {
  if (!shipmentId) {
    throw new Error("Shipment ID is required");
  }

  const shipment = await getShipmentById(shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found");
  }

  if (!shipment.trackingNumber) {
    throw new Error("Shipment has no tracking number");
  }

  try {
    const provider = providerName || shipment.shippingProvider || "shiprocket";
    const shippingProvider = ShippingProviderManager.getProvider(provider);

    const label = await shippingProvider.generateLabel(shipment.trackingNumber);

    return {
      shipmentId: shipmentId,
      shipmentName: shipment.name,
      trackingNumber: shipment.trackingNumber,
      provider: provider,
      ...label,
    };
  } catch (err) {
    throw new Error(`Failed to generate label: ${err.message}`);
  }
}

/**
 * Get expected delivery date from provider.
 */
async function getExpectedDelivery(shipmentId, providerName = null) {
  if (!shipmentId) {
    throw new Error("Shipment ID is required");
  }

  const shipment = await getShipmentById(shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found");
  }

  if (!shipment.trackingNumber) {
    throw new Error("Shipment has no tracking number");
  }

  try {
    const provider = providerName || shipment.shippingProvider || "shiprocket";
    const shippingProvider = ShippingProviderManager.getProvider(provider);

    const estimate = await shippingProvider.getDeliveryEstimate(shipment.trackingNumber);

    return {
      shipmentId: shipmentId,
      shipmentName: shipment.name,
      trackingNumber: shipment.trackingNumber,
      provider: provider,
      ...estimate,
    };
  } catch (err) {
    throw new Error(`Failed to get delivery estimate: ${err.message}`);
  }
}

/**
 * Cancel shipment.
 */
async function cancelShipment(shipmentId) {
  if (!shipmentId) {
    throw new Error("Shipment ID is required");
  }

  const client = await authService.getClient();

  try {
    const shipment = await getShipmentById(shipmentId);
    if (!shipment) {
      throw new Error("Shipment not found");
    }

    if (shipment.state === "done") {
      throw new Error("Cannot cancel completed shipment");
    }

    // Cancel shipment
    await client.call("stock.picking", "action_cancel", [[parseInt(shipmentId)]]);

    return await getShipmentById(shipmentId);
  } catch (err) {
    throw new Error(`Failed to cancel shipment: ${err.message}`);
  }
}

module.exports = {
  getShipments,
  getShipmentById,
  createShipment,
  confirmShipment,
  linkProvider,
  getTrackingInfo,
  getCourierStatus,
  getShippingLabel,
  getExpectedDelivery,
  cancelShipment,
  transformShipment,
};
