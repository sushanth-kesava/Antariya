/**
 * Webhook Controller
 * Handles incoming webhooks from Odoo
 */

const { processWebhook, scheduledSync } = require("../../services/sync/webhook.processor");
const { logError } = require("../../middleware/error-handler.middleware");

/**
 * POST /api/webhooks/odoo
 * Receive webhook from Odoo
 */
async function receiveWebhook(req, res, next) {
  try {
    const payload = req.body;
    const signature = req.headers["x-odoo-signature"];

    logError("info", "webhook_received_raw", {
      event: payload?.event,
      dataId: payload?.data?.id,
    });

    const result = await processWebhook(payload, signature);

    res.json({
      success: true,
      eventId: result.eventId,
      jobId: result.jobId,
      isDuplicate: result.isDuplicate || false,
    });
  } catch (error) {
    logError("error", "webhook_process_failed", {
      errorMessage: error.message,
    }, error);

    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /api/webhooks/trigger-sync
 * Manually trigger scheduled sync
 */
async function triggerScheduledSync(req, res, next) {
  try {
    const { entityType } = req.body;

    if (!["products", "inventory", "orders", "invoices", "customers"].includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid entityType",
      });
    }

    logError("info", "scheduled_sync_triggered", { entityType });

    const result = await scheduledSync(entityType);

    res.json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      message: `Synced ${result.synced} items, ${result.failed} failed`,
    });
  } catch (error) {
    logError("error", "trigger_sync_failed", {
      errorMessage: error.message,
    }, error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /api/webhooks/health
 * Webhook health check
 */
async function webhookHealth(req, res) {
  res.json({
    success: true,
    webhook: "operational",
    timestamp: new Date(),
  });
}

module.exports = {
  receiveWebhook,
  triggerScheduledSync,
  webhookHealth,
};
