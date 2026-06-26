/**
 * Centralized Error Handling
 * Unified error handling, logging, and response formatting
 *
 * @module errorHandler
 * @description
 * Provides:
 * - Structured error logging
 * - Consistent error responses
 * - Error classification (validation, auth, server, etc.)
 * - Safe error messages (no credential exposure)
 * - Error tracking/monitoring hooks
 */

/**
 * Custom Application Error
 * Extends Error with status code and error type
 */
class AppError extends Error {
  /**
   * Create application error
   * @param {string} message - Error message (user-facing)
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} type - Error type (validation, auth, business, server)
   * @param {object} metadata - Additional error context
   */
  constructor(message, statusCode = 500, type = "server", metadata = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.type = type;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON response
   */
  toJSON() {
    return {
      success: false,
      error: this.message,
      type: this.type,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === "development" && { stack: this.stack }),
    };
  }
}

/**
 * Error type mappings
 */
const ErrorTypes = {
  VALIDATION: { statusCode: 400, type: "validation" },
  UNAUTHORIZED: { statusCode: 401, type: "auth" },
  FORBIDDEN: { statusCode: 403, type: "permission" },
  NOT_FOUND: { statusCode: 404, type: "not_found" },
  CONFLICT: { statusCode: 409, type: "conflict" },
  RATE_LIMIT: { statusCode: 429, type: "rate_limit" },
  SERVER_ERROR: { statusCode: 500, type: "server" },
  SERVICE_UNAVAILABLE: { statusCode: 503, type: "unavailable" },
};

/**
 * Validate error and convert to AppError
 * @param {Error} error - Error to validate
 * @returns {AppError}
 */
function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  // Map known error patterns
  if (error.message.includes("not found")) {
    return new AppError(error.message, 404, "not_found");
  }

  if (error.message.includes("duplicate") || error.message.includes("already exists")) {
    return new AppError(error.message, 409, "conflict");
  }

  if (error.message.includes("unauthorized") || error.message.includes("authentication")) {
    return new AppError(error.message, 401, "auth");
  }

  // Default to server error
  return new AppError(
    error.message || "An unexpected error occurred",
    500,
    "server",
    { originalError: error.constructor.name }
  );
}

/**
 * Structured logging with context
 * @param {string} level - Log level (info, warn, error)
 * @param {string} action - Action/operation name
 * @param {object} data - Log data
 * @param {Error} error - Error object (optional)
 */
function logError(level, action, data = {}, error = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    action,
    ...data,
  };

  if (error) {
    logEntry.error = {
      message: error.message,
      type: error.constructor.name,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    };
  }

  // Use appropriate console method
  const logMethod = {
    info: console.log,
    warn: console.warn,
    error: console.error,
  }[level] || console.log;

  logMethod(`[${timestamp}] [${level.toUpperCase()}] ${action}:`, logEntry);

  // TODO: Send to error tracking service (Sentry, DataDog, etc.)
  // if (level === "error") {
  //   trackingService.captureException(error, logEntry);
  // }
}

/**
 * Express error handling middleware
 * Catches all errors and returns standardized response
 */
const errorHandler = (err, req, res, next) => {
  const appError = normalizeError(err);

  logError("error", req.path, {
    method: req.method,
    statusCode: appError.statusCode,
    type: appError.type,
    url: req.originalUrl,
  }, err);

  res.status(appError.statusCode).json(appError.toJSON());
};

/**
 * 404 Not Found middleware
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.method} ${req.path}`,
    404,
    "not_found"
  );
  next(error);
};

/**
 * Async route handler wrapper
 * Catches errors in async controllers and passes to error handler
 * Usage: router.get('/', asyncHandler(controllerFunction));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  ErrorTypes,
  normalizeError,
  logError,
  errorHandler,
  notFound,
  asyncHandler,
};
