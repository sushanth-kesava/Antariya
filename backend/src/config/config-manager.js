/**
 * Environment Configuration and Validation
 * Centralized configuration management with validation
 *
 * @module configManager
 * @description
 * Provides:
 * - Environment variable validation
 * - Type checking and defaults
 * - Required variable enforcement
 * - Configuration schema
 * - Runtime validation
 */

const fs = require("fs");
const path = require("path");

/**
 * Configuration Schema
 * Defines all required and optional configuration
 */
const CONFIG_SCHEMA = {
  // Server
  NODE_ENV: {
    type: "string",
    enum: ["development", "production", "staging"],
    default: "development",
    required: true,
  },
  PORT: {
    type: "number",
    default: 5000,
    min: 1000,
    max: 65535,
  },
  HOST: {
    type: "string",
    default: "0.0.0.0",
  },

  // Database
  MONGO_URI: {
    type: "string",
    required: true,
    description: "MongoDB connection string",
  },

  // Frontend URLs
  FRONTEND_URL: {
    type: "string",
    required: false,
    description: "Primary frontend URL",
  },
  FRONTEND_URLS: {
    type: "string",
    required: false,
    description: "Comma-separated list of allowed frontend URLs",
  },

  // Odoo Configuration
  ODOO_URL: {
    type: "string",
    required: true,
    description: "Odoo instance URL (e.g., https://your-odoo.com)",
  },
  ODOO_DB: {
    type: "string",
    required: true,
    description: "Odoo database name",
  },
  ODOO_USERNAME: {
    type: "string",
    required: true,
    description: "Odoo username",
  },
  ODOO_PASSWORD: {
    type: "string",
    required: true,
    description: "Odoo password",
    sensitive: true,
  },

  // Shipping Configuration (Optional)
  SHIPPING_PROVIDER: {
    type: "string",
    enum: ["shiprocket", "dhl", "fedex", "bluedart"],
    default: "shiprocket",
  },
  SHIPROCKET_API_KEY: {
    type: "string",
    required: false,
    sensitive: true,
  },
  SHIPROCKET_EMAIL: {
    type: "string",
    required: false,
  },
  SHIPROCKET_PASSWORD: {
    type: "string",
    required: false,
    sensitive: true,
  },

  // API Configuration
  API_RATE_LIMIT: {
    type: "number",
    default: 100,
    description: "Requests per minute",
  },
  CACHE_TTL: {
    type: "number",
    default: 300,
    description: "Cache time-to-live in seconds",
  },

  // Logging
  LOG_LEVEL: {
    type: "string",
    enum: ["debug", "info", "warn", "error"],
    default: "info",
  },

  // JWT (if needed for future auth)
  JWT_SECRET: {
    type: "string",
    required: false,
    sensitive: true,
  },
  JWT_EXPIRY: {
    type: "string",
    default: "7d",
  },
};

/**
 * Configuration Manager
 */
class ConfigManager {
  constructor(schema = CONFIG_SCHEMA) {
    this.schema = schema;
    this.config = {};
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Load and validate environment configuration
   * @throws {Error} If required configuration is missing or invalid
   */
  load() {
    console.log("[ConfigManager] Loading configuration...");

    Object.entries(this.schema).forEach(([key, rule]) => {
      const value = process.env[key];

      // Check required
      if (rule.required && !value) {
        this.errors.push(`Missing required config: ${key}`);
        return;
      }

      // Set default if not provided
      if (!value && rule.default !== undefined) {
        this.config[key] = rule.default;
        this.warnings.push(`Using default for ${key}: ${rule.default}`);
        return;
      }

      if (!value) {
        this.config[key] = null;
        return;
      }

      // Type checking
      let parsedValue = value;
      if (rule.type === "number") {
        parsedValue = parseInt(value);
        if (isNaN(parsedValue)) {
          this.errors.push(`${key} must be a number, got: ${value}`);
          return;
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        this.errors.push(`${key} must be one of: ${rule.enum.join(", ")}, got: ${value}`);
        return;
      }

      // Min/Max validation
      if (rule.min !== undefined && parsedValue < rule.min) {
        this.errors.push(`${key} must be >= ${rule.min}, got: ${parsedValue}`);
        return;
      }

      if (rule.max !== undefined && parsedValue > rule.max) {
        this.errors.push(`${key} must be <= ${rule.max}, got: ${parsedValue}`);
        return;
      }

      this.config[key] = rule.type === "number" ? parsedValue : value;
    });

    // Log warnings
    this.warnings.forEach((warning) => {
      console.warn(`[ConfigManager] ⚠️  ${warning}`);
    });

    // Throw if there are errors
    if (this.errors.length > 0) {
      console.error("[ConfigManager] Configuration errors:");
      this.errors.forEach((error) => console.error(`  ❌ ${error}`));
      throw new Error(`Configuration validation failed with ${this.errors.length} error(s)`);
    }

    console.log("[ConfigManager] ✅ Configuration loaded successfully");
    return this.config;
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * Check if configuration is valid
   * @returns {boolean}
   */
  isValid() {
    return this.errors.length === 0;
  }

  /**
   * Get all errors
   * @returns {string[]}
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Get configuration summary (safe, no sensitive data)
   * @returns {object}
   */
  getSummary() {
    const summary = {};
    Object.keys(this.config).forEach((key) => {
      const rule = this.schema[key];
      const isSensitive = rule && rule.sensitive;
      summary[key] = isSensitive ? "***REDACTED***" : this.config[key];
    });
    return summary;
  }

  /**
   * Print configuration summary
   */
  print() {
    console.log("[ConfigManager] Configuration Summary:");
    const summary = this.getSummary();
    Object.entries(summary).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  }
}

/**
 * Global configuration instance
 */
const configManager = new ConfigManager();

// Load configuration
let config;
try {
  config = configManager.load();
} catch (err) {
  console.error("[ConfigManager] ❌ Failed to load configuration:");
  console.error(err.message);
  process.exit(1);
}

/**
 * Convenience object for direct access
 */
const env = {
  nodeEnv: config.NODE_ENV,
  port: config.PORT,
  host: config.HOST,
  mongoUri: config.MONGO_URI,
  frontendUrl: config.FRONTEND_URL,
  frontendUrls: config.FRONTEND_URLS
    ? config.FRONTEND_URLS.split(",").map((url) => url.trim())
    : [config.FRONTEND_URL].filter(Boolean),
  odooUrl: config.ODOO_URL,
  odooDb: config.ODOO_DB,
  odooUsername: config.ODOO_USERNAME,
  odooPassword: config.ODOO_PASSWORD,
  shippingProvider: config.SHIPPING_PROVIDER,
  shiprocketApiKey: config.SHIPROCKET_API_KEY,
  shiprocketEmail: config.SHIPROCKET_EMAIL,
  shiprocketPassword: config.SHIPROCKET_PASSWORD,
  apiRateLimit: config.API_RATE_LIMIT,
  cacheTtl: config.CACHE_TTL,
  logLevel: config.LOG_LEVEL,
  jwtSecret: config.JWT_SECRET,
  jwtExpiry: config.JWT_EXPIRY,
  isProduction: config.NODE_ENV === "production",
  isDevelopment: config.NODE_ENV === "development",
};

module.exports = {
  ConfigManager,
  configManager,
  config,
  env,
  CONFIG_SCHEMA,
};
