const purchaseService = require("../services/odoo/purchase.service");

/**
 * POST /api/purchase
 * Create a new purchase order.
 * Body:
 * {
 *   vendorId: (required),
 *   lines: [
 *     { productId, quantity, cost, productName, expectedDelivery },
 *     ...
 *   ],
 *   expectedDelivery: (optional),
 *   notes: (optional),
 *   reference: (optional)
 * }
 */
async function createPurchaseOrder(req, res, next) {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).json({
        success: false,
        error: "Request body is required",
      });
    }

    // Validate PO data
    const validationError = purchaseService.validatePurchaseOrderData(body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError,
      });
    }

    const po = await purchaseService.createPurchaseOrder(body);

    res.status(201).json({
      success: true,
      data: po,
    });
  } catch (err) {
    console.error("Error creating purchase order:", err);

    // Handle validation errors
    if (
      err.message &&
      (err.message.includes("Product not found") ||
        err.message.includes("Vendor not found") ||
        err.message.includes("required") ||
        err.message.includes("greater than"))
    ) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create purchase order",
    });
  }
}

/**
 * GET /api/purchase
 * List all purchase orders with pagination and filtering.
 * Query params: offset, limit, state, vendorId, search
 */
async function listPurchaseOrders(req, res, next) {
  try {
    const { offset = 0, limit = 20, state, vendorId, search } = req.query;

    const result = await purchaseService.listPurchaseOrders({
      offset,
      limit,
      state,
      vendorId,
      search,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error fetching purchase orders:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch purchase orders",
    });
  }
}

/**
 * GET /api/purchase/:id
 * Fetch purchase order by ID.
 */
async function getPurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Purchase order ID is required",
      });
    }

    const po = await purchaseService.getPurchaseOrderById(id);

    if (!po) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: po,
    });
  } catch (err) {
    console.error("Error fetching purchase order:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch purchase order",
    });
  }
}

/**
 * POST /api/purchase/:id/confirm
 * Confirm a purchase order (draft → sent).
 */
async function confirmPurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Purchase order ID is required",
      });
    }

    const po = await purchaseService.confirmPurchaseOrder(id);

    res.status(200).json({
      success: true,
      message: "Purchase order confirmed",
      data: po,
    });
  } catch (err) {
    console.error("Error confirming purchase order:", err);

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
      error: "Failed to confirm purchase order",
    });
  }
}

/**
 * POST /api/purchase/:id/cancel
 * Cancel a purchase order.
 */
async function cancelPurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Purchase order ID is required",
      });
    }

    const po = await purchaseService.cancelPurchaseOrder(id);

    res.status(200).json({
      success: true,
      message: "Purchase order cancelled",
      data: po,
    });
  } catch (err) {
    console.error("Error cancelling purchase order:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    if (err.message && err.message.includes("cannot be cancelled")) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to cancel purchase order",
    });
  }
}

/**
 * POST /api/purchase/:id/receive
 * Mark purchase order as received.
 * Query param: receiveAll (default: true)
 */
async function receivePurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { receiveAll = true } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Purchase order ID is required",
      });
    }

    const po = await purchaseService.receivePurchaseOrder(
      id,
      receiveAll === "true" || receiveAll === true
    );

    res.status(200).json({
      success: true,
      message: "Purchase order received",
      data: po,
    });
  } catch (err) {
    console.error("Error receiving purchase order:", err);

    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    if (err.message && err.message.includes("cannot receive")) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to receive purchase order",
    });
  }
}

module.exports = {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
};
