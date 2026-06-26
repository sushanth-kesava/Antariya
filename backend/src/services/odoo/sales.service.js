const authService = require("./auth.service");

/**
 * Transform raw Odoo sale.order to API response format.
 */
function transformSalesOrder(odooOrder) {
  if (!odooOrder) return null;

  return {
    id: odooOrder.id,
    name: odooOrder.name || "",
    customerId: odooOrder.partner_id ? odooOrder.partner_id[0] : null,
    customerName: odooOrder.partner_id ? odooOrder.partner_id[1] : "",
    orderDate: odooOrder.date_order,
    state: odooOrder.state || "draft",
    subtotal: parseFloat(odooOrder.amount_untaxed || 0),
    tax: parseFloat(odooOrder.amount_tax || 0),
    total: parseFloat(odooOrder.amount_total || 0),
    discount: parseFloat(odooOrder.discount_total || 0),
    shippingAmount: parseFloat(odooOrder.shipping_amount || 0),
    lines: odooOrder.order_line || [],
    notes: odooOrder.note || odooOrder.client_order_ref || "",
    paymentState: odooOrder.payment_state || "not_paid",
    invoiced: odooOrder.invoice_status || "no",
  };
}

/**
 * Validate order data before creating.
 * Returns validation error if invalid, null if valid.
 */
function validateOrderData(data) {
  if (!data) return "Order data is required";

  const { customerId, lines } = data;

  if (!customerId) {
    return "Customer ID is required";
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return "At least one order line is required";
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.productId) {
      return `Order line ${i + 1}: Product ID is required`;
    }
    if (!line.quantity || parseFloat(line.quantity) <= 0) {
      return `Order line ${i + 1}: Quantity must be greater than 0`;
    }
    if (!line.price || parseFloat(line.price) < 0) {
      return `Order line ${i + 1}: Price must be >= 0`;
    }
  }

  return null;
}

/**
 * Create a sales order in Odoo.
 * Returns created order with order lines.
 * Order is created in 'draft' state (not confirmed yet).
 */
async function createSalesOrder(data) {
  const validationError = validateOrderData(data);
  if (validationError) {
    throw new Error(validationError);
  }

  const client = await authService.getClient();

  try {
    const {
      customerId,
      lines,
      taxAmount = 0,
      discount = 0,
      shippingAmount = 0,
      notes = "",
      shippingAddress,
      billingAddress,
    } = data;

    // Prepare order data for Odoo
    const orderData = {
      partner_id: parseInt(customerId),
      note: notes || "",
      client_order_ref: data.reference || "",
      shipping_amount: parseFloat(shippingAmount) || 0,
      amount_total: 0, // Will be calculated by Odoo
    };

    // Set shipping address if provided
    if (shippingAddress && shippingAddress.addressId) {
      orderData.partner_shipping_id = parseInt(shippingAddress.addressId);
    }

    // Set billing address if provided
    if (billingAddress && billingAddress.addressId) {
      orderData.partner_invoice_id = parseInt(billingAddress.addressId);
    }

    // Prepare order lines
    const orderLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fetch product details
      const productResults = await client.call("product.product", "read", [
        [parseInt(line.productId)],
        ["id", "name", "default_code", "list_price", "taxes_id"],
      ]);

      if (!Array.isArray(productResults) || productResults.length === 0) {
        throw new Error(`Product not found: ${line.productId}`);
      }

      const product = productResults[0];
      const unitPrice = line.price || parseFloat(product.list_price || 0);
      const quantity = parseFloat(line.quantity) || 1;
      const lineDiscount = line.discount || 0;

      // Get default taxes for product
      let taxIds = [];
      if (line.taxes && Array.isArray(line.taxes)) {
        taxIds = line.taxes.map((t) => (typeof t === "object" ? t.id : t));
      } else if (product.taxes_id && Array.isArray(product.taxes_id)) {
        taxIds = product.taxes_id.slice(0, 1); // Take first tax
      }

      const lineData = [
        0,
        0,
        {
          product_id: parseInt(line.productId),
          name: line.productName || product.name,
          product_uom_qty: quantity,
          price_unit: unitPrice,
          discount: lineDiscount,
          tax_id: taxIds.length > 0 ? [[6, false, taxIds]] : [],
        },
      ];

      orderLines.push(lineData);
    }

    // Add shipping as separate line if amount > 0
    if (shippingAmount && parseFloat(shippingAmount) > 0) {
      orderLines.push([
        0,
        0,
        {
          name: "Shipping Charges",
          product_uom_qty: 1,
          price_unit: parseFloat(shippingAmount),
          is_shipping: true,
        },
      ]);
    }

    orderData.order_line = orderLines;

    // Create sales order in Odoo
    const orderId = await client.call("sale.order", "create", [orderData]);

    if (!orderId) {
      throw new Error("Failed to create sales order in Odoo");
    }

    // Fetch and return created order
    return await getSalesOrderById(orderId);
  } catch (err) {
    throw new Error(`Failed to create sales order: ${err.message}`);
  }
}

/**
 * Fetch sales order by ID from Odoo.
 * Returns order with full details including lines.
 */
