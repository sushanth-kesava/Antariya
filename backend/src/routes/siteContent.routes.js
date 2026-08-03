const express = require("express");
const { getAboutPageContent, updateAboutPageContent } = require("../controllers/siteContent.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/about", getAboutPageContent);
router.put("/about", requireAuth, requireRole("admin", "superadmin"), updateAboutPageContent);

module.exports = router;
