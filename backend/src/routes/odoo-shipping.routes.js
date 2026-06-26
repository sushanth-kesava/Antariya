const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/odoo-shipping.controller");

/**
 * Odoo Shipping Routes
 * Manages shipments, tracking, courier status, labels, and delivery estimates.
 * Supports provider integration (Shiprocket, DHL, FedEx, etc.)
 *
 * When mounted at /api/shipping:
 *   GET /api/shipping - list shipments
 *   POST /api/shipping - create shipment from SO
 *   GET /api/shipping/:id - get shipment details
 *   POST /api/shipping/:id/confirm - confirm shipment
 *   POST /api/shipping/:id/link-provider - link to shipping provider
 *   POST /api/shipping/:id/cancel - cancel shipment
 *   GET /api/shipping/:id/tracking - get tracking info
 *   GET /api/shipping/:id/courier-status - get courier status
 *   GET /api/shipping/:id/label - download label
 *   GET /api/shipping/:id/delivery-estimate - get delivery estimate
 */

// List shipments
router.get("/", getShipments);

// Create shipment from sales order
router.post("/", createShipment);

// Confirm shipment (must be before :id to avoid conflict)
router.post("/:id/confirm", confirmShipment);

// Link provider (must be before :id to avoid conflict)
router.post("/:id/link-provider", linkProvider);

// Cancel shipment (must be before :id to avoid conflict)
router.post("/:id/cancel", cancelShipment);

// Get tracking info (must be before :id to avoid conflict)
router.get("/:id/tracking", getTrackingInfo);

// Get courier status (must be before :id to avoid conflict)
router.get("/:id/courier-status", getCourierStatus);

// Get shipping label (must be before :id to avoid conflict)
router.get("/:id/label", getShippingLabel);

// Get delivery estimate (must be before :id to avoid conflict)
router.get("/:id/delivery-estimate", getExpectedDelivery);

// Get shipment details (must be last)
router.get("/:id", getShipment);

module.exports = router;
