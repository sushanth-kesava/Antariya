const env = require("../config/env");

const COOKIE_NAME = "app_auth_token";
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Set the JWT as an HttpOnly cookie in the response.
 * Call this after successful authentication instead of (or in addition to)
 * returning the token in the JSON body.
 */
function setAuthCookie(res, token) {
  const isProduction = env.nodeEnv === "production";

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,          // Not accessible via JS (XSS protection)
    secure: isProduction,    // HTTPS only in production
    sameSite: isProduction ? "none" : "lax", // cross-origin (frontend on different domain)
    maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
    path: "/",
  });
}

/**
 * Clear the auth cookie (logout).
 */
function clearAuthCookie(res) {
  const isProduction = env.nodeEnv === "production";

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

/**
 * Middleware that extracts the JWT from the HttpOnly cookie when no
 * Authorization header is present. This allows gradual migration — clients
 * that send a Bearer token still work, while cookie-based clients are also
 * supported.
 */
function extractCookieToken(req, res, next) {
  const authHeader = req.headers.authorization || "";

  // If there's already a Bearer token in the header, skip cookie extraction
  if (authHeader.startsWith("Bearer ") && authHeader.length > 7) {
    return next();
  }

  // Extract from HttpOnly cookie
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    req.headers.authorization = `Bearer ${cookieToken}`;
  }

  return next();
}

module.exports = {
  setAuthCookie,
  clearAuthCookie,
  extractCookieToken,
  COOKIE_NAME,
};
