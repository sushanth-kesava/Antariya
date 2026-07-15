const { recordError } = require("../services/errorlog.service");
const env = require("../config/env");

function notFound(req, res, next) {
  // Truncate reflected URL to prevent abuse (reflected XSS in JSON isn't
  // exploitable in modern browsers, but defense-in-depth doesn't hurt).
  const safePath = String(req.originalUrl || "").slice(0, 200);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${safePath}`,
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  // Persist server-side (5xx) errors so the Governance → Error Logs module can
  // surface them. Client (4xx) errors are expected and not logged to avoid
  // noise. Fire-and-forget: never block the response on logging.
  if (statusCode >= 500) {
    void recordError(err, req, statusCode);
  }

  const payload = {
    success: false,
    message,
  };

  // Only expose stack traces outside production to aid local debugging.
  if (env.nodeEnv !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = {
  notFound,
  errorHandler,
};
