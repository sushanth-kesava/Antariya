/**
 * Central permission catalog for the Antariya ERP portal.
 *
 * Permissions are the atomic unit of authority. Roles are bundles of
 * permissions. A user's *effective* permissions are:
 *
 *     (role.permissions) ∪ (user.customPermissions) − (user.deniedPermissions)
 *
 * The special permission "*" grants everything (reserved for superadmin).
 *
 * Permission keys follow the convention "<module>.<action>". Keep this file
 * as the single source of truth — the UI permission editor reads from it and
 * the requirePermission() middleware validates against it.
 */

/**
 * @typedef {Object} PermissionDef
 * @property {string} key       Unique permission key ("module.action")
 * @property {string} module    Module grouping (matches MODULES below)
 * @property {string} label     Human-friendly label for the UI
 * @property {string} description Longer explanation shown in the editor
 */

const MODULES = {
  HR: "hr",
  ORDERS: "orders",
  INVENTORY: "inventory",
  CATALOG: "catalog",
  FINANCE: "finance",
  COMMS: "comms",
  GOVERNANCE: "governance",
};

const MODULE_META = {
  [MODULES.HR]: { label: "HR / People & Permissions", icon: "Users" },
  [MODULES.ORDERS]: { label: "Orders & Fulfillment", icon: "ShoppingCart" },
  [MODULES.INVENTORY]: { label: "Inventory & Warehouses", icon: "Package" },
  [MODULES.CATALOG]: { label: "Catalog / Products", icon: "Tags" },
  [MODULES.FINANCE]: { label: "Finance & Reports", icon: "Wallet" },
  [MODULES.COMMS]: { label: "Communications / Email", icon: "Mail" },
  [MODULES.GOVERNANCE]: { label: "Governance / Audit / Settings", icon: "ShieldCheck" },
};

