const express = require("express");
const {
	loginWithGoogle,
	signupWithCredentials,
	loginWithCredentials,
	getCurrentUser,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { clearAuthCookie } = require("../middleware/cookie-auth.middleware");
const { forgotPassword, resetPassword } = require("../controllers/passwordReset.controller");
const { validate } = require("../middleware/validate.middleware");
const { googleLoginSchema, credentialsSignupSchema, credentialsLoginSchema } = require("../schemas/auth.schemas");
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

router.post("/google", validate(googleLoginSchema), loginWithGoogle);
router.post("/signup", credentialsAttemptLimiter, validate(credentialsSignupSchema), signupWithCredentials);
router.post("/login", credentialsAttemptLimiter, validate(credentialsLoginSchema), loginWithCredentials);
router.get("/me", requireAuth, getCurrentUser);
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: "Logged out" });
});

router.post("/forgot-password", credentialsAttemptLimiter, forgotPassword);
router.post("/reset-password", credentialsAttemptLimiter, resetPassword);

module.exports = router;
