const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const { resolveEffectivePermissions, setHasPermission } = require("../services/rbac.service");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authorization token is required",
    });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

function requireRole(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles.map((role) => String(role).trim().toLowerCase());

  return function roleGuard(req, res, next) {
    const currentRole = String(req.auth?.role || "").trim().toLowerCase();

    if (!currentRole || !normalizedAllowedRoles.includes(currentRole)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    return next();
  };
}

/**
 * Resolve the acting account (AdminProfile or User) from the JWT and attach a
 * normalized identity + effective permission set to req.actor. Must run after
 * requireAuth. Cached on req so multiple guards don't re-query.
 */
async function loadActor(req, res, next) {
  try {
    if (req.actor) {
      return next();
    }

    const email = String(req.auth?.email || "").trim().toLowerCase();
    const userId = req.auth?.sub || null;
    const legacyRole = String(req.auth?.role || "").trim().toLowerCase();

    let account = null;

    if (email) {
      account =
        (await AdminProfile.findOne({ email })) || (await User.findOne({ email }));
    }

    if (!account && userId) {
      account = (await AdminProfile.findById(userId)) || (await User.findById(userId));
    }

    const identity = {
      id: account?._id ? account._id.toString() : userId,
      email: email || account?.email || null,
      displayName: account?.displayName || null,
      role: legacyRole || account?.role || "customer",
      roleKey: account?.roleKey || null,
      customPermissions: account?.customPermissions || [],
      deniedPermissions: account?.deniedPermissions || [],
      active: account?.active !== false,
    };

    const { set, isSuperadmin } = await resolveEffectivePermissions(identity);

    req.actor = {
      ...identity,
      isSuperadmin,
      permissions: set,
      permissionList: [...set],
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Guard a route by permission key(s). Passing multiple keys requires ALL of
 * them (AND). Use requireAnyPermission for OR semantics. Runs requireAuth +
 * loadActor implicitly if they haven't run yet is NOT done here — chain them
 * explicitly in the route: requireAuth, loadActor, requirePermission("x").
 */
function requirePermission(...required) {
  const needed = required.map((r) => String(r).trim()).filter(Boolean);

  return async function permissionGuard(req, res, next) {
    try {
      if (!req.actor) {
        await loadActor(req, res, () => {});
      }

      if (req.actor && req.actor.active === false) {
        return res.status(403).json({
          success: false,
          message: "Your account is deactivated.",
        });
      }

      const permissionSet = req.actor?.permissions || new Set();
      const missing = needed.filter((key) => !setHasPermission(permissionSet, key));

      if (missing.length > 0) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
          missingPermissions: missing,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** OR-semantics variant: passes if the actor has ANY of the listed keys. */
function requireAnyPermission(...required) {
  const needed = required.map((r) => String(r).trim()).filter(Boolean);

  return async function anyPermissionGuard(req, res, next) {
    try {
      if (!req.actor) {
        await loadActor(req, res, () => {});
      }

      const permissionSet = req.actor?.permissions || new Set();
      const ok = needed.some((key) => setHasPermission(permissionSet, key));

      if (!ok) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
          requiredAnyOf: needed,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  requireAuth,
  requireRole,
  loadActor,
  requirePermission,
  requireAnyPermission,
};
