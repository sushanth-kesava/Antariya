/**
 * Redis Cache Manager
 * Production-grade caching with TTL and invalidation
 *
 * @module cacheManager
 * @description
 * Provides:
 * - Cache-first architecture
 * - Automatic TTL expiration
 * - Cache invalidation on data changes
 * - Batch operations
 * - Performance tracking
 */

const { Redis } = require("ioredis");
const { logError } = require("../../middleware/error-handler.middleware");

const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

/**
 * Cache configuration with TTLs
 */
const CACHE_CONFIG = {
  // Products
  product: {
    ttl: 3600, // 1 hour
    key: (id) => `product:${id}`,
  },
  products_list: {
    ttl: 1800, // 30 minutes
    key: () => "products:list",
  },
  categories: {
    ttl: 3600, // 1 hour
    key: () => "categories",
  },
  collections: {
    ttl: 3600,
    key: () => "collections",
  },

  // Inventory
  inventory: {
    ttl: 300, // 5 minutes (critical)
    key: (productId) => `inventory:${productId}`,
  },
  inventory_summary: {
    ttl: 600, // 10 minutes
    key: () => "inventory:summary",
  },

  // Dashboard
  dashboard_today: {
    ttl: 300, // 5 minutes
    key: () => "dashboard:today",
  },
  dashboard_monthly: {
    ttl: 1800, // 30 minutes
    key: () => "dashboard:monthly",
  },
  dashboard_top_products: {
    ttl: 3600, // 1 hour
    key: () => "dashboard:top-products",
  },
  dashboard_revenue: {
    ttl: 1800,
    key: () => "dashboard:revenue",
  },

  // Orders
  order: {
    ttl: 3600,
    key: (id) => `order:${id}`,
  },

  // Customers
  customer: {
    ttl: 1800, // Don't cache authenticated customer data
    key: (id) => `customer:${id}`,
  },
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {*} Cached value or null
 */
async function getCache(key) {
  try {
    const value = await redisClient.get(key);
    if (value) {
      logError("debug", "cache_hit", { key });
      return JSON.parse(value);
    }
    logError("debug", "cache_miss", { key });
    return null;
  } catch (error) {
    logError("error", "cache_get_failed", { key }, error);
    return null;
  }
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 */
async function setCache(key, value, ttl) {
  try {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redisClient.setex(key, ttl, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
    logError("debug", "cache_set", { key, ttl });
  } catch (error) {
    logError("error", "cache_set_failed", { key }, error);
  }
}

/**
 * Get or fetch with callback
 * Cache-first pattern
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not in cache
 * @param {number} ttl - TTL in seconds
 * @returns {*} Cached or fetched value
 */
async function getOrFetch(key, fetchFn, ttl) {
  try {
    // Try cache first
    let value = await getCache(key);
    if (value) return value;

    // Cache miss - fetch data
    value = await fetchFn();

    // Cache the result
    if (value) {
      await setCache(key, value, ttl);
    }

    return value;
  } catch (error) {
    logError("error", "cache_get_or_fetch_failed", { key }, error);
    throw error;
  }
}

/**
 * Invalidate single cache key
 */
async function invalidateCache(key) {
  try {
    const result = await redisClient.del(key);
    logError("info", "cache_invalidated", { key, keysDeleted: result });
  } catch (error) {
    logError("error", "cache_invalidate_failed", { key }, error);
  }
}

/**
 * Invalidate multiple cache keys
 */
async function invalidateCachePattern(pattern) {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logError("info", "cache_pattern_invalidated", { pattern, keysDeleted: keys.length });
    }
  } catch (error) {
    logError("error", "cache_pattern_invalidate_failed", { pattern }, error);
  }
}

/**
 * Invalidate cache on product change
 */
async function invalidateProductCache(productId) {
  await Promise.all([
    invalidateCache(CACHE_CONFIG.product.key(productId)),
    invalidateCache(CACHE_CONFIG.products_list.key()),
    invalidateCache(CACHE_CONFIG.categories.key()),
    invalidateCachePattern("dashboard:*"),
  ]);
}

/**
 * Invalidate cache on inventory change
 */
async function invalidateInventoryCache(productId) {
  await Promise.all([
    invalidateCache(CACHE_CONFIG.inventory.key(productId)),
    invalidateCache(CACHE_CONFIG.inventory_summary.key()),
    invalidateCachePattern("dashboard:*"),
  ]);
}

/**
 * Invalidate cache on order change
 */
async function invalidateOrderCache(orderId) {
  await Promise.all([
    invalidateCache(CACHE_CONFIG.order.key(orderId)),
    invalidateCachePattern("dashboard:*"),
  ]);
}

/**
 * Clear all caches
 */
async function clearAllCache() {
  try {
    await redisClient.flushdb();
    logError("info", "all_cache_cleared");
  } catch (error) {
    logError("error", "clear_all_cache_failed", {}, error);
  }
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  try {
    const info = await redisClient.info("memory");
    const dbSize = await redisClient.dbsize();

    return {
      info: info,
      dbSize: dbSize,
      timestamp: new Date(),
    };
  } catch (error) {
    logError("error", "cache_stats_failed", {}, error);
    return null;
  }
}

/**
 * Batch cache operations
 */
async function batchGetCache(keys) {
  try {
    const values = await redisClient.mget(...keys);
    return keys.map((key, index) => ({
      key,
      value: values[index] ? JSON.parse(values[index]) : null,
    }));
  } catch (error) {
    logError("error", "batch_cache_get_failed", { keyCount: keys.length }, error);
    return [];
  }
}

/**
 * Cache warming (pre-populate cache)
 */
async function warmCache(data) {
  try {
    const pipeline = redisClient.pipeline();

    for (const [key, value, ttl] of data) {
      pipeline.setex(key, ttl, JSON.stringify(value));
    }

    await pipeline.exec();
    logError("info", "cache_warmed", { itemsAdded: data.length });
  } catch (error) {
    logError("error", "cache_warming_failed", {}, error);
  }
}

/**
 * Monitor cache performance
 */
async function monitorCache() {
  try {
    const stats = await redisClient.info("stats");
    const memory = await redisClient.info("memory");

    return {
      stats: stats,
      memory: memory,
      timestamp: new Date(),
    };
  } catch (error) {
    logError("error", "cache_monitoring_failed", {}, error);
    return null;
  }
}

// Connection handlers
redisClient.on("connect", () => {
  logError("info", "redis_cache_connected");
});

redisClient.on("error", (error) => {
  logError("error", "redis_cache_error", {}, error);
});

module.exports = {
  redisClient,
  CACHE_CONFIG,
  getCache,
  setCache,
  getOrFetch,
  invalidateCache,
  invalidateCachePattern,
  invalidateProductCache,
  invalidateInventoryCache,
  invalidateOrderCache,
  clearAllCache,
  getCacheStats,
  batchGetCache,
  warmCache,
  monitorCache,
};
