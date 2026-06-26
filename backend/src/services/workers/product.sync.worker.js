/**
 * Product Sync Worker
 * Handles product create/update synchronization from Odoo to backend
 *
 * @module productSyncWorker
 * @description
 * Syncs product data:
 * - Product details (name, description, price)
 * - Categories
 * - Images and media
 * - Inventory links
 * - Cache invalidation
 */

const { Worker } = require("bullmq");
const { Redis } = require("ioredis");
const Product = require("../../models/Product");
const SyncEvent = require("../../models/SyncEvent");
const { getClient } = require("../odoo/auth.service");
const { withRetry } = require("../../utils/retry.util");
const { invalidateCache } = require("../cache/cache.manager");
const { logError } = require("../../middleware/error-handler.middleware");

const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

/**
 * Create product sync worker
 */
const productSyncWorker = new Worker(
  "odoo-sync",
  async (job) => {
    if (job.data.action === "product-sync") {
      return await syncProduct(job);
    }
  },
  {
    connection: redisClient,
    concurrency: 5, // Process 5 products concurrently
  }
);

/**
 * Sync single product from Odoo
 */
async function syncProduct(job) {
  const { productId, syncEventId, action } = job.data;

  try {
    // Fetch product from Odoo
    const odooProduct = await fetchOdooProduct(productId);

    if (!odooProduct) {
      throw new Error(`Product ${productId} not found in Odoo`);
    }

    // Determine if create or update
    const existingProduct = await Product.findOne({ odooId: productId });

    if (action === "create" || !existingProduct) {
      await createProductInBackend(odooProduct);
      logError("info", "product_created", {
        productId,
        name: odooProduct.name,
        syncEventId,
      });
    } else {
      await updateProductInBackend(existingProduct._id, odooProduct);
      logError("info", "product_updated", {
        productId,
        name: odooProduct.name,
        syncEventId,
      });
    }

    // Invalidate product cache
    await invalidateCache(`product:${productId}`);
    await invalidateCache("products:list");
    await invalidateCache("categories");

    // Update sync event
    await SyncEvent.updateOne(
      { _id: syncEventId },
      {
        status: "completed",
        processedAt: new Date(),
      }
    );

    job.progress(100);
    return { success: true, productId, synced: true };
  } catch (error) {
    logError("error", "product_sync_failed", {
      productId,
      syncEventId,
      attempt: job.attemptsMade,
      errorMessage: error.message,
    }, error);

    // Update sync event with error
    await SyncEvent.updateOne(
      { _id: syncEventId },
      {
        status: "failed",
        lastError: error.message,
        retryCount: job.attemptsMade,
      }
    );

    throw error;
  }
}

/**
 * Fetch product from Odoo
 */
async function fetchOdooProduct(productId) {
  const client = await getClient();

  return await withRetry(
    async () => {
      const [product] = await client.call("product.product", "read", [
        [productId],
        [
          "id",
          "name",
          "description",
          "price",
          "cost",
          "sku",
          "barcode",
          "categ_id",
          "image_1920",
          "list_price",
          "type",
          "weight",
          "volume",
        ],
      ]);

      return product;
    },
    "Fetch product from Odoo",
    { maxRetries: 3 }
  );
}

/**
 * Create product in backend
 */
async function createProductInBackend(odooProduct) {
  const product = new Product({
    odooId: odooProduct.id,
    name: odooProduct.name,
    description: odooProduct.description || "",
    sku: odooProduct.sku,
    barcode: odooProduct.barcode,
    price: odooProduct.list_price,
    cost: odooProduct.cost,
    category: odooProduct.categ_id?.[1],
    weight: odooProduct.weight,
    volume: odooProduct.volume,
    type: odooProduct.type,
    image: odooProduct.image_1920 ? Buffer.from(odooProduct.image_1920, "base64") : null,
    lastSyncedAt: new Date(),
  });

  await product.save();
  return product;
}

/**
 * Update product in backend
 */
async function updateProductInBackend(productId, odooProduct) {
  const updateData = {
    name: odooProduct.name,
    description: odooProduct.description || "",
    price: odooProduct.list_price,
    cost: odooProduct.cost,
    category: odooProduct.categ_id?.[1],
    weight: odooProduct.weight,
    volume: odooProduct.volume,
    lastSyncedAt: new Date(),
  };

  if (odooProduct.image_1920) {
    updateData.image = Buffer.from(odooProduct.image_1920, "base64");
  }

  await Product.findByIdAndUpdate(productId, updateData, { new: true });
}

// Worker event handlers
productSyncWorker.on("active", (job) => {
  logError("info", "product_worker_active", {
    jobId: job.id,
    productId: job.data.productId,
  });
});

productSyncWorker.on("completed", (job) => {
  logError("info", "product_worker_completed", {
    jobId: job.id,
    result: job.returnvalue,
  });
});

productSyncWorker.on("failed", (job, error) => {
  logError("error", "product_worker_failed", {
    jobId: job.id,
    productId: job.data.productId,
    errorMessage: error.message,
  }, error);
});

productSyncWorker.on("error", (error) => {
  logError("error", "product_worker_error", {}, error);
});

module.exports = { productSyncWorker, syncProduct };
