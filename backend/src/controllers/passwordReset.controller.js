const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const PasswordReset = require("../models/PasswordReset");
const { sendPasswordResetEmail } = require("../services/mail.service");
const env = require("../config/env");

const RESET_TOKEN_EXPIRY_MINUTES = 30;
const MAX_RESET_REQUESTS_PER_HOUR = 5;

/**
 * POST /api/auth/forgot-password
 * Sends a password reset link to the user's email (if account exists).
 * Always returns 200 to prevent email enumeration.
 */
async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Always respond with success to prevent email enumeration
    const successResponse = {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    };

    const user = await User.findOne({ email, authProvider: "credentials" });
    if (!user) {
      return res.status(200).json(successResponse);
    }

    // Rate limit: max N reset requests per hour for this email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await PasswordReset.countDocuments({
      email,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentRequests >= MAX_RESET_REQUESTS_PER_HOUR) {
      return res.status(200).json(successResponse);
    }

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await PasswordReset.create({
      email,
      token: hashedToken,
      expiresAt,
    });

    // Build the reset URL pointing to the frontend
    const frontendBase = env.frontendUrl || "https://antariyaofficial.com";
    const resetUrl = `${frontendBase}/login?reset_token=${rawToken}&email=${encodeURIComponent(email)}`;

    // Send email (fire-and-forget so we don't block response)
    try {
      await sendPasswordResetEmail(email, resetUrl, user.displayName);
    } catch (mailError) {
      console.error("[PasswordReset] Failed to send email:", mailError.message);
    }

    return res.status(200).json(successResponse);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/auth/reset-password
 * Verifies the token and sets a new password.
 */
async function resetPassword(req, res, next) {
  try {
    const rawToken = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.password || "");
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!rawToken || !newPassword || !email) {
      return res.status(400).json({
        success: false,
        message: "Token, email, and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must be at most 128 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    const resetDoc = await PasswordReset.findOne({
      token: hashedToken,
      email,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new one.",
      });
    }

    const user = await User.findOne({ email, authProvider: "credentials" });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Account not found",
      });
    }

    // Hash the new password and update
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    resetDoc.used = true;
    await resetDoc.save();

    // Invalidate all other pending reset tokens for this email
    await PasswordReset.updateMany(
      { email, used: false, _id: { $ne: resetDoc._id } },
      { $set: { used: true } }
    );

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  forgotPassword,
  resetPassword,
};
