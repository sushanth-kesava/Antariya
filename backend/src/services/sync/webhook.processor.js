/**
 * Webhook Receiver & Event Processor
 * Handles Odoo webhooks and processes sync events
 *
 * @module webhookProcessor
 * @description
 * Receives webhook events from Odoo and processes them:
 * - Product create/update
 * - Inventory changes
 * - Order status changes
 * - Invoice status changes
 * - Duplicate prevention
 * - Event logging
 * - Idempotency tracking
 */

const { v4: uuidv4 } = require("uuid");
const { logError } = require("../../middleware/error-handler.middleware");
const SyncEvent = require("../../models/SyncEvent");
const { syncQueue } = require("../queue/queue.config");

/**
 * Supported webhook event types
 */
const WEBHOOK_EVENTS = {
  // Product events
  PRODUCT_CREATE: "product.product.create",
  PRODUCT_UPDATE: "product.product.update",
  PRODUCT_DELETE: "product.product.delete",

  // Inventory events
  INVENTORY_UPDATE: "stock.quant.update",

  // Order events
  ORDER_CREATE: "sale.order.create",
  ORDER_CONFIRM: "sale.order.confirm",
  ORDER_SHIPPED: "sale.order.shipped",
  ORDER_DELIVERED: "sale.order.delivered",
  ORDER_CANCELLED: "sale.order.cancel",

  // Invoice events
  INVOICE_CREATE: "account.move.create",
  INVOICE_POSTED: "account.move.posted",
  INVOICE_CANCELLED: "account.move.cancelled",
  INVOICE_PAID: "account.move.paid",
};

/**
 * Process incoming webhook from Odoo
 * @param {object} payload - Webhook payload from Odoo
 * @param {string} signature - HMAC signature for verification
 * @returns {object} { success, eventId, jobId }
 */
async function processWebhook(payload, signature) {
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      throw new Error("Invalid webhook signature");
    }

    const { event, data, timestamp, id: odooEventId } = payload;

    // Validate event type
    if (!Object.values(WEBHOOK_EVENTS).includes(event)) {
      throw new Error(`Unknown event type: ${event}`);
    }

    // Check for duplicate processing (idempotency)
    const existingEvent = await SyncEvent.findOne({ odooEventId });
    if (existingEvent) {
      logError("warn", "webhook_duplicate", {
        event,
        odooEventId,
        previousStatus: existingEvent.status,
      });
      return {
        success: true,
        eventId: existingEvent._id,
        isDuplicate: true,
      };
    }

    // Create sync event record
    const syncEventId = uuidv4();
    const syncEvent = await SyncEvent.create({
      _id: syncEventId,
      odooEventId,
      eventType: event,
      status: "pending",
      payload: data,
      timestamp: new Date(timestamp),
      retryCount: 0,
      createdAt: new Date(),
    });

    logError("info", "webhook_received", {
      syncEventId,
      event,
      dataId: data.id,
      model: data.model,
    });

    // Queue job based on event type
    const jobId = await queueSyncJob(event, data, syncEventId);

    // Update sync event with job ID
    await SyncEvent.updateOne({ _id: syncEventId }, { jobId });

    return {
      success: true,
      eventId: syncEventId,
      jobId,
      isDuplicate: false,
    };
  } catch (error) {
    logError("error", "webhook_process_failed", {
      event: payload?.event,
      errorMessage: error.message,
    }, error);

    throw error;
  }
}

/**
 * Verify webhook signature using HMAC
 * @param {object} payload - Webhook payload
 * @param {string} signature - HMAC signature
 * @returns {boolean}
 */
function verifyWebhookSignature(payload, signature) {
  const crypto = require("crypto");
  const secret = process.env.ODOO_WEBHOOK_SECRET || "default-secret";

  const payloadString = JSON.stringify(payload);
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payloadString)
    .digest("hex");

  return hash === signature;
}

/**
 * Queue appropriate sync job based on event type
 * @param {string} eventType - Type of event
 * @param {object} data - Event data
 * @param {string} syncEventId - Sync event ID
 * @returns {string} Job ID
 */
async function queueSyncJob(eventType, data, syncEventId) {
  const jobOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  };

  let jobId;

  try {
    switch (eventType) {
      // Product events
      case WEBHOOK_EVENTS.PRODUCT_CREATE:
      case WEBHOOK_EVENTS.PRODUCT_UPDATE:
        jobId = (
          await syncQueue.add(
            "sync-product",
            {
              productId: data.id,
              syncEventId,
              action: eventType.includes("create") ? "create" : "update",
            },
            jobOptions
          )
        ).id;
        break;

      // Inventory events
      case WEBHOOK_EVENTS.INVENTORY_UPDATE:
        jobId = (
          await syncQueue.add(
            "sync-inventory",
            {
              quantId: data.id,
              productId: data.product_id,
              syncEventId,
            },
            jobOptions
          )
        ).id;
        break;

      // Order events
      case WEBHOOK_EVENTS.ORDER_CREATE:
        jobId = (
          await syncQueue.add(
            "sync-order",
            {
              orderId: data.id,
              syncEventId,
              action: "create",
            },
            jobOptions
          )
        ).id;
        break;

      case WEBHOOK_EVENTS.ORDER_CONFIRM:
      case WEBHOOK_EVENTS.ORDER_SHIPPED:
      case WEBHOOK_EVENTS.ORDER_DELIVERED:
      case WEBHOOK_EVENTS.ORDER_CANCELLED:
        jobId = (
          await syncQueue.add(
            "sync-order-status",
            {
              orderId: data.id,
              syncEventId,
              status: parseOrderStatus(eventType),
            },
            jobOptions
          )
        ).id;
        break;

      // Invoice events
      case WEBHOOK_EVENTS.INVOICE_CREATE:
        jobId = (
          await syncQueue.add(
            "sync-invoice",
            {
              invoiceId: data.id,
              syncEventId,
              action: "create",
            },
            jobOptions
          )
        ).id;
        break;

      case WEBHOOK_EVENTS.INVOICE_POSTED:
      case WEBHOOK_EVENTS.INVOICE_PAID:
      case WEBHOOK_EVENTS.INVOICE_CANCELLED:
        jobId = (
          await syncQueue.add(
            "sync-invoice-status",
            {
              invoiceId: data.id,
              syncEventId,
              status: parseInvoiceStatus(eventType),
            },
            jobOptions
          )
        ).id;
        break;

      default:
        throw new Error(`No queue handler for event: ${eventType}`);
    }

    logError("info", "job_queued", {
      eventType,
      jobId,
      syncEventId,
    });

    return jobId;
  } catch (error) {
    logError("error", "queue_job_failed", {
      eventType,
      syncEventId,
      errorMessage: error.message,
    }, error);

    throw error;
  }
}

