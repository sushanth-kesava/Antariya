const express = require("express");
const {
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
} = require("../controllers/erp.controller");
const {
  refundOrder,
  updateProduct,
  setProductPublished,
  listProductsForErp,
  listWarehouses,
  createWarehouse,
  transferStock,
} = require("../controllers/erpOps.controller");
const {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCampaigns,
  getAudienceCounts,
  sendCampaign,
  listSubscribers,
  removeSubscriber,
  exportSubscribers,
  listEmailLogs,
} = require("../controllers/erpComms.controller");
const {
  requireAuth,
  loadActor,
  requirePermission,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Every ERP route needs an authenticated, resolved actor.
router.use(requireAuth, loadActor);

// Permission catalog + self access — any signed-in staff member may read.
router.get("/permissions", getPermissionCatalog);
router.get("/me", getMyAccess);

// Role management (Governance module).
router.get("/roles", requirePermission("governance.roles.view"), listRoles);
router.post("/roles", requirePermission("governance.roles.manage"), createRole);
router.patch("/roles/:roleId", requirePermission("governance.roles.manage"), updateRole);
router.delete("/roles/:roleId", requirePermission("governance.roles.manage"), deleteRole);

// Per-user role + permission overrides (HR module).
router.patch("/users/permissions", requirePermission("hr.permissions.override"), updateUserPermissions);

// Audit trail (Governance module).
router.get("/audit", requirePermission("governance.audit.view"), listAuditLog);

// Error logs (Governance module).
router.get("/errors", requirePermission("governance.errors.view"), listErrorLogs);
router.patch("/errors/:errorId", requirePermission("governance.errors.manage"), updateErrorLog);
router.delete("/errors", requirePermission("governance.errors.manage"), purgeErrorLogs);

// Rate-limit rules (Governance module).
router.get("/rate-limits", requirePermission("governance.ratelimit.view"), listRateLimits);
router.patch("/rate-limits/:ruleId", requirePermission("governance.ratelimit.manage"), updateRateLimit);

// Orders — refunds (Finance / Orders module).
router.post("/orders/:orderId/refund", requirePermission("orders.refund"), refundOrder);

// Catalog — product edit / publish (Catalog module).
router.get("/products", requirePermission("catalog.view"), listProductsForErp);
router.patch("/products/:productId", requirePermission("catalog.edit"), updateProduct);
router.patch("/products/:productId/publish", requirePermission("catalog.publish"), setProductPublished);

// Inventory — warehouses & transfers (Inventory module).
router.get("/warehouses", requirePermission("inventory.view"), listWarehouses);
router.post("/warehouses", requirePermission("inventory.warehouse.manage"), createWarehouse);
router.post("/inventory/transfer", requirePermission("inventory.transfer"), transferStock);

// ── Communications / Email ──────────────────────────────────────────────
// Templates
router.get("/comms/templates", requirePermission("comms.templates.view"), listTemplates);
router.post("/comms/templates", requirePermission("comms.templates.manage"), createTemplate);
router.patch("/comms/templates/:templateId", requirePermission("comms.templates.manage"), updateTemplate);
router.delete("/comms/templates/:templateId", requirePermission("comms.templates.manage"), deleteTemplate);
// Campaigns
router.get("/comms/audiences", requirePermission("comms.campaigns.view"), getAudienceCounts);
router.get("/comms/campaigns", requirePermission("comms.campaigns.view"), listCampaigns);
router.post("/comms/campaigns", requirePermission("comms.campaigns.send"), sendCampaign);
// Subscribers
router.get("/comms/subscribers", requirePermission("comms.subscribers.view"), listSubscribers);
router.get("/comms/subscribers/export", requirePermission("comms.subscribers.view"), exportSubscribers);
router.delete("/comms/subscribers/:subscriberId", requirePermission("comms.subscribers.manage"), removeSubscriber);
// Email logs
router.get("/comms/logs", requirePermission("comms.logs.view"), listEmailLogs);

module.exports = router;
