/* eslint-disable no-unused-vars */
const Role = require("../models/Role");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const AuditLog = require("../models/AuditLog");
const ErrorLog = require("../models/ErrorLog");
const RateLimitRule = require("../models/RateLimitRule");
const {
  PERMISSIONS,
  MODULE_META,
  DEFAULT_ROLES,
  WILDCARD,
  sanitizePermissionKeys,
} = require("../config/permissions");
const {
  invalidateRoleCache,
  recordAudit,
  resolveEffectivePermissions,
} = require("../services/rbac.service");
const {
  invalidateRuleCache: invalidateRateLimitCache,
  getActivitySnapshot,
} = require("../services/ratelimit.service");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function auditContext(req) {
  return {
    actorId: req.actor?.id || req.auth?.sub || null,
    actorEmail: req.actor?.email || req.auth?.email || null,
    actorRole: req.actor?.role || req.auth?.role || null,
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

function serializeRole(role) {
  return {
    id: role._id ? role._id.toString() : null,
    key: role.key,
    name: role.name,
    description: role.description || "",
    permissions: role.permissions || [],
    system: Boolean(role.system),
    locked: Boolean(role.locked),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

/** GET /erp/permissions — the full permission catalog + module metadata. */
async function getPermissionCatalog(req, res, next) {
  try {
    const modules = Object.entries(MODULE_META).map(([key, meta]) => ({
      key,
      label: meta.label,
      icon: meta.icon,
      permissions: PERMISSIONS.filter((p) => p.module === key).map((p) => ({
        key: p.key,
        label: p.label,
        description: p.description,
      })),
    }));

    return res.status(200).json({
      success: true,
      wildcard: WILDCARD,
      modules,
      permissions: PERMISSIONS,
    });
  } catch (error) {
    return next(error);
  }
}

/** GET /erp/me — the calling actor's identity + effective permissions. */
async function getMyAccess(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      actor: {
        id: req.actor?.id || null,
        email: req.actor?.email || null,
        displayName: req.actor?.displayName || null,
        role: req.actor?.role || null,
        roleKey: req.actor?.roleKey || null,
        isSuperadmin: Boolean(req.actor?.isSuperadmin),
        permissions: req.actor?.permissionList || [],
      },
    });
  } catch (error) {
    return next(error);
  }
}

/** GET /erp/roles — list all roles. */
async function listRoles(req, res, next) {
  try {
    const roles = await Role.find({}).sort({ system: -1, name: 1 });
    return res.status(200).json({
      success: true,
      roles: roles.map(serializeRole),
    });
  } catch (error) {
    return next(error);
  }
}

/** POST /erp/roles — create a custom role. */
async function createRole(req, res, next) {
  try {
    const key = String(req.body.key || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const name = String(req.body.name || "").trim();

    if (!key || !name) {
      return res.status(400).json({ success: false, message: "Role key and name are required." });
    }

    const existing = await Role.findOne({ key });
    if (existing) {
      return res.status(409).json({ success: false, message: `A role with key "${key}" already exists.` });
    }

    const permissions = sanitizePermissionKeys(req.body.permissions);

    const role = await Role.create({
      key,
      name,
      description: String(req.body.description || "").trim(),
      permissions,
      system: false,
      locked: false,
      createdBy: req.actor?.email || null,
      updatedBy: req.actor?.email || null,
    });

    invalidateRoleCache();

    await recordAudit({
      ...auditContext(req),
      action: "role.create",
      module: "governance",
      permissionUsed: "governance.roles.manage",
      targetType: "role",
      targetId: role._id.toString(),
      targetLabel: role.name,
      summary: `Created role "${role.name}" (${role.key}) with ${permissions.length} permissions.`,
      after: serializeRole(role),
    });

    return res.status(201).json({ success: true, role: serializeRole(role) });
  } catch (error) {
    return next(error);
  }
}

/** PATCH /erp/roles/:roleId — update a role's name/description/permissions. */
async function updateRole(req, res, next) {
  try {
    const role = await Role.findById(req.params.roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found." });
    }

    const before = serializeRole(role);

    if (typeof req.body.name === "string" && req.body.name.trim()) {
      role.name = req.body.name.trim();
    }
    if (typeof req.body.description === "string") {
      role.description = req.body.description.trim();
    }

    if (Array.isArray(req.body.permissions)) {
      if (role.locked) {
        return res.status(403).json({
          success: false,
          message: `The "${role.name}" role is locked and its permissions cannot be changed.`,
        });
      }
      role.permissions = sanitizePermissionKeys(req.body.permissions);
    }

    role.updatedBy = req.actor?.email || null;
    await role.save();
    invalidateRoleCache();

    await recordAudit({
      ...auditContext(req),
      action: "role.update",
      module: "governance",
      permissionUsed: "governance.roles.manage",
      targetType: "role",
      targetId: role._id.toString(),
      targetLabel: role.name,
      summary: `Updated role "${role.name}" (${role.key}).`,
      before,
      after: serializeRole(role),
    });

    return res.status(200).json({ success: true, role: serializeRole(role) });
  } catch (error) {
    return next(error);
  }
}

/** DELETE /erp/roles/:roleId — delete a non-system role. */
async function deleteRole(req, res, next) {
  try {
    const role = await Role.findById(req.params.roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found." });
    }

    if (role.system) {
      return res.status(403).json({
        success: false,
        message: `The "${role.name}" role is a system role and cannot be deleted.`,
      });
    }

    const inUse = await Promise.all([
      User.countDocuments({ roleKey: role.key }),
      AdminProfile.countDocuments({ roleKey: role.key }),
    ]);
    const totalInUse = inUse[0] + inUse[1];

    if (totalInUse > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete "${role.name}" — it is assigned to ${totalInUse} account(s). Reassign them first.`,
      });
    }

    const snapshot = serializeRole(role);
    await role.deleteOne();
    invalidateRoleCache();

    await recordAudit({
      ...auditContext(req),
      action: "role.delete",
      module: "governance",
      permissionUsed: "governance.roles.manage",
      targetType: "role",
      targetId: snapshot.id,
      targetLabel: snapshot.name,
      summary: `Deleted role "${snapshot.name}" (${snapshot.key}).`,
      before: snapshot,
    });

    return res.status(200).json({ success: true, message: "Role deleted." });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /erp/users/permissions — set per-user overrides + role assignment.
 * Body: { email, roleKey?, customPermissions?, deniedPermissions? }
 * Applies to whichever collection holds the account (AdminProfile or User).
 */
async function updateUserPermissions(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ success: false, message: "Target email is required." });
    }

    let account = await AdminProfile.findOne({ email });
    let source = "admin_profile";
    if (!account) {
      account = await User.findOne({ email });
      source = "user";
    }
    if (!account) {
      return res.status(404).json({ success: false, message: "No account found for that email." });
    }

    const before = {
      roleKey: account.roleKey || null,
      customPermissions: account.customPermissions || [],
      deniedPermissions: account.deniedPermissions || [],
    };

    if (typeof req.body.roleKey === "string" && req.body.roleKey.trim()) {
      const roleKey = req.body.roleKey.trim().toLowerCase();
      const role = await Role.findOne({ key: roleKey });
      if (!role) {
        return res.status(400).json({ success: false, message: `Unknown role "${roleKey}".` });
      }
      account.roleKey = roleKey;
    }

    if (Array.isArray(req.body.customPermissions)) {
      account.customPermissions = sanitizePermissionKeys(req.body.customPermissions);
    }
    if (Array.isArray(req.body.deniedPermissions)) {
      account.deniedPermissions = sanitizePermissionKeys(req.body.deniedPermissions);
    }

    await account.save();

    const after = {
      roleKey: account.roleKey || null,
      customPermissions: account.customPermissions || [],
      deniedPermissions: account.deniedPermissions || [],
    };

    const { set } = await resolveEffectivePermissions({
      email,
      role: account.role,
      roleKey: account.roleKey,
      customPermissions: account.customPermissions,
      deniedPermissions: account.deniedPermissions,
    });

    await recordAudit({
      ...auditContext(req),
      action: "user.permissions.update",
      module: "hr",
      permissionUsed: "hr.permissions.override",
      targetType: "user",
      targetId: account._id.toString(),
      targetLabel: email,
      summary: `Updated permissions/role for ${email}.`,
      before,
      after,
    });

    return res.status(200).json({
      success: true,
      account: {
        email,
        source,
        roleKey: account.roleKey || null,
        customPermissions: account.customPermissions || [],
        deniedPermissions: account.deniedPermissions || [],
        effectivePermissions: [...set],
      },
    });
  } catch (error) {
    return next(error);
  }
}

/** GET /erp/audit — paginated audit log with optional filters. */
async function listAuditLog(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.module) filter.module = String(req.query.module).trim();
    if (req.query.action) filter.action = String(req.query.action).trim();
    if (req.query.actorEmail) filter.actorEmail = normalizeEmail(req.query.actorEmail);
    if (req.query.status) filter.status = String(req.query.status).trim();

    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      entries: entries.map((e) => ({
        id: e._id.toString(),
        actorEmail: e.actorEmail,
        actorRole: e.actorRole,
        action: e.action,
        module: e.module,
        permissionUsed: e.permissionUsed,
        targetType: e.targetType,
        targetLabel: e.targetLabel,
        summary: e.summary,
        before: e.before,
        after: e.after,
        status: e.status,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

/* ────────────────────────── Error Logs ────────────────────────── */

/** GET /erp/errors — paginated error log with filters. */
async function listErrorLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.resolved === "true") filter.resolved = true;
    if (req.query.resolved === "false") filter.resolved = false;
    if (req.query.statusCode) filter.statusCode = parseInt(req.query.statusCode, 10);
    if (req.query.path) filter.path = { $regex: String(req.query.path).trim(), $options: "i" };

    const [entries, total, unresolved] = await Promise.all([
      ErrorLog.find(filter).sort({ lastSeenAt: -1 }).skip(skip).limit(limit).lean(),
      ErrorLog.countDocuments(filter),
      ErrorLog.countDocuments({ resolved: false }),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      unresolved,
      entries: entries.map((e) => ({
        id: e._id.toString(),
        message: e.message,
        name: e.name,
        statusCode: e.statusCode,
        stack: e.stack,
        method: e.method,
        path: e.path,
        ip: e.ip,
        actorEmail: e.actorEmail,
        actorRole: e.actorRole,
        resolved: e.resolved,
        resolvedBy: e.resolvedBy,
        resolvedAt: e.resolvedAt,
        count: e.count,
        lastSeenAt: e.lastSeenAt,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

/** PATCH /erp/errors/:errorId — mark an error resolved / unresolved. */
async function updateErrorLog(req, res, next) {
  try {
    const entry = await ErrorLog.findById(req.params.errorId);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Error entry not found." });
    }

    const resolved = Boolean(req.body.resolved);
    entry.resolved = resolved;
    entry.resolvedBy = resolved ? req.actor?.email || null : null;
    entry.resolvedAt = resolved ? new Date() : null;
    await entry.save();

    await recordAudit({
      ...auditContext(req),
      action: resolved ? "error.resolve" : "error.reopen",
      module: "governance",
      permissionUsed: "governance.errors.manage",
      targetType: "error_log",
      targetId: entry._id.toString(),
      targetLabel: `${entry.name} @ ${entry.path || "?"}`,
      summary: `${resolved ? "Resolved" : "Reopened"} error "${entry.message}".`,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
}

/** DELETE /erp/errors — purge resolved (or all) error entries. */
async function purgeErrorLogs(req, res, next) {
  try {
    const scope = String(req.query.scope || "resolved");
    const filter = scope === "all" ? {} : { resolved: true };
    const result = await ErrorLog.deleteMany(filter);

    await recordAudit({
      ...auditContext(req),
      action: "error.purge",
      module: "governance",
      permissionUsed: "governance.errors.manage",
      targetType: "error_log",
      summary: `Purged ${result.deletedCount || 0} ${scope} error log entr(ies).`,
    });

    return res.status(200).json({ success: true, deleted: result.deletedCount || 0 });
  } catch (error) {
    return next(error);
  }
}

/* ────────────────────────── Rate Limits ────────────────────────── */

function serializeRule(rule) {
  return {
    id: rule._id ? rule._id.toString() : null,
    key: rule.key,
    label: rule.label,
    description: rule.description || "",
    windowMs: rule.windowMs,
    max: rule.max,
    enabled: rule.enabled !== false,
    scope: rule.scope || "ip",
    system: Boolean(rule.system),
    updatedAt: rule.updatedAt,
  };
}

/** GET /erp/rate-limits — list rules + live throttle activity. */
async function listRateLimits(req, res, next) {
  try {
    const rules = await RateLimitRule.find({}).sort({ key: 1 });
    return res.status(200).json({
      success: true,
      rules: rules.map(serializeRule),
      activity: getActivitySnapshot(),
    });
  } catch (error) {
    return next(error);
  }
}

/** PATCH /erp/rate-limits/:ruleId — edit window, max, or enabled. */
async function updateRateLimit(req, res, next) {
  try {
    const rule = await RateLimitRule.findById(req.params.ruleId);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Rate-limit rule not found." });
    }

    const before = serializeRule(rule);

    if (req.body.windowMs !== undefined) {
      const w = Number(req.body.windowMs);
      if (!Number.isFinite(w) || w < 1000) {
        return res.status(400).json({ success: false, message: "windowMs must be >= 1000ms." });
      }
      rule.windowMs = Math.round(w);
    }
    if (req.body.max !== undefined) {
      const m = Number(req.body.max);
      if (!Number.isFinite(m) || m < 1) {
        return res.status(400).json({ success: false, message: "max must be >= 1." });
      }
      rule.max = Math.round(m);
    }
    if (req.body.enabled !== undefined) {
      rule.enabled = Boolean(req.body.enabled);
    }

    rule.updatedBy = req.actor?.email || null;
    await rule.save();
    invalidateRateLimitCache();

    await recordAudit({
      ...auditContext(req),
      action: "ratelimit.update",
      module: "governance",
      permissionUsed: "governance.ratelimit.manage",
      targetType: "rate_limit_rule",
      targetId: rule._id.toString(),
      targetLabel: rule.label,
      summary: `Updated rate limit "${rule.label}" (${rule.key}).`,
      before,
      after: serializeRule(rule),
    });

    return res.status(200).json({ success: true, rule: serializeRule(rule) });
  } catch (error) {
    return next(error);
  }
}


module.exports = {
  getPermissionCatalog,
  getMyAccess,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  updateUserPermissions,
  listAuditLog,
  listErrorLogs,
  updateErrorLog,
  purgeErrorLogs,
  listRateLimits,
  updateRateLimit,
};
