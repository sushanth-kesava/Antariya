const express = require("express");
const router = express.Router();
const {
  createOrSyncCustomer,
  getCustomer,
  updateCustomer,
  findCustomerByEmail,
} = require("../controllers/odoo-customer.controller");

/**
 * Odoo Customer Routes
 * Manages customer synchronization with Odoo res.partner
 * When mounted at /api/odoo/customer:
 *   POST /api/odoo/customer - create or sync customer
 *   GET /api/odoo/customer/search/by-email/:email - find by email
 *   GET /api/odoo/customer/:id - get customer by ID
 *   PUT /api/odoo/customer/:id - update customer
 */

// Search by email (must be before :id to avoid conflict)
router.get("/search/by-email/:email", findCustomerByEmail);

// Create/sync customer
router.post("/", createOrSyncCustomer);

// Update customer (must be before :id)
router.put("/:id", updateCustomer);

// Get customer by ID (must be last)
router.get("/:id", getCustomer);

module.exports = router;
