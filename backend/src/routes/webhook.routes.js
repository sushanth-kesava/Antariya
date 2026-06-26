/**
 * Webhook Routes
 * Endpoints for receiving and managing webhooks
 */

const express = require("express");
const router = express.Router();
const webhookController = require("../../controllers/webhook.controller");

/**
 * POST /api/webhooks/odoo
 * Receive webhook from Odoo
 * Header: x-odoo-signature: <HMAC signature>
 * Body: { event, data, timestamp, id }
 */
router.post("/odoo", webhookController.receiveWebhook);

/**
 * POST /api/webhooks/trigger-sync
 * Manually trigger scheduled sync (admin only)
 * Body: { entityType: 'products|inventory|orders|invoices|customers' }
 */
router.post("/trigger-sync", webhookController.triggerScheduledSync);

/**
 * POST /api/webhooks/health
 * Health check for webhook system
 */
router.post("/health", webhookController.webhookHealth);

module.exports = router;
