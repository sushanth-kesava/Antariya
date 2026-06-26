const authService = require("./auth.service");

/**
 * Transform raw Odoo purchase.order to API response format.
 */
function transformPurchaseOrder(odooOrder) {
  if (!odooOrder) return null;

  return {
    id: odooOrder.id,
    name: odooOrder.name || "",
    vendorId: odooOrder.partner_id ? odooOrder.partner_id[0] : null,
    vendorName: odooOrder.partner_id ? odooOrder.partner_id[1] : "",
    orderDate: odooOrder.date_order,
    expectedDelivery: odooOrder.date_planned || odooOrder.date_approve,
    state: odooOrder.state || "draft",
    subtotal: parseFloat(odooOrder.amount_untaxed || 0),
    tax: parseFloat(odooOrder.amount_tax || 0),
    total: parseFloat(odooOrder.amount_total || 0),
    currency: odooOrder.currency_id ? odooOrder.currency_id[1] : "USD",
    lines: odooOrder.order_line || [],
    notes: odooOrder.notes || "",
    receiptStatus: odooOrder.receipt_status || "not_received",
    invoiceStatus: odooOrder.invoice_status || "no",
  };
}

/**
 * Validate purchase order data before creating.
 * Returns validation error if invalid, null if valid.
 */
function validatePurchaseOrderData(data) {
  if (!data) return "Purchase order data is required";

  const { vendorId, lines } = data;

  if (!vendorId) {
    return "Vendor ID is required";
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return "At least one line item is required";
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.productId) {
      return `Line ${i + 1}: Product ID is required`;
    }
    if (!line.quantity || parseFloat(line.quantity) <= 0) {
      return `Line ${i + 1}: Quantity must be greater than 0`;
    }
    if (line.cost === undefined || parseFloat(line.cost) < 0) {
      return `Line ${i + 1}: Cost must be >= 0`;
    }
  }

  return null;
}

/**
 * Create a purchase order in Odoo.
 * Returns created PO with order lines.
 */
async function createPurchaseOrder(data) {
  const validationError = validatePurchaseOrderData(data);
  if (validationError) {
    throw new Error(validationError);
  }

  const client = await authService.getClient();

  try {
    const {
      vendorId,
      lines,
      expectedDelivery,
      notes = "",
      reference = "",
    } = data;

    // Verify vendor exists
    const vendorResults = await client.call("res.partner", "read", [
      [parseInt(vendorId)],
      ["id", "name"],
    ]);

    if (!Array.isArray(vendorResults) || vendorResults.length === 0) {
      throw new Error("Vendor not found");
    }

    // Prepare PO data
    const poData = {
      partner_id: parseInt(vendorId),
      notes: notes || "",
    };

    // Add reference if provided
    if (reference) {
      poData.origin = reference;
    }

    // Set expected delivery date if provided
    if (expectedDelivery) {
      poData.date_planned = expectedDelivery;
    }

    // Prepare order lines
    const orderLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fetch product details
      const productResults = await client.call("product.product", "read", [
        [parseInt(line.productId)],
        ["id", "name", "default_code", "uom_po_id"],
      ]);

      if (!Array.isArray(productResults) || productResults.length === 0) {
        throw new Error(`Product not found: ${line.productId}`);
      }

      const product = productResults[0];
      const unitCost = parseFloat(line.cost) || 0;
      const quantity = parseFloat(line.quantity) || 1;

      const lineData = [
        0,
        0,
        {
          product_id: parseInt(line.productId),
          name: line.productName || product.name,
          product_qty: quantity,
          product_uom: product.uom_po_id ? product.uom_po_id[0] : 1,
          price_unit: unitCost,
          date_planned: line.expectedDelivery || expectedDelivery || new Date().toISOString(),
        },
      ];

      orderLines.push(lineData);
    }

    poData.order_line = orderLines;

    // Create purchase order in Odoo
    const poId = await client.call("purchase.order", "create", [poData]);

    if (!poId) {
      throw new Error("Failed to create purchase order in Odoo");
    }

    // Fetch and return created PO
    return await getPurchaseOrderById(poId);
  } catch (err) {
    throw new Error(`Failed to create purchase order: ${err.message}`);
  }
}

