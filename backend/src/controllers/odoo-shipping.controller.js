const shippingService = require("../services/odoo/shipping.service");

/**
 * GET /api/shipping
 * List shipments with pagination and filtering.
 * Query params: offset, limit, customerId, state, origin, search, provider, trackingNumber
 */
async function getShipments(req, res, next) {
  try {
    const {
      offset = 0,
      limit = 20,
      customerId,
      state,
      origin,
      search,
      provider,
      trackingNumber,
    } = req.query;

    const result = await shippingService.getShipments({
      offset,
      limit,
      customerId,
      state,
      origin,
      search,
      provider,
      trackingNumber,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error fetching shipments:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch shipments",
    });
  }
}

/**
 * GET /api/shipping/:id
 * Get shipment by ID with full details.
 */
async function getShipment(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Shipment ID is required",
      });
    }

    const shipment = await shippingService.getShipmentById(id);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: shipment,
    });
  } catch (err) {
    console.error("Error fetching shipment:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch shipment",
    });
  }
}

/**
 * POST /api/shipping
 * Create shipment from sales order.
 * Body: { salesOrderId }
 */
async function createShipment(req, res, next) {
  try {
    const { salesOrderId } = req.body;

    if (!salesOrderId) {
      return res.status(400).json({
        success: false,
        error: "Sales order ID is required",
      });
    }

    const shipment = await shippingService.createShipment({ salesOrderId });

    res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      data: shipment,
    });
  } catch (err) {
    console.error("Error creating shipment:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    if (err.message && err.message.includes("must be confirmed")) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create shipment",
    });
  }
}

/**
 * POST /api/shipping/:id/confirm
 * Confirm shipment (prepare for shipping).
 */
async function confirmShipment(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Shipment ID is required",
      });
    }

    const shipment = await shippingService.confirmShipment(id);

    res.status(200).json({
      success: true,
      message: "Shipment confirmed successfully",
      data: shipment,
    });
  } catch (err) {
    console.error("Error confirming shipment:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    if (err.message && err.message.includes("cannot be confirmed")) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to confirm shipment",
    });
  }
}

/**
 * POST /api/shipping/:id/link-provider
 * Link shipment to shipping provider.
 * Body: { provider, trackingNumber }
 */
async function linkProvider(req, res, next) {
  try {
    const { id } = req.params;
    const { provider, trackingNumber } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Shipment ID is required",
      });
    }

    if (!provider || !trackingNumber) {
      return res.status(400).json({
        success: false,
        error: "Provider and tracking number are required",
      });
    }

    const shipment = await shippingService.linkProvider(id, { provider, trackingNumber });

    res.status(200).json({
      success: true,
      message: "Provider linked successfully",
      data: shipment,
    });
  } catch (err) {
    console.error("Error linking provider:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to link provider",
    });
  }
}

/**
 * GET /api/shipping/:id/tracking
 * Get tracking information from provider.
 * Query params: provider (optional, defaults to shipment's provider)
 */
async function getTrackingInfo(req, res, next) {
  try {
    const { id } = req.params;
    const { provider } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Shipment ID is required",
      });
    }

    const tracking = await shippingService.getTrackingInfo(id, provider);

    res.status(200).json({
      success: true,
      data: tracking,
    });
  } catch (err) {
    console.error("Error fetching tracking info:", err);

    if (err.message && (err.message.includes("not found") || err.message.includes("no tracking"))) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch tracking info",
    });
  }
}

/**
 * GET /api/shipping/:id/courier-status
 * Get courier status from provider.
 * Query params: provider (optional)
 */
async function getCourierStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { provider } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Shipment ID is required",
      });
    }

    const status = await shippingService.getCourierStatus(id, provider);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    console.error("Error fetching courier status:", err);

    if (err.message && (err.message.includes("not found") || err.message.includes("no tracking"))) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch courier status",
    });
  }
}

/**
 * GET /api/shipping/:id/label
 * Get shipping label from provider.
 * Query params: provider (optional), format (pdf, thermal, etc.)
 * Returns: PDF as file download or base64 JSON
 */
async function getShippingLabel(req, res, next) {
  try {
    const { id } = req.params;
    const { provider, format = "json" } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Shipment ID is required",
      });
    }

    const label = await shippingService.getShippingLabel(id, provider);

    // If format is pdf and label.labelPdf exists, download as file
    if (format === "pdf" && label.labelPdf) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${label.shipmentName}_label.pdf"`);
      return res.send(Buffer.from(label.labelPdf, "base64"));
    }

    // Otherwise return JSON response
    res.status(200).json({
      success: true,
      data: label,
    });
  } catch (err) {
    console.error("Error fetching label:", err);

    if (err.message && (err.message.includes("not found") || err.message.includes("no tracking"))) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to generate label",
    });
  }
}

/**
 * GET /api/shipping/:id/delivery-estimate
 * Get expected delivery date from provider.
 * Query params: provider (optional)
 */
async function getExpectedDelivery(req, res, next) {
  try {
    const { id } = req.params;
    const { provider } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Shipment ID is required",
      });
    }

    const estimate = await shippingService.getExpectedDelivery(id, provider);

    res.status(200).json({
      success: true,
      data: estimate,
    });
  } catch (err) {
    console.error("Error fetching delivery estimate:", err);

    if (err.message && (err.message.includes("not found") || err.message.includes("no tracking"))) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch delivery estimate",
    });
  }
}

/**
 * POST /api/shipping/:id/cancel
 * Cancel shipment.
 */
async function cancelShipment(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Shipment ID is required",
      });
    }

    const shipment = await shippingService.cancelShipment(id);

    res.status(200).json({
      success: true,
      message: "Shipment cancelled successfully",
      data: shipment,
    });
  } catch (err) {
    console.error("Error cancelling shipment:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    if (err.message && (err.message.includes("Cannot cancel") || err.message.includes("cannot cancel"))) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to cancel shipment",
    });
  }
}

module.exports = {
  getShipments,
  getShipment,
  createShipment,
  confirmShipment,
  linkProvider,
  getTrackingInfo,
  getCourierStatus,
  getShippingLabel,
  getExpectedDelivery,
  cancelShipment,
};
