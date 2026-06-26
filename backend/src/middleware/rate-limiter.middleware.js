/**
 * Rate Limiting Middleware
 * Protect API from abuse with per-user/IP rate limiting
 *
 * @module rateLimitingMiddleware
 * @description
 * Provides:
 * - IP-based rate limiting
 * - User-based rate limiting
 * - Sliding window algorithm
 * - Configurable limits per endpoint
 * - Rate limit headers
 */

const { AppError, ErrorTypes } = require("./error-handler.middleware");

/**
 * In-memory rate limiter
 * In production, use Redis for distributed rate limiting
 */
class RateLimiter {
  constructor(options = {}) {
    this.window = options.window || 60 * 1000; // 1 minute default
    this.maxRequests = options.maxRequests || 100;
    this.store = new Map();
    this.cleanupInterval = setInterval(() => this._cleanup(), 60 * 1000);
  }

  /**
   * Check if request is allowed
   * @param {string} key - Rate limit key (IP, user ID, etc.)
   * @returns {{allowed: boolean, current: number, limit: number, resetTime: number}}
   */
  checkLimit(key) {
    const now = Date.now();
    let requests = this.store.get(key) || [];

    // Remove old requests outside the window
    requests = requests.filter((time) => now - time < this.window);

    const allowed = requests.length < this.maxRequests;

    if (allowed) {
      requests.push(now);
    }

    this.store.set(key, requests);

    // Calculate reset time
    const oldestRequest = requests[0];
    const resetTime = oldestRequest ? oldestRequest + this.window : now + this.window;

    return {
      allowed,
      current: requests.length,
      limit: this.maxRequests,
      resetTime,
      resetIn: Math.ceil((resetTime - now) / 1000),
    };
  }

  /**
   * Cleanup old entries
   * @private
   */
  _cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.store.entries()) {
      const active = requests.filter((time) => now - time < this.window);
      if (active.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, active);
      }
    }
  }

  /**
   * Destroy limiter and cleanup
   */
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * Create rate limiting middleware
 * @param {object} options - Configuration
 * @param {number} options.window - Time window in milliseconds (default: 60000)
 * @param {number} options.maxRequests - Max requests per window (default: 100)
 * @param {function} options.keyGenerator - Function to generate rate limit key (default: IP)
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const limiter = new RateLimiter({
    window: options.window || 60 * 1000,
    maxRequests: options.maxRequests || 100,
  });

  const keyGenerator = options.keyGenerator || ((req) => getClientIp(req));

  return (req, res, next) => {
    const key = keyGenerator(req);
    const limit = limiter.checkLimit(key);

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", limit.limit);
    res.setHeader("X-RateLimit-Current", limit.current);
    res.setHeader("X-RateLimit-Reset", Math.floor(limit.resetTime / 1000));

    if (!limit.allowed) {
      return next(
        new AppError(
          `Rate limit exceeded. Try again in ${limit.resetIn} seconds`,
          ErrorTypes.RATE_LIMIT.statusCode,
          ErrorTypes.RATE_LIMIT.type,
          { retryAfter: limit.resetIn }
        )
      );
    }

    // For reference
    req.rateLimit = limit;
    next();
  };
}

/**
 * Get client IP address
 * Handles proxies and load balancers
 * @param {object} req - Express request
 * @returns {string} Client IP
 */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

/**
 * Per-endpoint rate limiters
 * Different limits for different endpoints
 */
const RATE_LIMITS = {
  // Dashboard endpoints (more frequent access allowed)
  dashboard: {
    window: 60 * 1000,
    maxRequests: 60,
  },
  // Data retrieval (moderate access)
  retrieve: {
    window: 60 * 1000,
    maxRequests: 30,
  },
  // Data modification (stricter limits)
  create: {
    window: 60 * 1000,
    maxRequests: 10,
  },
  update: {
    window: 60 * 1000,
    maxRequests: 10,
  },
  delete: {
    window: 60 * 1000,
    maxRequests: 5,
  },
  // Authentication (very strict)
  auth: {
    window: 15 * 60 * 1000,
    maxRequests: 5,
  },
};

/**
 * Create configured rate limiters for different endpoint types
 */
const limiters = {
  dashboard: createRateLimiter(RATE_LIMITS.dashboard),
  retrieve: createRateLimiter(RATE_LIMITS.retrieve),
  create: createRateLimiter(RATE_LIMITS.create),
  update: createRateLimiter(RATE_LIMITS.update),
  delete: createRateLimiter(RATE_LIMITS.delete),
  auth: createRateLimiter(RATE_LIMITS.auth),
};

module.exports = {
  RateLimiter,
  createRateLimiter,
  getClientIp,
  RATE_LIMITS,
  limiters,
};