/**
 * Fetch purchase order by ID from Odoo.
 * Returns PO with full line details.
 */
async function getPurchaseOrderById(poId) {
  if (!poId) {
    throw new Error("Purchase order ID is required");
  }

  const client = await authService.getClient();

  try {
    const fields = [
      "id",
      "name",
      "date_order",
      "date_planned",
      "date_approve",
      "state",
      "partner_id",
      "amount_untaxed",
      "amount_tax",
      "amount_total",
      "currency_id",
      "notes",
      "receipt_status",
      "invoice_status",
      "order_line",
    ];

    const results = await client.call("purchase.order", "read", [
      [parseInt(poId)],
      fields,
    ]);

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const po = results[0];

    // Fetch order lines with details
    if (po.order_line && Array.isArray(po.order_line)) {
      const lineFields = [
        "id",
        "product_id",
        "name",
        "product_qty",
        "qty_received",
        "qty_invoiced",
        "price_unit",
        "price_subtotal",
        "price_tax",
        "price_total",
        "date_planned",
        "product_uom",
      ];

      const lineDetails = await client.call("purchase.order.line", "read", [
        po.order_line,
        lineFields,
      ]);

      if (Array.isArray(lineDetails)) {
        po.order_line = lineDetails
          .map((line) => ({
            id: line.id,
            productId: line.product_id ? line.product_id[0] : null,
            productName: line.product_id ? line.product_id[1] : line.name,
            sku: line.sku || "",
            quantity: parseFloat(line.product_qty || 0),
            quantityReceived: parseFloat(line.qty_received || 0),
            quantityInvoiced: parseFloat(line.qty_invoiced || 0),
            unitCost: parseFloat(line.price_unit || 0),
            subtotal: parseFloat(line.price_subtotal || 0),
            tax: parseFloat(line.price_tax || 0),
            total: parseFloat(line.price_total || 0),
            expectedDelivery: line.date_planned,
            uom: line.product_uom ? line.product_uom[1] : "Unit",
          }))
          .filter(Boolean);
      }
    }

    return transformPurchaseOrder(po);
  } catch (err) {
    throw new Error(`Failed to fetch purchase order: ${err.message}`);
  }
}

/**
 * List all purchase orders with pagination and filtering.
 * Supports filtering by state, vendor, date range.
 */
