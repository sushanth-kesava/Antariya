const salesService = require("../services/odoo/sales.service");

/**
 * POST /api/odoo/sales
 * Create a new sales order in Odoo.
 * Body:
 * {
 *   customerId: (required),
 *   lines: [
 *     { productId, quantity, price, discount, productName, taxes: [...] },
 *     { productId, quantity, price, discount, ... }
 *   ],
 *   notes: (optional),
 *   reference: (optional),
 *   shippingAmount: (optional),
 *   shippingAddress: { addressId, ... } (optional),
 *   billingAddress: { addressId, ... } (optional)
 * }
 */
async function createSalesOrder(req, res, next) {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).json({
        success: false,
        error: "Request body is required",
      });
    }

    // Validate order data
    const validationError = salesService.validateOrderData(body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError,
      });
    }

    const order = await salesService.createSalesOrder(body);

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (err) {
    console.error("Error creating sales order:", err);

    // Handle validation errors
    if (
      err.message &&
      (err.message.includes("Product not found") ||
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
      error: "Failed to create sales order",
    });
  }
}

/**
 * GET /api/odoo/sales/:id
 * Fetch sales order by ID.
 */
async function getSalesOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Sales order ID is required",
      });
    }

    const order = await salesService.getSalesOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Sales order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    console.error("Error fetching sales order:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sales order",
    });
  }
}

/**
 * POST /api/odoo/sales/:id/confirm
 * Confirm a sales order (moves from draft to sale).
 * Triggers inventory reduction and invoice generation.
 */
async function confirmSalesOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Sales order ID is required",
      });
    }

    const order = await salesService.confirmSalesOrder(id);

    res.status(200).json({
      success: true,
      message: "Sales order confirmed successfully",
      data: order,
    });
  } catch (err) {
    console.error("Error confirming sales order:", err);

    // Handle business logic errors
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
      error: "Failed to confirm sales order",
    });
  }
}

/**
 * POST /api/odoo/sales/:id/cancel
 * Cancel a sales order.
 */
async function cancelSalesOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Sales order ID is required",
      });
    }

    const order = await salesService.cancelSalesOrder(id);

    res.status(200).json({
      success: true,
      message: "Sales order cancelled successfully",
      data: order,
    });
  } catch (err) {
    console.error("Error cancelling sales order:", err);

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
      error: "Failed to cancel sales order",
    });
  }
}

/**
 * GET /api/odoo/sales/:id/invoice
 * Fetch invoice associated with sales order.
 */
async function getSalesOrderInvoice(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Sales order ID is required",
      });
    }

    const invoice = await salesService.getSalesOrderInvoice(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found for this sales order",
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch invoice",
    });
  }
}

module.exports = {
  createSalesOrder,
  getSalesOrder,
  confirmSalesOrder,
  cancelSalesOrder,
  getSalesOrderInvoice,
};
