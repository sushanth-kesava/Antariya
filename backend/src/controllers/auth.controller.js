const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const AccessRequest = require("../models/AccessRequest");
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
    const { googleAccessToken, role = null, tokenType = "Bearer", scope = null, expiresIn = null } = req.body;
    const normalizedRole = role === null || typeof role === "undefined" ? null : String(role).toLowerCase();

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

    const normalizedEmail = String(googleProfile.email).trim().toLowerCase();
    const existingAdmin = await AdminProfile.findOne({ email: normalizedEmail, active: true });
    const existingUser = await User.findOne({ email: normalizedEmail });
    const emailAllowedAsAdmin = env.adminAllowedEmails.includes(normalizedEmail);
    const emailAllowedAsSuperAdmin = env.superAdminAllowedEmails.includes(normalizedEmail);
    const inferredRole = existingAdmin
      ? existingAdmin.role || "admin"
      : existingUser
        ? existingUser.role || "customer"
        : emailAllowedAsSuperAdmin
          ? "superadmin"
          : emailAllowedAsAdmin
            ? "admin"
            : "customer";

    const requestedPrivilegedRole = normalizedRole === "superadmin" || normalizedRole === "admin" ? normalizedRole : null;

    const userPayload = {
      googleId: googleProfile.sub,
      email: normalizedEmail,
      displayName: googleProfile.name || googleProfile.email.split("@")[0],
      photoURL: googleProfile.picture || null,
      role: inferredRole,
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

    if (requestedPrivilegedRole === "admin" || requestedPrivilegedRole === "superadmin") {
      const shouldBeSuperAdmin = requestedPrivilegedRole === "superadmin";
      const isAllowedPrivilegedEmail = shouldBeSuperAdmin ? emailAllowedAsSuperAdmin : emailAllowedAsAdmin;

      if (!isAllowedPrivilegedEmail) {
        const request = await AccessRequest.create({
          requestType: shouldBeSuperAdmin ? "superadmin_access" : "admin_approval",
          requestedById: googleProfile.sub,
          requestedByEmail: normalizedEmail,
          requestedByRole: "admin",
          targetEmail: normalizedEmail,
          targetName: googleProfile.name || googleProfile.email.split("@")[0],
          title: shouldBeSuperAdmin ? "Superadmin access request" : "Admin access request",
          message: shouldBeSuperAdmin
            ? "A superadmin login request was submitted from the sign-up flow."
            : "An admin access request was submitted from the sign-up flow.",
          requestedScopes: shouldBeSuperAdmin ? ["portal:superadmin", "portal:admin", "portal:customer"] : ["portal:admin", "portal:customer"],
        });

        return res.status(202).json({
          success: true,
          pendingApproval: true,
          message: shouldBeSuperAdmin
            ? "This account is not approved for superadmin access."
            : "Your admin request has been submitted and is pending approval.",
          request: {
            id: request._id,
            status: request.status,
          },
          user: {
            id: null,
            email: normalizedEmail,
            displayName: googleProfile.name || googleProfile.email.split("@")[0],
            photoURL: googleProfile.picture || null,
            role: shouldBeSuperAdmin ? "superadmin" : "admin",
          },
        });
      }

      await User.deleteOne({ email: userPayload.email });

      const adminDocument = existingAdmin || new AdminProfile({ email: userPayload.email });
      adminDocument.googleId = userPayload.googleId;
      adminDocument.displayName = userPayload.displayName;
      adminDocument.photoURL = userPayload.photoURL;
      adminDocument.provider = "google";
      adminDocument.role = shouldBeSuperAdmin ? "superadmin" : adminDocument.role || "admin";
      adminDocument.active = true;
      adminDocument.lastAdminLoginAt = new Date();
      adminDocument.loginCount = Number(adminDocument.loginCount || 0) + 1;
      authDocument = await adminDocument.save();
    } else {
      if (existingAdmin || inferredRole === "admin" || inferredRole === "superadmin") {
        const adminDocument = existingAdmin || new AdminProfile({ email: userPayload.email });
        adminDocument.googleId = userPayload.googleId;
        adminDocument.displayName = userPayload.displayName;
        adminDocument.photoURL = userPayload.photoURL;
        adminDocument.provider = "google";
        adminDocument.role = existingAdmin?.role || inferredRole;
        adminDocument.active = true;
        adminDocument.lastAdminLoginAt = new Date();
        adminDocument.loginCount = Number(adminDocument.loginCount || 0) + 1;
        authDocument = await adminDocument.save();
      } else if (existingUser) {
        Object.assign(existingUser, userPayload);
        authDocument = await existingUser.save();
      } else {
        try {
          authDocument = await User.create(userPayload);
        } catch (createError) {
          if (createError?.code === 11000) {
            const fallbackUser = await User.findOne({ email: userPayload.email });

            if (fallbackUser) {
              Object.assign(fallbackUser, userPayload);
              authDocument = await fallbackUser.save();
            } else {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      }
    }

    const jwtPayload = {
      sub: authDocument._id.toString(),
      email: authDocument.email,
      role: authDocument.role || inferredRole,
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
        role: authDocument.role || inferredRole,
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

    const user = role === "admin" || role === "superadmin" ? await AdminProfile.findById(userId) : await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${role === "customer" ? "User" : "Admin"} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role === "admin" || role === "superadmin" ? (user.role || "admin") : (user.role || "customer"),
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