/** @type {PermissionDef[]} */
const PERMISSIONS = [
  // ── HR / People & Permissions ──────────────────────────────────────────
  { key: "hr.people.view", module: MODULES.HR, label: "View staff directory", description: "See the list of admins, superadmins, and their profiles." },
  { key: "hr.people.invite", module: MODULES.HR, label: "Invite / onboard staff", description: "Create new admin profiles and send onboarding invites." },
  { key: "hr.people.deactivate", module: MODULES.HR, label: "Activate / deactivate staff", description: "Suspend or reactivate an admin account." },
  { key: "hr.roles.assign", module: MODULES.HR, label: "Assign roles to users", description: "Change which role a user holds." },
  { key: "hr.permissions.override", module: MODULES.HR, label: "Grant / deny individual permissions", description: "Add per-user permission overrides beyond their role." },
  { key: "hr.access_requests.view", module: MODULES.HR, label: "View access requests", description: "See pending admin-access applications and requests." },
  { key: "hr.access_requests.review", module: MODULES.HR, label: "Approve / reject access requests", description: "Decide on admin-access applications." },

  // ── Orders & Fulfillment ───────────────────────────────────────────────
  { key: "orders.view", module: MODULES.ORDERS, label: "View orders", description: "Browse and inspect customer orders." },
  { key: "orders.edit", module: MODULES.ORDERS, label: "Edit order details", description: "Modify order line items, addresses, and notes." },
  { key: "orders.status.override", module: MODULES.ORDERS, label: "Override order status", description: "Force an order to a new status (e.g. processing → shipped)." },
  { key: "orders.cancel", module: MODULES.ORDERS, label: "Cancel orders", description: "Cancel an order and release its reservations." },
  { key: "orders.refund", module: MODULES.ORDERS, label: "Issue refunds", description: "Refund a paid order fully or partially." },

  // ── Inventory & Warehouses ─────────────────────────────────────────────
  { key: "inventory.view", module: MODULES.INVENTORY, label: "View inventory", description: "See stock levels, ledgers, and warehouses." },
  { key: "inventory.adjust", module: MODULES.INVENTORY, label: "Adjust stock", description: "Make manual stock adjustments (corrections, damage, etc.)." },
  { key: "inventory.transfer", module: MODULES.INVENTORY, label: "Transfer stock", description: "Move stock between warehouses." },
  { key: "inventory.warehouse.manage", module: MODULES.INVENTORY, label: "Manage warehouses", description: "Create, edit, or deactivate warehouses." },

  // ── Catalog / Products ─────────────────────────────────────────────────
  { key: "catalog.view", module: MODULES.CATALOG, label: "View catalog", description: "Browse products and their details." },
  { key: "catalog.create", module: MODULES.CATALOG, label: "Create products", description: "Add new products to the catalog." },
  { key: "catalog.edit", module: MODULES.CATALOG, label: "Edit products", description: "Modify existing product details and media." },
  { key: "catalog.publish", module: MODULES.CATALOG, label: "Publish / unpublish products", description: "Control product visibility on the storefront." },
  { key: "catalog.delete", module: MODULES.CATALOG, label: "Delete products", description: "Permanently remove products." },
  { key: "catalog.reviews.moderate", module: MODULES.CATALOG, label: "Moderate reviews", description: "Approve, reject, or remove customer reviews." },

  // ── Finance & Reports ──────────────────────────────────────────────────
  { key: "finance.view", module: MODULES.FINANCE, label: "View financials", description: "See revenue, payouts, and financial summaries." },
  { key: "finance.reports.export", module: MODULES.FINANCE, label: "Export reports", description: "Download financial and operational reports." },
  { key: "finance.refunds.approve", module: MODULES.FINANCE, label: "Approve refunds", description: "Sign off on refund requests raised by staff." },

  // ── Communications / Email ─────────────────────────────────────────────
  { key: "comms.templates.view", module: MODULES.COMMS, label: "View email templates", description: "See the catalog of email templates and their content." },
  { key: "comms.templates.manage", module: MODULES.COMMS, label: "Create / edit email templates", description: "Author and edit reusable email templates." },
  { key: "comms.campaigns.view", module: MODULES.COMMS, label: "View campaigns", description: "See email campaigns / broadcasts and their status." },
  { key: "comms.campaigns.send", module: MODULES.COMMS, label: "Send campaigns / broadcasts", description: "Compose and send broadcast emails to customers or segments." },
  { key: "comms.subscribers.view", module: MODULES.COMMS, label: "View subscribers", description: "See newsletter subscribers and waitlist contacts." },
  { key: "comms.subscribers.manage", module: MODULES.COMMS, label: "Manage subscribers", description: "Add, remove, or export newsletter subscribers." },
  { key: "comms.logs.view", module: MODULES.COMMS, label: "View email logs", description: "See the log of every email sent, failed, or skipped." },

  // ── Governance / Audit / Settings ──────────────────────────────────────
  { key: "governance.roles.view", module: MODULES.GOVERNANCE, label: "View roles", description: "See all roles and their permission sets." },
  { key: "governance.roles.manage", module: MODULES.GOVERNANCE, label: "Create / edit / delete roles", description: "Full control over the role catalog and its permissions." },
  { key: "governance.audit.view", module: MODULES.GOVERNANCE, label: "View audit log", description: "Read the audit trail of privileged actions." },
  { key: "governance.errors.view", module: MODULES.GOVERNANCE, label: "View error logs", description: "Read the server error log and stack traces." },
  { key: "governance.errors.manage", module: MODULES.GOVERNANCE, label: "Resolve / clear error logs", description: "Mark errors resolved or purge old error entries." },
  { key: "governance.ratelimit.view", module: MODULES.GOVERNANCE, label: "View rate limits", description: "See rate-limit rules and current throttling activity." },
  { key: "governance.ratelimit.manage", module: MODULES.GOVERNANCE, label: "Manage rate limits", description: "Edit rate-limit windows, thresholds, and toggles." },
  { key: "governance.settings.manage", module: MODULES.GOVERNANCE, label: "Manage system settings", description: "Change global ERP configuration and settings." },
];

const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const PERMISSION_KEY_SET = new Set(ALL_PERMISSION_KEYS);