/**
 * Parse order status from webhook event type
 */
function parseOrderStatus(eventType) {
  const statusMap = {
    [WEBHOOK_EVENTS.ORDER_CONFIRM]: "confirmed",
    [WEBHOOK_EVENTS.ORDER_SHIPPED]: "shipped",
    [WEBHOOK_EVENTS.ORDER_DELIVERED]: "delivered",
    [WEBHOOK_EVENTS.ORDER_CANCELLED]: "cancelled",
  };
  return statusMap[eventType] || "unknown";
}

/**
 * Parse invoice status from webhook event type
 */
function parseInvoiceStatus(eventType) {
  const statusMap = {
    [WEBHOOK_EVENTS.INVOICE_POSTED]: "posted",
    [WEBHOOK_EVENTS.INVOICE_PAID]: "paid",
    [WEBHOOK_EVENTS.INVOICE_CANCELLED]: "cancelled",
  };
  return statusMap[eventType] || "unknown";
}

/**
 * Scheduled sync for events (fallback when webhooks unavailable)
 * Queries Odoo for changes since last sync
 * @param {string} entityType - Type to sync (products, orders, invoices, inventory)
 * @returns {object} { synced, failed }
 */
async function scheduledSync(entityType) {
  try {
    const lastSyncTime = await getLastSyncTime(entityType);
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    logError("info", `scheduled_sync_start`, {
      entityType,
      lastSyncTime,
      cutoffTime,
    });

    const changes = await fetchChangesFromOdoo(
      entityType,
      lastSyncTime || cutoffTime
    );

    let synced = 0;
    let failed = 0;

    for (const change of changes) {
      try {
        const eventType = determineEventType(entityType, change);
        await processWebhook({
          event: eventType,
          data: change,
          timestamp: change.write_date || new Date(),
          id: `scheduled_${entityType}_${change.id}_${Date.now()}`,
        });
        synced++;
      } catch (error) {
        failed++;
        logError("error", "scheduled_sync_item_failed", {
          entityType,
          changeId: change.id,
          errorMessage: error.message,
        }, error);
      }
    }

    // Update last sync time
    await updateLastSyncTime(entityType);

    logError("info", "scheduled_sync_complete", {
      entityType,
      synced,
      failed,
    });

    return { synced, failed };
  } catch (error) {
    logError("error", "scheduled_sync_failed", {
      entityType,
      errorMessage: error.message,
    }, error);

    throw error;
  }
}

/**
 * Fetch changes from Odoo since last sync
 */
async function fetchChangesFromOdoo(entityType, sinceTime) {
  const { withRetry } = require("../../utils/retry.util");
  const { getClient } = require("./auth.service");

  const client = await getClient();
  const modelMap = {
    products: "product.product",
    inventory: "stock.quant",
    orders: "sale.order",
    invoices: "account.move",
  };

  const model = modelMap[entityType];
  const domain = [["write_date", ">=", sinceTime.toISOString()]];

  return await withRetry(
    () =>
      client.call(model, "search_read", domain, {
        fields: ["id", "name", "write_date"],
        limit: 100,
      }),
    `Fetch ${entityType} changes from Odoo`,
    { maxRetries: 3 }
  );
}

/**
 * Get last sync time for entity type
 */
async function getLastSyncTime(entityType) {
  const SyncLog = require("../../models/SyncLog");
  const log = await SyncLog.findOne({ entityType }).sort({ syncTime: -1 });
  return log?.syncTime || null;
}

/**
 * Update last sync time
 */
async function updateLastSyncTime(entityType) {
  const SyncLog = require("../../models/SyncLog");
  await SyncLog.create({
    entityType,
    syncTime: new Date(),
    status: "success",
  });
}

/**
 * Determine event type from change data
 */
function determineEventType(entityType, change) {
  const baseMap = {
    products: WEBHOOK_EVENTS.PRODUCT_UPDATE,
    inventory: WEBHOOK_EVENTS.INVENTORY_UPDATE,
    orders: WEBHOOK_EVENTS.ORDER_CONFIRM,
    invoices: WEBHOOK_EVENTS.INVOICE_POSTED,
  };
  return baseMap[entityType] || null;
}

module.exports = {
  processWebhook,
  scheduledSync,
  WEBHOOK_EVENTS,
  verifyWebhookSignature,
};
