const express = require("express");
const {
  getSuperAdminDashboard,
  createAccessRequest,
  listAccessRequests,
  reviewAccessRequest,
  updateUserRole,
} = require("../controllers/superadmin.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/dashboard", requireAuth, requireRole("superadmin"), getSuperAdminDashboard);
router.get("/access-requests", requireAuth, requireRole("superadmin"), listAccessRequests);
router.post("/access-requests", requireAuth, requireRole("admin", "superadmin"), createAccessRequest);
router.patch("/access-requests/:requestId", requireAuth, requireRole("superadmin"), reviewAccessRequest);
router.patch("/users/role", requireAuth, requireRole("superadmin"), updateUserRole);

module.exports = router;