async function listPurchaseOrders(options = {}) {
  const {
    offset = 0,
    limit = 20,
    state,
    vendorId,
    search,
  } = options;

  const pageOffset = Math.max(0, parseInt(offset) || 0);
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const client = await authService.getClient();

  try {
    // Build search domain
    let domain = [];

    if (state) {
      domain.push(["state", "=", state]);
    }

    if (vendorId) {
      domain.push(["partner_id", "=", parseInt(vendorId)]);
    }

    if (search && search.trim().length > 0) {
      domain.push(["|", ["name", "ilike", search], ["notes", "ilike", search]]);
    }

    // Get total count
    const count = await client.call("purchase.order", "search_count", [domain]);

    // Fetch PO IDs
    const poIds = await client.call("purchase.order", "search", [
      domain,
      {
        limit: pageLimit,
        offset: pageOffset,
        order: "date_order desc",
      },
    ]);

    if (!poIds || poIds.length === 0) {
      return {
        orders: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const fields = [
      "id",
      "name",
      "date_order",
      "date_planned",
      "date_approve",
      "state",
      "partner_id",
      "amount_untaxed",
      "amount_tax",
      "amount_total",
      "currency_id",
      "notes",
      "receipt_status",
      "invoice_status",
      "order_line",
    ];

    const pos = await client.call("purchase.order", "read", [poIds, fields]);

    if (!Array.isArray(pos)) {
      return {
        orders: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const orders = pos.map(transformPurchaseOrder).filter(Boolean);

    return {
      orders,
      total: count,
      offset: pageOffset,
      limit: pageLimit,
      hasMore: pageOffset + pageLimit < count,
    };
  } catch (err) {
    throw new Error(`Failed to fetch purchase orders: ${err.message}`);
  }
}

/**
 * Confirm a purchase order (move from draft to sent).
 * Locks the order and sends to vendor.
 */
async function confirmPurchaseOrder(poId) {
  if (!poId) {
    throw new Error("Purchase order ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify PO exists and is in draft state
    const po = await getPurchaseOrderById(poId);
    if (!po) {
      throw new Error("Purchase order not found");
    }

    if (po.state !== "draft") {
      throw new Error(`PO cannot be confirmed. Current state: ${po.state}`);
    }

    // Confirm PO (calls button_confirm which moves to 'sent' state)
    await client.call("purchase.order", "button_confirm", [[parseInt(poId)]]);

    // Fetch and return updated PO
    return await getPurchaseOrderById(poId);
  } catch (err) {
    throw new Error(`Failed to confirm purchase order: ${err.message}`);
  }
}

/**
 * Cancel a purchase order.
 * Only works for orders in draft or sent state.
 */
async function cancelPurchaseOrder(poId, reason = "") {
  if (!poId) {
    throw new Error("Purchase order ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify PO exists
    const po = await getPurchaseOrderById(poId);
    if (!po) {
      throw new Error("Purchase order not found");
    }

    if (po.state !== "draft" && po.state !== "sent") {
      throw new Error(`PO cannot be cancelled. Current state: ${po.state}`);
    }

    // Cancel PO
    await client.call("purchase.order", "button_cancel", [[parseInt(poId)]]);

    // Fetch and return updated PO
    return await getPurchaseOrderById(poId);
  } catch (err) {
    throw new Error(`Failed to cancel purchase order: ${err.message}`);
  }
}

/**
 * Receive goods for a purchase order.
 * Updates the receipt status and creates stock moves.
 */
async function receivePurchaseOrder(poId, receiveAll = true) {
  if (!poId) {
    throw new Error("Purchase order ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify PO exists
    const po = await getPurchaseOrderById(poId);
    if (!po) {
      throw new Error("Purchase order not found");
    }

    if (po.state !== "purchase") {
      throw new Error(`Cannot receive PO in state: ${po.state}`);
    }

    // Get associated picking (stock.picking)
    const pickingIds = await client.call("stock.picking", "search", [
      [["purchase_id", "=", parseInt(poId)]],
      { limit: 1 },
    ]);

    if (!pickingIds || pickingIds.length === 0) {
      throw new Error("No receipt document found for this PO");
    }

    const pickingId = pickingIds[0];

    // Mark all lines as received if receiveAll is true
    if (receiveAll) {
      // Get picking lines
      const picking = await client.call("stock.picking", "read", [
        [pickingId],
        ["move_lines"],
      ]);

      if (picking && picking.length > 0 && picking[0].move_lines) {
        const moveIds = picking[0].move_lines;

        // Update quantity done for all moves
        for (const moveId of moveIds) {
          const moveData = await client.call("stock.move", "read", [[moveId], ["product_qty"]]);
          if (moveData && moveData.length > 0) {
            await client.call("stock.move", "write", [
              [moveId],
              { quantity_done: moveData[0].product_qty },
            ]);
          }
        }
      }
    }

    // Validate picking (button_validate)
    await client.call("stock.picking", "button_validate", [[pickingId]]);

    // Fetch and return updated PO
    return await getPurchaseOrderById(poId);
  } catch (err) {
    throw new Error(`Failed to receive purchase order: ${err.message}`);
  }
}

module.exports = {
  createPurchaseOrder,
  getPurchaseOrderById,
  listPurchaseOrders,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  validatePurchaseOrderData,
  transformPurchaseOrder,
};
