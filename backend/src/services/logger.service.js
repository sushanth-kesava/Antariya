const env = require("../config/env");

/**
 * Lightweight structured logger.
 * Outputs JSON in production (machine-parseable for log aggregation services
 * like Render's built-in log viewer, Papertrail, Datadog, etc.).
 * In development, outputs human-readable colored logs.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || "info"] || LOG_LEVELS.info;
const IS_PRODUCTION = env.nodeEnv === "production";

function formatLog(level, message, meta = {}) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return null;

  if (IS_PRODUCTION) {
    // JSON structured log for production log aggregators
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    });
  }

  // Human-readable for development
  const colors = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" };
  const reset = "\x1b[0m";
  const color = colors[level] || "";
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `${color}[${level.toUpperCase()}]${reset} ${message}${metaStr}`;
}

function debug(message, meta) {
  const line = formatLog("debug", message, meta);
  if (line) console.debug(line);
}

function info(message, meta) {
  const line = formatLog("info", message, meta);
  if (line) console.log(line);
}

function warn(message, meta) {
  const line = formatLog("warn", message, meta);
  if (line) console.warn(line);
}

function error(message, meta) {
  const line = formatLog("error", message, meta);
  if (line) console.error(line);
}

module.exports = { debug, info, warn, error, LOG_LEVELS };
