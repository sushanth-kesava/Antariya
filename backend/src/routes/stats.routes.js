const express = require("express");
const { getPublicHomeStats, getUnifiedOperationsStats } = require("../controllers/stats.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/home", getPublicHomeStats);
router.get("/unified-operations", requireAuth, requireRole("admin", "superadmin"), getUnifiedOperationsStats);

module.exports = router;
