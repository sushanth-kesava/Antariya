const express = require("express");
const { loginWithGoogle, getCurrentUser } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/google", loginWithGoogle);
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
