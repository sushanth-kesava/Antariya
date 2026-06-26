/**
 * Retry Mechanism for Odoo API Calls
 * Implements exponential backoff with jitter
 *
 * @module retryMechanism
 * @description
 * Provides:
 * - Exponential backoff strategy
 * - Jitter to prevent thundering herd
 * - Configurable max retries and delays
 * - Retry predicates (which errors to retry)
 * - Comprehensive logging
 */

/**
 * Retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2.0,
  jitterFactor: 0.1, // 10% jitter
  retryableErrors: ["ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "503", "429"],
};

/**
 * Determine if error is retryable
 * @param {Error} error - Error to check
 * @param {string[]} retryableErrors - List of retryable error codes/messages
 * @returns {boolean}
 */
function isRetryableError(error, retryableErrors) {
  if (!error) return false;

  const errorStr = `${error.code || ""} ${error.message || ""}`.toUpperCase();

  return retryableErrors.some((code) => errorStr.includes(code.toUpperCase()));
}

/**
 * Calculate exponential backoff with jitter
 * @param {number} attempt - Retry attempt number (0-based)
 * @param {object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt, config) {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: ±10% of delay
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
  const finalDelay = Math.max(0, cappedDelay + jitter);

  return Math.round(finalDelay);
}

/**
 * Sleep for given milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 * @private
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for async functions
 * Automatically retries failed operations with exponential backoff
 *
 * @param {Function} fn - Async function to retry
 * @param {string} operationName - Name of operation (for logging)
 * @param {object} config - Retry configuration
 * @returns {Promise} Result of function
 *
 * @example
 * const result = await withRetry(
 *   () => client.call('model', 'method', params),
 *   'Fetch products',
 *   { maxRetries: 3 }
 * );
 */
async function withRetry(fn, operationName = "Operation", config = {}) {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1}: ${operationName}`);
      return await fn();
    } catch (error) {
      lastError = error;

      const isRetryable = isRetryableError(error, finalConfig.retryableErrors);
      const isLastAttempt = attempt === finalConfig.maxRetries;

      if (!isRetryable || isLastAttempt) {
        console.error(`[Retry] Failed (${isRetryable ? "non-retryable" : "max retries"}):`, {
          operation: operationName,
          attempt: attempt + 1,
          error: error.message,
        });
        throw error;
      }

      const delayMs = calculateBackoffDelay(attempt, finalConfig);
      console.warn(`[Retry] Backing off ${delayMs}ms before retry:`, {
        operation: operationName,
        attempt: attempt + 1,
        nextAttempt: attempt + 2,
        error: error.message,
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Retry decorator for class methods
 * @param {object} config - Retry configuration
 * @returns {Function} Decorator function
 *
 * @example
 * class OdooService {
 *   @retry({ maxRetries: 3 })
 *   async fetchProducts() {
 *     // Method implementation
 *   }
 * }
 */
function retry(config = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      return withRetry(
        () => originalMethod.apply(this, args),
        `${target.constructor.name}.${propertyKey}`,
        config
      );
    };

    return descriptor;
  };
}

/**
 * Circuit breaker pattern
 * Prevents cascading failures by stopping requests to failing service
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 60 * 1000;
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.name = options.name || "CircuitBreaker";
  }

  /**
   * Execute function through circuit breaker
   * @param {Function} fn - Function to execute
   * @returns {Promise} Result
   */
  async execute(fn) {
    if (this.state === "OPEN") {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure > this.resetTimeoutMs) {
        console.log(`[CircuitBreaker] ${this.name}: Transitioning to HALF_OPEN`);
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        throw new Error(
          `[${this.name}] Circuit breaker is OPEN. Retry in ${Math.ceil(
            (this.resetTimeoutMs - timeSinceLastFailure) / 1000
          )}s`
        );
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _onSuccess() {
    this.failureCount = 0;

    if (this.state === "HALF_OPEN") {
      this.successCount += 1;
      if (this.successCount >= 2) {
        console.log(`[CircuitBreaker] ${this.name}: Recovered, transitioning to CLOSED`);
        this.state = "CLOSED";
        this.successCount = 0;
      }
    }
  }

  _onFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      console.error(
        `[CircuitBreaker] ${this.name}: Circuit opened after ${this.failureCount} failures`
      );
      this.state = "OPEN";
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

module.exports = {
  withRetry,
  retry,
  CircuitBreaker,
  isRetryableError,
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
};
