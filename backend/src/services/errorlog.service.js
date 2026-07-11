const crypto = require("crypto");
const ErrorLog = require("../models/ErrorLog");

/**
 * Build a stable fingerprint so repeated occurrences of the same error (same
 * class, path, and status) merge into one row with an incremented count
 * instead of flooding the log.
 */
function fingerprintFor({ name, path, statusCode }) {
  const raw = `${name || "Error"}|${path || ""}|${statusCode || 500}`;
  return crypto.createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

/**
 * Persist (or merge) a captured error. Never throws — logging must not break
 * the request/response cycle.
 */
async function recordError(err, req, statusCode) {
  try {
    const name = err?.name || "Error";
    const path = req?.originalUrl || req?.path || null;
    const code = statusCode || err?.statusCode || 500;
    const fingerprint = fingerprintFor({ name, path, statusCode: code });

    const now = new Date();

    const existing = await ErrorLog.findOne({ fingerprint, resolved: false });

    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = now;
      existing.message = err?.message || existing.message;
      existing.stack = err?.stack || existing.stack;
      await existing.save();
      return existing;
    }

    return await ErrorLog.create({
      message: err?.message || "Internal server error",
      name,
      statusCode: code,
      stack: err?.stack || null,
      method: req?.method || null,
      path,
      query: req?.query || null,
      ip: req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || req?.ip || null,
      userAgent: req?.headers?.["user-agent"] || null,
      actorEmail: req?.actor?.email || req?.auth?.email || null,
      actorRole: req?.actor?.role || req?.auth?.role || null,
      fingerprint,
      count: 1,
      lastSeenAt: now,
    });
  } catch (loggingError) {
    // eslint-disable-next-line no-console
    console.error("Failed to persist error log:", loggingError.message);
    return null;
  }
}

module.exports = { recordError, fingerprintFor };
