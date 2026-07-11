const express = require("express");
const {
	loginWithGoogle,
	signupWithCredentials,
	loginWithCredentials,
	getCurrentUser,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { createManagedRateLimiter } = require("../services/ratelimit.service");

const router = express.Router();

// DB-configurable limiters (editable from Governance → Rate Limits). They fall
// back to seeded defaults if the DB has no override and can be toggled off.
const authRouteLimiter = createManagedRateLimiter("auth", (req) => `auth:${req.ip || "unknown"}`);
const credentialsAttemptLimiter = createManagedRateLimiter("credentials", (req) => {
	const ip = req.ip || "unknown";
	const route = req.path || "credentials";
	const email = String(req.body?.email || "").trim().toLowerCase() || "anonymous";
	return `cred:${route}:${ip}:${email}`;
});

router.use(authRouteLimiter);

router.post("/google", loginWithGoogle);
router.post("/signup", credentialsAttemptLimiter, signupWithCredentials);
router.post("/login", credentialsAttemptLimiter, loginWithCredentials);
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
