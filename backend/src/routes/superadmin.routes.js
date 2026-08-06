const express = require("express");
const {
  getSuperAdminDashboard,
  submitPublicAdminApplication,
  createAccessRequest,
  listAccessRequests,
  reviewAccessRequest,
  updateUserRole,
  createTeamMember,
} = require("../controllers/superadmin.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/admin-applications", submitPublicAdminApplication);
router.get("/dashboard", requireAuth, requireRole("superadmin"), getSuperAdminDashboard);
router.get("/access-requests", requireAuth, requireRole("superadmin"), listAccessRequests);
router.post("/access-requests", requireAuth, requireRole("admin", "superadmin"), createAccessRequest);
router.patch("/access-requests/:requestId", requireAuth, requireRole("superadmin"), reviewAccessRequest);
router.patch("/users/role", requireAuth, requireRole("superadmin"), updateUserRole);
router.post("/team-members", requireAuth, requireRole("superadmin"), createTeamMember);

module.exports = router;
