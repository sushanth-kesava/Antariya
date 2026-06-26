const authService = require("./auth.service");

/**
 * Transform raw Odoo account.move (invoice) to API response format.
 */
function transformInvoice(odooInvoice) {
  if (!odooInvoice) return null;

  return {
    id: odooInvoice.id,
    name: odooInvoice.name || "",
    invoiceType: odooInvoice.move_type || "out_invoice", // out_invoice, in_invoice
    customerId: odooInvoice.partner_id ? odooInvoice.partner_id[0] : null,
    customerName: odooInvoice.partner_id ? odooInvoice.partner_id[1] : "",
    invoiceDate: odooInvoice.invoice_date,
    dueDate: odooInvoice.invoice_date_due,
    state: odooInvoice.state || "draft", // draft, posted, cancel
    paymentState: odooInvoice.payment_state || "not_paid",
    subtotal: parseFloat(odooInvoice.amount_untaxed || 0),
    tax: parseFloat(odooInvoice.amount_tax || 0),
    total: parseFloat(odooInvoice.amount_total || 0),
    amountPaid: parseFloat(odooInvoice.amount_residual_signed || 0),
    currency: odooInvoice.currency_id ? odooInvoice.currency_id[1] : "INR",
    reference: odooInvoice.ref || odooInvoice.name,
    origin: odooInvoice.origin || "", // Link to SO
    description: odooInvoice.narration || "",
    lines: odooInvoice.invoice_line_ids || [],
  };
}

/**
 * Extract GST details from invoice lines.
 * GST functionality temporarily on hold - pending GST number registration.
 * Will be implemented after GST number is obtained.
 */
function extractGSTDetails(invoice) {
  // Placeholder - GST extraction deferred
  return {
    status: "deferred",
    message: "GST functionality on hold - pending GST number registration",
  };
}

/**
 * Fetch invoices with pagination and filtering.
 * Supports filtering by customer, state, date range.
 */
