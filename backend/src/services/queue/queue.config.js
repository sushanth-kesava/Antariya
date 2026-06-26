/**
 * BullMQ Queue Configuration
 * Production-grade job queue for long-running operations
 *
 * @module queueConfig
 * @description
 * Provides:
 * - Redis-backed job queue
 * - Retry policies with exponential backoff
 * - Job prioritization
 * - Graceful worker management
 * - Event tracking
 */

const Queue = require("bullmq");
const { Redis } = require("ioredis");
const { logError } = require("../../middleware/error-handler.middleware");

// Redis connection
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

// Connection event logging
redisClient.on("connect", () => {
  logError("info", "redis_connected", { host: process.env.REDIS_HOST });
});

redisClient.on("error", (error) => {
  logError("error", "redis_error", {}, error);
});

/**
 * Sync Queue Configuration
 * Handles all Odoo synchronization operations
 */
const syncQueue = new Queue("odoo-sync", {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
    },
    removeOnFail: false, // Keep failed jobs for analysis
  },
});

/**
 * Product Sync Queue
 * High priority for keeping product catalog current
 */
const productQueue = new Queue("product-sync", {
  connection: redisClient,
  defaultJobOptions: {
    priority: 10,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

/**
 * Inventory Sync Queue
 * Critical priority - inventory accuracy is key
 */
const inventoryQueue = new Queue("inventory-sync", {
  connection: redisClient,
  defaultJobOptions: {
    priority: 20, // Higher priority
    attempts: 5, // More retries for inventory
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

/**
 * Order Sync Queue
 * High priority - business critical
 */
const orderQueue = new Queue("order-sync", {
  connection: redisClient,
  defaultJobOptions: {
    priority: 15,
    attempts: 4,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

/**
 * Invoice Sync Queue
 * Medium priority - financial data
 */
const invoiceQueue = new Queue("invoice-sync", {
  connection: redisClient,
  defaultJobOptions: {
    priority: 12,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

/**
 * Email Queue
 * Low priority - notifications
 */
const emailQueue = new Queue("email-send", {
  connection: redisClient,
  defaultJobOptions: {
    priority: 5,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

/**
 * Media Sync Queue
 * Medium priority - product images
 */
const mediaQueue = new Queue("media-sync", {
  connection: redisClient,
  defaultJobOptions: {
    priority: 8,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
  },
});

/**
 * Report Generation Queue
 * Low priority - analytics
 */
const reportQueue = new Queue("report-generate", {
  connection: redisClient,
  defaultJobOptions: {
    priority: 3,
    attempts: 2,
  },
});

/**
 * Dead Letter Queue
 * Jobs that failed after all retries
 */
const dlq = new Queue("dead-letter", {
  connection: redisClient,
});

/**
 * Setup queue event listeners
 */
function setupQueueListeners(queue, queueName) {
  queue.on("active", (job) => {
    logError("info", `${queueName}_job_active`, {
      jobId: job.id,
      jobName: job.name,
      progress: job.progress(),
    });
  });

  queue.on("completed", (job) => {
    logError("info", `${queueName}_job_completed`, {
      jobId: job.id,
      jobName: job.name,
      duration: job.finishedOn - job.processedOn,
    });
  });

  queue.on("failed", (job, error) => {
    logError("error", `${queueName}_job_failed`, {
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      errorMessage: error.message,
    }, error);

    // Move to DLQ if all retries exhausted
    if (job.attemptsMade >= job.opts.attempts) {
      dlq.add(`${queueName}-${job.name}`, job.data, {
        attempts: 0,
      });
      logError("warn", "job_moved_to_dlq", {
        jobId: job.id,
        queueName,
      });
    }
  });

  queue.on("stalled", (jobId) => {
    logError("warn", `${queueName}_job_stalled`, {
      jobId,
    });
  });

  queue.on("error", (error) => {
    logError("error", `${queueName}_queue_error`, {}, error);
  });
}

// Setup listeners for all queues
[syncQueue, productQueue, inventoryQueue, orderQueue, invoiceQueue, emailQueue, mediaQueue, reportQueue].forEach(
  (queue, index) => {
    const queueNames = ["sync", "product", "inventory", "order", "invoice", "email", "media", "report"];
    setupQueueListeners(queue, queueNames[index]);
  }
);

/**
 * Health check for queue system
 */
async function getQueueHealth() {
  try {
    const queues = [
      { queue: syncQueue, name: "sync" },
      { queue: productQueue, name: "product" },
      { queue: inventoryQueue, name: "inventory" },
      { queue: orderQueue, name: "order" },
      { queue: invoiceQueue, name: "invoice" },
      { queue: emailQueue, name: "email" },
      { queue: mediaQueue, name: "media" },
      { queue: reportQueue, name: "report" },
    ];

    const health = {};
    for (const { queue, name } of queues) {
      const counts = await queue.getCountsPerStatus();
      health[name] = {
        active: counts.active,
        waiting: counts.waiting,
        completed: counts.completed,
        failed: counts.failed,
      };
    }

    return {
      redis: "connected",
      queues: health,
    };
  } catch (error) {
    logError("error", "queue_health_check_failed", {}, error);
    return { error: error.message };
  }
}

/**
 * Graceful shutdown
 */
async function closeQueues() {
  try {
    const queues = [syncQueue, productQueue, inventoryQueue, orderQueue, invoiceQueue, emailQueue, mediaQueue, reportQueue];
    await Promise.all(queues.map((q) => q.close()));
    await redisClient.quit();
    logError("info", "queues_closed");
  } catch (error) {
    logError("error", "queue_close_failed", {}, error);
  }
}

module.exports = {
  redisClient,
  syncQueue,
  productQueue,
  inventoryQueue,
  orderQueue,
  invoiceQueue,
  emailQueue,
  mediaQueue,
  reportQueue,
  dlq,
  setupQueueListeners,
  getQueueHealth,
  closeQueues,
};
