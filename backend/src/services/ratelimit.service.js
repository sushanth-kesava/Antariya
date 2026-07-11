const RateLimitRule = require("../models/RateLimitRule");

/**
 * Default, system rate-limit rules. Seeded on boot; editable from the
 * Governance module. The middleware reads the *effective* config (DB override
 * or this default) through a short-lived cache so edits take effect quickly
 * without a per-request DB hit.
 */
const DEFAULT_RULES = [
  {
    key: "auth",
    label: "Authentication requests",
    description: "All /api/auth traffic per IP (login, Google OAuth, signup).",
    windowMs: 15 * 60 * 1000,
    max: 80,
    scope: "ip",
    system: true,
  },
  {
    key: "credentials",
    label: "Credential attempts",
    description: "Email+password attempts per account+IP (brute-force guard).",
    windowMs: 15 * 60 * 1000,
    max: 12,
    scope: "ip+email",
    system: true,
  },
  {
    key: "erp",
    label: "ERP portal API",
    description: "Privileged /api/erp management endpoints per IP.",
    windowMs: 5 * 60 * 1000,
    max: 300,
    scope: "ip",
    system: true,
  },
];

let ruleCache = null;
let ruleCacheLoadedAt = 0;
const RULE_CACHE_TTL_MS = 30 * 1000;

// In-memory throttle activity counters (per rule key) for observability.
const activity = new Map(); // key -> { blocked, allowed, lastBlockedAt }

function bumpActivity(key, blocked) {
  const a = activity.get(key) || { blocked: 0, allowed: 0, lastBlockedAt: null };
  if (blocked) {
    a.blocked += 1;
    a.lastBlockedAt = new Date();
  } else {
    a.allowed += 1;
  }
  activity.set(key, a);
}

function getActivitySnapshot() {
  const out = {};
  for (const [key, a] of activity.entries()) {
    out[key] = { ...a };
  }
  return out;
}

async function ensureDefaultRateLimits() {
  for (const def of DEFAULT_RULES) {
    const existing = await RateLimitRule.findOne({ key: def.key });
    if (!existing) {
      await RateLimitRule.create({ ...def, updatedBy: "system" });
    } else {
      // Keep metadata authoritative; leave tunable values (window/max/enabled)
      // under UI control once seeded.
      existing.label = def.label;
      existing.description = def.description;
      existing.scope = def.scope;
      existing.system = true;
      await existing.save();
    }
  }
  invalidateRuleCache();
}

function invalidateRuleCache() {
  ruleCache = null;
  ruleCacheLoadedAt = 0;
}

async function loadRuleCache(force = false) {
  const fresh = ruleCache && Date.now() - ruleCacheLoadedAt < RULE_CACHE_TTL_MS;
  if (fresh && !force) {
    return ruleCache;
  }
  const rules = await RateLimitRule.find({}).lean();
  ruleCache = new Map();
  for (const r of rules) {
    ruleCache.set(r.key, r);
  }
  ruleCacheLoadedAt = Date.now();
  return ruleCache;
}

function defaultFor(key) {
  return DEFAULT_RULES.find((r) => r.key === key) || null;
}

/**
 * Build an Express middleware for a named rule. Reads effective config from
 * the cache on each request (cheap), supports enable/disable, and records
 * throttle activity. keyGenerator decides the bucket key.
 */
function createManagedRateLimiter(ruleKey, keyGenerator) {
  const store = new Map();
  const genKey = typeof keyGenerator === "function" ? keyGenerator : (req) => req.ip || "unknown";

  return async function managedRateLimiter(req, res, next) {
    let rule;
    try {
      const cache = await loadRuleCache();
      rule = cache.get(ruleKey) || defaultFor(ruleKey);
    } catch {
      rule = defaultFor(ruleKey);
    }

    if (!rule || rule.enabled === false) {
      return next();
    }

    const now = Date.now();
    const bucketKey = `${ruleKey}:${String(genKey(req) || "unknown")}`;
    const current = store.get(bucketKey);

    if (!current || current.expiresAt <= now) {
      store.set(bucketKey, { count: 1, expiresAt: now + rule.windowMs });
      bumpActivity(ruleKey, false);
      return next();
    }

    current.count += 1;
    store.set(bucketKey, current);

    if (current.count > rule.max) {
      bumpActivity(ruleKey, true);
      const retryAfter = Math.max(1, Math.ceil((current.expiresAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
    }

    bumpActivity(ruleKey, false);
    return next();
  };
}

module.exports = {
  DEFAULT_RULES,
  ensureDefaultRateLimits,
  invalidateRuleCache,
  loadRuleCache,
  createManagedRateLimiter,
  getActivitySnapshot,
};