async function getInvoices(options = {}) {
  const {
    offset = 0,
    limit = 20,
    customerId,
    state,
    search,
    fromDate,
    toDate,
  } = options;

  const pageOffset = Math.max(0, parseInt(offset) || 0);
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const client = await authService.getClient();

  try {
    // Build search domain
    let domain = [["move_type", "=", "out_invoice"]]; // Only customer invoices

    if (customerId) {
      domain.push(["partner_id", "=", parseInt(customerId)]);
    }

    if (state) {
      domain.push(["state", "=", state]);
    }

    if (search && search.trim().length > 0) {
      domain.push(["|", ["name", "ilike", search], ["ref", "ilike", search]]);
    }

    if (fromDate) {
      domain.push(["invoice_date", ">=", fromDate]);
    }

    if (toDate) {
      domain.push(["invoice_date", "<=", toDate]);
    }

    // Get total count
    const count = await client.call("account.move", "search_count", [domain]);

    // Fetch invoice IDs
    const invoiceIds = await client.call("account.move", "search", [
      domain,
      {
        limit: pageLimit,
        offset: pageOffset,
        order: "invoice_date desc",
      },
    ]);

    if (!invoiceIds || invoiceIds.length === 0) {
      return {
        invoices: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const fields = [
      "id",
      "name",
      "move_type",
      "partner_id",
      "invoice_date",
      "invoice_date_due",
      "state",
      "payment_state",
      "amount_untaxed",
      "amount_tax",
      "amount_total",
      "amount_residual_signed",
      "currency_id",
      "ref",
      "origin",
      "narration",
      "invoice_line_ids",
    ];

    const invoices = await client.call("account.move", "read", [invoiceIds, fields]);

    if (!Array.isArray(invoices)) {
      return {
        invoices: [],
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const transformedInvoices = invoices.map(transformInvoice).filter(Boolean);

    return {
      invoices: transformedInvoices,
      total: count,
      offset: pageOffset,
      limit: pageLimit,
      hasMore: pageOffset + pageLimit < count,
    };
  } catch (err) {
    throw new Error(`Failed to fetch invoices: ${err.message}`);
  }
}

/**
 * Fetch invoice by ID with full details.
 */
async function getInvoiceById(invoiceId) {
  if (!invoiceId) {
    throw new Error("Invoice ID is required");
  }

  const client = await authService.getClient();

  try {
    const fields = [
      "id",
      "name",
      "move_type",
      "partner_id",
      "invoice_date",
      "invoice_date_due",
      "state",
      "payment_state",
      "amount_untaxed",
      "amount_tax",
      "amount_total",
      "amount_residual_signed",
      "currency_id",
      "ref",
      "origin",
      "narration",
      "invoice_line_ids",
    ];

    const results = await client.call("account.move", "read", [[parseInt(invoiceId)], fields]);

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const invoice = results[0];

    // Fetch invoice lines with tax details
    if (invoice.invoice_line_ids && Array.isArray(invoice.invoice_line_ids)) {
      const lineFields = [
        "id",
        "product_id",
        "name",
        "quantity",
        "price_unit",
        "price_subtotal",
        "price_tax",
        "price_total",
        "tax_ids",
      ];

      const lineDetails = await client.call("account.move.line", "read", [
        invoice.invoice_line_ids,
        lineFields,
      ]);

      if (Array.isArray(lineDetails)) {
        invoice.invoice_line_ids = lineDetails
          .map((line) => ({
            id: line.id,
            productId: line.product_id ? line.product_id[0] : null,
            productName: line.product_id ? line.product_id[1] : line.name,
            description: line.name,
            quantity: parseFloat(line.quantity || 0),
            unitPrice: parseFloat(line.price_unit || 0),
            subtotal: parseFloat(line.price_subtotal || 0),
            tax: parseFloat(line.price_tax || 0),
            total: parseFloat(line.price_total || 0),
            taxes: line.tax_ids || [],
          }))
          .filter(Boolean);
      }
    }

    const transformed = transformInvoice(invoice);

    return transformed;
  } catch (err) {
    throw new Error(`Failed to fetch invoice: ${err.message}`);
  }
}

/**
 * Create invoice from sales order.
 * Validates SO exists and creates draft invoice.
 */
async function createInvoiceFromSalesOrder(soId) {
  if (!soId) {
    throw new Error("Sales order ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify SO exists
    const soResults = await client.call("sale.order", "read", [[parseInt(soId)], ["id", "state"]]);

    if (!Array.isArray(soResults) || soResults.length === 0) {
      throw new Error("Sales order not found");
    }

    const so = soResults[0];
    if (so.state !== "sale") {
      throw new Error("Sales order must be confirmed before creating invoice");
    }

    // Create invoice from SO
    const invoiceAction = await client.call("sale.order", "action_invoice_create", [
      [parseInt(soId)],
    ]);

    if (!invoiceAction || !Array.isArray(invoiceAction) || invoiceAction.length === 0) {
      throw new Error("Failed to create invoice from sales order");
    }

    const invoiceId = invoiceAction[0];

    // Fetch and return created invoice
    return await getInvoiceById(invoiceId);
  } catch (err) {
    throw new Error(`Failed to create invoice: ${err.message}`);
  }
}

/**
 * Post (validate) an invoice.
 * Moves from draft to posted state.
 */
async function postInvoice(invoiceId) {
  if (!invoiceId) {
    throw new Error("Invoice ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify invoice exists and is in draft state
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.state !== "draft") {
      throw new Error(`Invoice cannot be posted. Current state: ${invoice.state}`);
    }

    // Post invoice (button_draft_finalize or action_post)
    await client.call("account.move", "action_post", [[parseInt(invoiceId)]]);

    // Fetch and return updated invoice
    return await getInvoiceById(invoiceId);
  } catch (err) {
    throw new Error(`Failed to post invoice: ${err.message}`);
  }
}

/**
 * Get invoice PDF as base64.
 * Returns PDF content encoded as base64.
 */
async function getInvoicePDF(invoiceId) {
  if (!invoiceId) {
    throw new Error("Invoice ID is required");
  }

  const client = await authService.getClient();

  try {
    // Verify invoice exists
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Get report binary data
    const reportName = "account.report_invoice";
    const reportIds = [parseInt(invoiceId)];

    // Call report generation
    const result = await client.call(
      "ir.actions.report",
      "_render_qweb_pdf",
      [reportName, reportIds]
    );

    if (!result) {
      throw new Error("Failed to generate PDF");
    }

    // Result is typically [pdf_data, file_type]
    return {
      filename: `Invoice-${invoice.name}.pdf`,
      pdf: result[0], // Base64 encoded PDF
      contentType: "application/pdf",
    };
  } catch (err) {
    throw new Error(`Failed to generate invoice PDF: ${err.message}`);
  }
}

/**
 * Fetch customer ledger - all transactions with this customer.
 * Shows invoices, payments, credit notes.
 */
async function getCustomerLedger(customerId, options = {}) {
  if (!customerId) {
    throw new Error("Customer ID is required");
  }

  const client = await authService.getClient();

  try {
    const { offset = 0, limit = 50 } = options;

    const pageOffset = Math.max(0, parseInt(offset) || 0);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));

    // Fetch all account moves for this customer
    const domain = [["partner_id", "=", parseInt(customerId)]];

    const count = await client.call("account.move", "search_count", [domain]);

    const moveIds = await client.call("account.move", "search", [
      domain,
      {
        limit: pageLimit,
        offset: pageOffset,
        order: "invoice_date desc",
      },
    ]);

    if (!moveIds || moveIds.length === 0) {
      return {
        customerId,
        ledger: [],
        summary: {
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingBalance: 0,
        },
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    const fields = [
      "id",
      "name",
      "move_type",
      "invoice_date",
      "state",
      "payment_state",
      "amount_total",
      "amount_residual_signed",
      "amount_paid",
    ];

    const moves = await client.call("account.move", "read", [moveIds, fields]);

    if (!Array.isArray(moves)) {
      return {
        customerId,
        ledger: [],
        summary: {
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingBalance: 0,
        },
        total: count,
        offset: pageOffset,
        limit: pageLimit,
        hasMore: false,
      };
    }

    // Calculate summary
    let totalInvoiced = 0;
    let totalPaid = 0;
    let outstandingBalance = 0;

    const ledger = moves
      .map((move) => {
        const moveType = move.move_type || "out_invoice";
        const isCredit = moveType === "out_refund" || moveType === "in_refund";
        const total = parseFloat(move.amount_total || 0);
        const residual = parseFloat(move.amount_residual_signed || 0);

        if (moveType === "out_invoice") {
          totalInvoiced += total;
          outstandingBalance += residual;
        }

        return {
          id: move.id,
          documentNo: move.name,
          type: moveType,
          date: move.invoice_date,
          state: move.state,
          paymentState: move.payment_state,
          amount: total,
          outstanding: isCredit ? -residual : residual,
        };
      })
      .filter(Boolean);

    // Calculate total paid
    totalPaid = totalInvoiced - outstandingBalance;

    return {
      customerId,
      ledger,
      summary: {
        totalInvoiced,
        totalPaid,
        outstandingBalance,
      },
      total: count,
      offset: pageOffset,
      limit: pageLimit,
      hasMore: pageOffset + pageLimit < count,
    };
  } catch (err) {
    throw new Error(`Failed to fetch customer ledger: ${err.message}`);
  }
}

/**
 * Get tax summary for a customer within date range.
 * GST functionality temporarily on hold - pending GST number registration.
 * Will be implemented after GST number is obtained.
 */
async function getTaxSummary(customerId, fromDate, toDate) {
  throw new Error(
    "GST functionality is temporarily on hold. Please register a GST number and enable this feature."
  );
}

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoiceFromSalesOrder,
  postInvoice,
  getInvoicePDF,
  getCustomerLedger,
  transformInvoice,
};
