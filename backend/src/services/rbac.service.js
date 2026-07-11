const Role = require("../models/Role");
const AuditLog = require("../models/AuditLog");
const {
  DEFAULT_ROLES,
  WILDCARD,
  sanitizePermissionKeys,
} = require("../config/permissions");
const env = require("../config/env");

/**
 * In-memory cache of role.key -> Set(permissions). Rebuilt lazily and
 * invalidated whenever a role is written. Keeps permission checks fast without
 * a DB round-trip on every request.
 */
let roleCache = null;
let roleCacheLoadedAt = 0;
const ROLE_CACHE_TTL_MS = 60 * 1000;

/**
 * Seed the default/system roles into the DB if they don't already exist.
 * System roles are upserted so their metadata (name/description) stays fresh,
 * but a role's *permissions* are only set on first insert — after that the UI
 * owns them (except locked roles, whose permissions are always re-asserted).
 */
async function ensureDefaultRoles() {
  for (const def of DEFAULT_ROLES) {
    const existing = await Role.findOne({ key: def.key });

    if (!existing) {
      await Role.create({
        key: def.key,
        name: def.name,
        description: def.description,
        permissions: def.permissions,
        system: true,
        locked: Boolean(def.locked),
        createdBy: "system",
      });
      continue;
    }

    // Keep metadata + system/locked flags authoritative from config.
    existing.name = def.name;
    existing.description = def.description;
    existing.system = true;
    existing.locked = Boolean(def.locked);

    // Locked roles always re-assert their config permissions (e.g. superadmin
    // must always keep the wildcard, customer must always stay empty).
    if (def.locked) {
      existing.permissions = def.permissions;
    }

    await existing.save();
  }

  invalidateRoleCache();
}

function invalidateRoleCache() {
  roleCache = null;
  roleCacheLoadedAt = 0;
}

async function loadRoleCache(force = false) {
  const fresh = roleCache && Date.now() - roleCacheLoadedAt < ROLE_CACHE_TTL_MS;

  if (fresh && !force) {
    return roleCache;
  }

  const roles = await Role.find({}).lean();
  roleCache = new Map();

  for (const role of roles) {
    roleCache.set(role.key, new Set(role.permissions || []));
  }

  roleCacheLoadedAt = Date.now();
  return roleCache;
}

/**
 * Resolve the effective permission set for an identity.
 *
 * @param {Object} identity
 * @param {string} [identity.roleKey]  Role key to resolve against the catalog.
 * @param {string} [identity.role]     Legacy role ("customer"/"admin"/"superadmin").
 * @param {string} [identity.email]    Used to honor the superadmin allowlist.
 * @param {string[]} [identity.customPermissions]  Per-user grants.
 * @param {string[]} [identity.deniedPermissions]  Per-user denials.
 * @returns {Promise<{ set: Set<string>, isSuperadmin: boolean }>}
 */
async function resolveEffectivePermissions(identity = {}) {
  const email = String(identity.email || "").trim().toLowerCase();
  const legacyRole = String(identity.role || "").trim().toLowerCase();
  const roleKey = String(identity.roleKey || legacyRole || "customer").trim().toLowerCase();

  // Superadmin allowlist is the ultimate authority — always full wildcard.
  const allowlistedSuper = email && env.superAdminAllowedEmails.includes(email);
  if (allowlistedSuper || roleKey === "superadmin" || legacyRole === "superadmin") {
    return { set: new Set([WILDCARD]), isSuperadmin: true };
  }

  const cache = await loadRoleCache();
  const rolePerms = cache.get(roleKey) || new Set();

  const effective = new Set(rolePerms);

  for (const p of sanitizePermissionKeys(identity.customPermissions)) {
    effective.add(p);
  }
  for (const p of sanitizePermissionKeys(identity.deniedPermissions)) {
    effective.delete(p);
  }

  return { set: effective, isSuperadmin: effective.has(WILDCARD) };
}

/**
 * Does an effective permission set satisfy a required permission?
 * Wildcard "*" satisfies everything.
 */
function setHasPermission(permissionSet, required) {
  if (!required) {
    return true;
  }
  if (permissionSet.has(WILDCARD)) {
    return true;
  }
  return permissionSet.has(required);
}

/**
 * Write an audit log entry. Never throws — auditing must not break the action.
 */
async function recordAudit(entry = {}) {
  try {
    await AuditLog.create({
      actorId: entry.actorId || null,
      actorEmail: entry.actorEmail || null,
      actorRole: entry.actorRole || null,
      action: entry.action || "unknown",
      module: entry.module || null,
      permissionUsed: entry.permissionUsed || null,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
      targetLabel: entry.targetLabel || null,
      summary: entry.summary || "",
      before: entry.before ?? null,
      after: entry.after ?? null,
      metadata: entry.metadata ?? null,
      ip: entry.ip || null,
      userAgent: entry.userAgent || null,
      status: entry.status === "failure" ? "failure" : "success",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to write audit log:", error.message);
  }
}

module.exports = {
  ensureDefaultRoles,
  invalidateRoleCache,
  loadRoleCache,
  resolveEffectivePermissions,
  setHasPermission,
  recordAudit,
};
