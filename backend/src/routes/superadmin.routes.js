const express = require("express");
const {
  getSuperAdminDashboard,
  createAccessRequest,
  listAccessRequests,
  reviewAccessRequest,
} = require("../controllers/superadmin.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/dashboard", requireAuth, getSuperAdminDashboard);
router.get("/access-requests", requireAuth, listAccessRequests);
router.post("/access-requests", requireAuth, createAccessRequest);
router.patch("/access-requests/:requestId", requireAuth, reviewAccessRequest);

module.exports = router;