async function getSalesOrderById(orderId) {
  if (!orderId) {
    throw new Error("Sales order ID is required");
  }

  const client = await authService.getClient();

  try {
    const fields = [
      "id",
      "name",
      "date_order",
      "state",
      "partner_id",
      "partner_shipping_id",
      "partner_invoice_id",
      "amount_untaxed",
      "amount_tax",
      "amount_total",
      "note",
      "client_order_ref",
      "payment_state",
      "invoice_status",
      "order_line",
    ];

    const results = await client.call("sale.order", "read", [[parseInt(orderId)], fields]);

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const order = results[0];

    // Fetch order lines with details
    if (order.order_line && Array.isArray(order.order_line)) {
      const lineFields = [
        "id",
        "product_id",
        "name",
        "product_uom_qty",
        "qty_delivered",
        "qty_invoiced",
        "price_unit",
        "discount",
        "price_subtotal",
        "price_tax",
        "price_total",
        "tax_id",
      ];

      const lineDetails = await client.call("sale.order.line", "read", [
        order.order_line,
        lineFields,
      ]);

      if (Array.isArray(lineDetails)) {
        order.order_line = lineDetails
          .map((line) => ({
            id: line.id,
            productId: line.product_id ? line.product_id[0] : null,
            productName: line.product_id ? line.product_id[1] : line.name,
            sku: line.sku || "",
            quantity: parseFloat(line.product_uom_qty || 0),
            quantityDelivered: parseFloat(line.qty_delivered || 0),
            quantityInvoiced: parseFloat(line.qty_invoiced || 0),
            unitPrice: parseFloat(line.price_unit || 0),
            discount: parseFloat(line.discount || 0),
            subtotal: parseFloat(line.price_subtotal || 0),
            tax: parseFloat(line.price_tax || 0),
            total: parseFloat(line.price_total || 0),
            taxes: line.tax_id || [],
          }))
          .filter(Boolean);
      }
    }

    return transformSalesOrder(order);
  } catch (err) {
    throw new Error(`Failed to fetch sales order: ${err.message}`);
  }
}

/**
 * Confirm a sales order (move from draft to sale).
 * Triggers:
 * - Stock reservation
 * - Invoice generation
 * - Inventory reduction
 */
async function confirmSalesOrder(orderId) {
  if (!orderId) {
    throw new Error("Sales order ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify order exists and is in draft state
    const order = await getSalesOrderById(orderId);
    if (!order) {
      throw new Error("Sales order not found");
    }

    if (order.state !== "draft") {
      throw new Error(
        `Sales order cannot be confirmed. Current state: ${order.state}`
      );
    }

    // Confirm order (calls action_confirm which moves to 'sale' state)
    await client.call("sale.order", "action_confirm", [[parseInt(orderId)]]);

    // Create invoice if auto-invoicing is enabled
    // This depends on Odoo configuration (automatic_invoice_validation)
    // For now, we attempt to create and validate invoice
    try {
      const invoiceAction = await client.call("sale.order", "action_invoice_create", [
        [parseInt(orderId)],
      ]);

      if (invoiceAction && Array.isArray(invoiceAction) && invoiceAction.length > 0) {
        const invoiceId = invoiceAction[0];

        // Validate invoice (post it)
        await client.call("account.move", "action_post", [[invoiceId]]);
      }
    } catch (invoiceErr) {
      // Invoice creation is optional - order confirmation is what matters
      console.warn("Invoice creation skipped:", invoiceErr.message);
    }

    // Fetch and return updated order
    return await getSalesOrderById(orderId);
  } catch (err) {
    throw new Error(`Failed to confirm sales order: ${err.message}`);
  }
}

/**
 * Cancel a sales order.
 * Only works for orders in draft state.
 */
async function cancelSalesOrder(orderId, reason = "") {
  if (!orderId) {
    throw new Error("Sales order ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify order exists
    const order = await getSalesOrderById(orderId);
    if (!order) {
      throw new Error("Sales order not found");
    }

    if (order.state !== "draft" && order.state !== "sale") {
      throw new Error(
        `Sales order cannot be cancelled. Current state: ${order.state}`
      );
    }

    // Cancel order
    await client.call("sale.order", "action_cancel", [[parseInt(orderId)]]);

    // Fetch and return updated order
    return await getSalesOrderById(orderId);
  } catch (err) {
    throw new Error(`Failed to cancel sales order: ${err.message}`);
  }
}

/**
 * Fetch invoice associated with sales order.
 */
async function getSalesOrderInvoice(orderId) {
  if (!orderId) {
    throw new Error("Sales order ID is required");
  }

  const client = await authService.getClient();

  try {
    // Search for invoice linked to this order
    const invoiceIds = await client.call("account.move", "search", [
      [["origin", "=", "SO" + String(orderId).padStart(5, "0")]],
      { limit: 1 },
    ]);

    if (!invoiceIds || invoiceIds.length === 0) {
      return null;
    }

    const invoiceFields = [
      "id",
      "name",
      "date",
      "state",
      "amount_untaxed",
      "amount_tax",
      "amount_total",
      "payment_state",
    ];

    const results = await client.call("account.move", "read", [invoiceIds, invoiceFields]);

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    return results[0];
  } catch (err) {
    throw new Error(`Failed to fetch invoice: ${err.message}`);
  }
}

module.exports = {
  createSalesOrder,
  getSalesOrderById,
  confirmSalesOrder,
  cancelSalesOrder,
  getSalesOrderInvoice,
  validateOrderData,
  transformSalesOrder,
};
