/**
 * Input Validation Middleware
 * Schema-based validation for request data
 *
 * @module validationMiddleware
 * @description
 * Provides:
 * - Schema-based validation
 * - Type checking
 * - Range/length validation
 * - Email/URL format validation
 * - Sanitization
 */

const { AppError, ErrorTypes } = require("./error-handler.middleware");

/**
 * Validator class for schema-based validation
 */
class Validator {
  constructor() {
    this.schemas = {};
  }

  /**
   * Register validation schema
   * @param {string} name - Schema name
   * @param {object} schema - Validation schema
   */
  registerSchema(name, schema) {
    this.schemas[name] = schema;
  }

  /**
   * Get registered schema
   */
  getSchema(name) {
    return this.schemas[name];
  }

  /**
   * Validate data against schema
   * @param {object} data - Data to validate
   * @param {object} schema - Validation schema
   * @returns {{valid: boolean, errors: Array}}
   */
  validate(data, schema) {
    const errors = [];

    Object.keys(schema).forEach((field) => {
      const rule = schema[field];
      const value = data[field];

      // Required check
      if (rule.required && (value === undefined || value === null || value === "")) {
        errors.push(`${field} is required`);
        return;
      }

      // Skip validation if not required and empty
      if (!rule.required && (value === undefined || value === null || value === "")) {
        return;
      }

      // Type check
      if (rule.type) {
        const actualType = Array.isArray(value) ? "array" : typeof value;
        if (actualType !== rule.type) {
          errors.push(`${field} must be of type ${rule.type}, got ${actualType}`);
          return;
        }
      }

      // Min/Max length for strings
      if (rule.minLength && typeof value === "string" && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters`);
      }

      if (rule.maxLength && typeof value === "string" && value.length > rule.maxLength) {
        errors.push(`${field} must not exceed ${rule.maxLength} characters`);
      }

      // Min/Max for numbers
      if (rule.min !== undefined && typeof value === "number" && value < rule.min) {
        errors.push(`${field} must be at least ${rule.min}`);
      }

      if (rule.max !== undefined && typeof value === "number" && value > rule.max) {
        errors.push(`${field} must not exceed ${rule.max}`);
      }

      // Email validation
      if (rule.type === "email" || (rule.isEmail && typeof value === "string")) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${field} must be a valid email`);
        }
      }

      // Custom validator
      if (rule.custom && typeof rule.custom === "function") {
        const customError = rule.custom(value);
        if (customError) {
          errors.push(`${field}: ${customError}`);
        }
      }

      // Enum values
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rule.enum.join(", ")}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Middleware factory for route validation
   */
  middleware(schemaName, source = "body") {
    return (req, res, next) => {
      const schema = this.getSchema(schemaName);
      if (!schema) {
        return next(new AppError(`Schema '${schemaName}' not found`, 500));
      }

      const data = req[source] || {};
      const validation = this.validate(data, schema);

      if (!validation.valid) {
        return next(
          new AppError(
            validation.errors.join("; "),
            ErrorTypes.VALIDATION.statusCode,
            ErrorTypes.VALIDATION.type
          )
        );
      }

      next();
    };
  }
}

// Global validator instance
const validator = new Validator();

/**
 * Register common validation schemas
 */
validator.registerSchema("createOrder", {
  customerId: {
    type: "number",
    required: true,
  },
  lines: {
    type: "array",
    required: true,
  },
  shippingAmount: {
    type: "number",
    min: 0,
    required: false,
  },
});

validator.registerSchema("createCustomer", {
  name: {
    type: "string",
    required: true,
    minLength: 2,
    maxLength: 255,
  },
  email: {
    type: "string",
    required: true,
    isEmail: true,
  },
});

validator.registerSchema("pagination", {
  offset: {
    type: "number",
    min: 0,
    required: false,
  },
  limit: {
    type: "number",
    min: 1,
    max: 100,
    required: false,
  },
});

/**
 * Generic input sanitizer
 * @param {object} data - Data to sanitize
 * @returns {object} Sanitized data
 */
function sanitize(data) {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  const sanitized = {};
  Object.keys(data).forEach((key) => {
    let value = data[key];

    // Trim strings
    if (typeof value === "string") {
      value = value.trim();
    }

    // Remove SQL-like patterns from strings
    if (typeof value === "string") {
      value = value.replace(/['"`;\\]/g, "");
    }

    sanitized[key] = value;
  });

  return sanitized;
}

/**
 * Validate pagination parameters
 * @param {number} offset - Offset value
 * @param {number} limit - Limit value
 * @throws {AppError} If validation fails
 */
function validatePagination(offset, limit) {
  offset = parseInt(offset) || 0;
  limit = parseInt(limit) || 20;

  if (offset < 0) {
    throw new AppError("Offset must be non-negative", 400, "validation");
  }

  if (limit < 1 || limit > 100) {
    throw new AppError("Limit must be between 1 and 100", 400, "validation");
  }

  return { offset, limit };
}

/**
 * Validate date range
 * @param {string} fromDate - From date (YYYY-MM-DD)
 * @param {string} toDate - To date (YYYY-MM-DD)
 * @throws {AppError} If validation fails
 */
function validateDateRange(fromDate, toDate) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(fromDate)) {
    throw new AppError("fromDate must be in format YYYY-MM-DD", 400, "validation");
  }

  if (!dateRegex.test(toDate)) {
    throw new AppError("toDate must be in format YYYY-MM-DD", 400, "validation");
  }

  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (from > to) {
    throw new AppError("fromDate must be before toDate", 400, "validation");
  }

  return { fromDate, toDate };
}

/**
 * Validate ID parameter
 * @param {string|number} id - ID to validate
 * @throws {AppError} If invalid
 */
function validateId(id) {
  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    throw new AppError("Invalid ID format", 400, "validation");
  }
  return numId;
}

module.exports = {
  Validator,
  validator,
  sanitize,
  validatePagination,
  validateDateRange,
  validateId,
};