/** The wildcard permission grants every capability. */
const WILDCARD = "*";

/**
 * Default, system-managed roles. These are seeded into the DB but their
 * permission sets can be edited from the UI (except superadmin, which always
 * holds the wildcard and cannot be locked out).
 */
const DEFAULT_ROLES = [
  {
    key: "superadmin",
    name: "Super Admin",
    description: "Full, unrestricted control over the entire ERP. Cannot be limited.",
    permissions: [WILDCARD],
    system: true,
    locked: true, // permission set cannot be edited away from wildcard
  },
  {
    key: "admin",
    name: "Administrator",
    description: "Broad operational access across orders, inventory, and catalog.",
    permissions: [
      "hr.people.view",
      "hr.access_requests.view",
      "orders.view", "orders.edit", "orders.status.override", "orders.cancel",
      "inventory.view", "inventory.adjust", "inventory.transfer",
      "catalog.view", "catalog.create", "catalog.edit", "catalog.publish", "catalog.reviews.moderate",
      "finance.view",
      "comms.templates.view", "comms.campaigns.view", "comms.campaigns.send",
      "comms.subscribers.view", "comms.logs.view",
      "governance.audit.view", "governance.errors.view", "governance.ratelimit.view",
    ],
    system: true,
    locked: false,
  },
  {
    key: "hr_manager",
    name: "HR Manager",
    description: "Manages people, roles, permission overrides, and access requests.",
    permissions: [
      "hr.people.view", "hr.people.invite", "hr.people.deactivate",
      "hr.roles.assign", "hr.permissions.override",
      "hr.access_requests.view", "hr.access_requests.review",
      "governance.roles.view", "governance.audit.view",
    ],
    system: true,
    locked: false,
  },
  {
    key: "finance_manager",
    name: "Finance Manager",
    description: "Owns financials, reporting, and refund approvals.",
    permissions: [
      "orders.view", "orders.refund",
      "finance.view", "finance.reports.export", "finance.refunds.approve",
      "governance.audit.view",
    ],
    system: true,
    locked: false,
  },
  {
    key: "inventory_manager",
    name: "Inventory Manager",
    description: "Runs warehouses, stock adjustments, and transfers.",
    permissions: [
      "inventory.view", "inventory.adjust", "inventory.transfer", "inventory.warehouse.manage",
      "catalog.view",
      "orders.view",
    ],
    system: true,
    locked: false,
  },
  {
    key: "catalog_manager",
    name: "Catalog Manager",
    description: "Manages products, media, publishing, and review moderation.",
    permissions: [
      "catalog.view", "catalog.create", "catalog.edit", "catalog.publish", "catalog.delete",
      "catalog.reviews.moderate",
      "inventory.view",
    ],
    system: true,
    locked: false,
  },
  {
    key: "marketing_manager",
    name: "Marketing Manager",
    description: "Owns email marketing — templates, campaigns, subscribers, and logs.",
    permissions: [
      "comms.templates.view", "comms.templates.manage",
      "comms.campaigns.view", "comms.campaigns.send",
      "comms.subscribers.view", "comms.subscribers.manage",
      "comms.logs.view",
      "catalog.view",
    ],
    system: true,
    locked: false,
  },
  {
    key: "customer",
    name: "Customer",
    description: "Standard storefront customer. No portal access.",
    permissions: [],
    system: true,
    locked: true,
  },
];

/**
 * Validate a list of permission keys against the catalog.
 * Returns only the keys that are recognized (wildcard is always allowed).
 */
function sanitizePermissionKeys(keys) {
  if (!Array.isArray(keys)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const raw of keys) {
    const key = String(raw || "").trim();

    if (!key || seen.has(key)) {
      continue;
    }

    if (key === WILDCARD || PERMISSION_KEY_SET.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  return result;
}

module.exports = {
  MODULES,
  MODULE_META,
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  PERMISSION_KEY_SET,
  WILDCARD,
  DEFAULT_ROLES,
  sanitizePermissionKeys,
};
