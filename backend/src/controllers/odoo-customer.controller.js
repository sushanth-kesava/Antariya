const customerService = require("../services/odoo/customer.service");

/**
 * POST /api/odoo/customer
 * Create or sync customer.
 * If customer exists by email, returns existing (from Odoo).
 * Otherwise creates new customer in Odoo.
 * Body:
 * {
 *   name,
 *   email,
 *   phone,
 *   mobile,
 *   company,
 *   gst,
 *   address / street,
 *   street2,
 *   city,
 *   state,
 *   zipCode,
 *   country,
 *   shippingAddress: { street, city, zipCode, ... },
 *   billingAddress: { street, city, zipCode, ... }
 * }
 */
async function createOrSyncCustomer(req, res, next) {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).json({
        success: false,
        error: "Request body is required",
      });
    }

    // Validate required fields
    const validationError = customerService.validateCustomerData(body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError,
      });
    }

    const result = await customerService.syncCustomer(body);

    const statusCode = result.created ? 201 : 200;
    res.status(statusCode).json({
      success: true,
      data: {
        created: result.created,
        customer: result.customer,
      },
    });
  } catch (err) {
    console.error("Error creating/syncing customer:", err);

    // Handle duplicate customer error
    if (err.message && err.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create or sync customer",
    });
  }
}

/**
 * GET /api/odoo/customer/:id
 * Fetch customer by Odoo ID.
 */
async function getCustomer(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const customer = await customerService.getCustomerById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (err) {
    console.error("Error fetching customer:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch customer",
    });
  }
}

/**
 * PUT /api/odoo/customer/:id
 * Update customer in Odoo.
 * Body: any subset of customer fields to update
 * {
 *   name,
 *   email,
 *   phone,
 *   mobile,
 *   company,
 *   gst,
 *   street,
 *   street2,
 *   city,
 *   zipCode
 * }
 */
async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one field must be provided to update",
      });
    }

    const updated = await customerService.updateCustomer(id, body);

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("Error updating customer:", err);

    // Handle not found
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    // Handle duplicate email
    if (err.message && err.message.includes("already in use")) {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update customer",
    });
  }
}

/**
 * GET /api/odoo/customer/search/by-email/:email
 * Find customer by email (useful for checking before registration).
 */
async function findCustomerByEmail(req, res, next) {
  try {
    const { email } = req.params;

    if (!email || email.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const customer = await customerService.findCustomerByEmail(email);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (err) {
    console.error("Error searching customer by email:", err);
    res.status(500).json({
      success: false,
      error: "Failed to search customer",
    });
  }
}

module.exports = {
  createOrSyncCustomer,
  getCustomer,
  updateCustomer,
  findCustomerByEmail,
};
