const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const env = require("../config/env");

function calculateExpiryDate(expiresInSeconds) {
  if (!expiresInSeconds || Number.isNaN(Number(expiresInSeconds))) {
    return null;
  }

  const now = Date.now();
  return new Date(now + Number(expiresInSeconds) * 1000);
}

async function loginWithGoogle(req, res, next) {
  try {
    const { googleAccessToken, role = "customer", tokenType = "Bearer", scope = null, expiresIn = null } = req.body;
    const normalizedRole = role === "admin" ? "admin" : "customer";

    if (!googleAccessToken) {
      return res.status(400).json({
        success: false,
        message: "googleAccessToken is required",
      });
    }

    const { data: googleProfile } = await axios.get(env.googleUserInfoUrl, {
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
      },
      timeout: 8000,
    });

    if (!googleProfile || !googleProfile.email || !googleProfile.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google OAuth token",
      });
    }

    const userPayload = {
      googleId: googleProfile.sub,
      email: googleProfile.email,
      displayName: googleProfile.name || googleProfile.email.split("@")[0],
      photoURL: googleProfile.picture || null,
      role: normalizedRole,
      authProvider: "google",
      oauth: {
        provider: "google",
        providerUserId: googleProfile.sub,
        accessToken: googleAccessToken,
        tokenType,
        scope,
        expiresAt: calculateExpiryDate(expiresIn),
        lastLoginAt: new Date(),
      },
    };

    let authDocument;

    if (normalizedRole === "admin") {
      await User.deleteOne({ email: userPayload.email });

      authDocument = await AdminProfile.findOneAndUpdate(
        { email: userPayload.email },
        {
          $set: {
            googleId: userPayload.googleId,
            email: userPayload.email,
            displayName: userPayload.displayName,
            photoURL: userPayload.photoURL,
            provider: "google",
            active: true,
            lastAdminLoginAt: new Date(),
          },
          $inc: {
            loginCount: 1,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      await AdminProfile.deleteOne({ email: userPayload.email });

      authDocument = await User.findOneAndUpdate(
        { email: userPayload.email },
        { $set: userPayload },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    const jwtPayload = {
      sub: authDocument._id.toString(),
      email: authDocument.email,
      role: normalizedRole,
    };

    const jwtOptions = env.jwtExpiresIn ? { expiresIn: env.jwtExpiresIn } : undefined;
    const appToken = jwt.sign(jwtPayload, env.jwtSecret, jwtOptions);

    return res.status(200).json({
      success: true,
      message: "Authenticated successfully",
      token: appToken,
      user: {
        id: authDocument._id,
        email: authDocument.email,
        displayName: authDocument.displayName,
        photoURL: authDocument.photoURL,
        role: normalizedRole,
      },
    });
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(401).json({
        success: false,
        message: "Google token verification failed",
      });
    }

    return next(error);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const role = req.auth?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid auth payload",
      });
    }

    const user = role === "admin" ? await AdminProfile.findById(userId) : await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${role === "admin" ? "Admin" : "User"} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role === "admin" ? "admin" : (user.role || "customer"),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  loginWithGoogle,
  getCurrentUser,
};
