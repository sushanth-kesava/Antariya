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

async function resolveCurrentAccount(userId, email, role) {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

  if (normalizedEmail) {
    const activeAdmin = await AdminProfile.findOne({ email: normalizedEmail, active: true });

    if (activeAdmin) {
      return {
        account: activeAdmin,
        role: activeAdmin.role || "admin",
      };
    }

    const userAccount = await User.findOne({ email: normalizedEmail });

    if (userAccount) {
      return {
        account: userAccount,
        role: userAccount.role || "customer",
      };
    }
  }

  if (userId) {
    const adminById = await AdminProfile.findById(userId);

    if (adminById && adminById.active) {
      return {
        account: adminById,
        role: adminById.role || "admin",
      };
    }

    const userById = await User.findById(userId);

    if (userById) {
      return {
        account: userById,
        role: userById.role || "customer",
      };
    }
  }

  return {
    account: null,
    role: role === "admin" || role === "superadmin" ? role : "customer",
  };
}

async function loginWithGoogle(req, res, next) {
  try {
    const { googleAccessToken, role = null, tokenType = "Bearer", scope = null, expiresIn = null } = req.body;
    const normalizedRole = role === null || typeof role === "undefined" ? null : String(role).toLowerCase();
    const selectedRole = normalizedRole === "admin" || normalizedRole === "customer" ? normalizedRole : null;

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
    const inferredRole = existingAdmin
      ? existingAdmin.role || "admin"
      : selectedRole === "admin" && emailAllowedAsAdmin
        ? "admin"
        : existingUser
          ? existingUser.role || "customer"
          : "customer";

    const requestedPrivilegedRole = selectedRole === "admin" ? "admin" : null;

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

    if (requestedPrivilegedRole === "admin") {
      const isAllowedPrivilegedEmail = emailAllowedAsAdmin || Boolean(existingAdmin);

      if (!isAllowedPrivilegedEmail) {
        const request = await AccessRequest.create({
          requestType: "admin_approval",
          requestedById: googleProfile.sub,
          requestedByEmail: normalizedEmail,
          requestedByRole: "admin",
          targetEmail: normalizedEmail,
          targetName: googleProfile.name || googleProfile.email.split("@")[0],
          title: "Admin access request",
          message: "An admin access request was submitted from login/sign-up.",
          requestedScopes: ["portal:admin", "portal:customer"],
        });

        return res.status(202).json({
          success: true,
          pendingApproval: true,
          message: "Your admin request has been submitted and is pending approval.",
          request: {
            id: request._id,
            status: request.status,
          },
          user: {
            id: null,
            email: normalizedEmail,
            displayName: googleProfile.name || googleProfile.email.split("@")[0],
            photoURL: googleProfile.picture || null,
            role: "admin",
          },
        });
      }

      await User.deleteOne({ email: userPayload.email });

      const adminDocument = existingAdmin || new AdminProfile({ email: userPayload.email });
      adminDocument.googleId = userPayload.googleId;
      adminDocument.displayName = userPayload.displayName;
      adminDocument.photoURL = userPayload.photoURL;
      adminDocument.provider = "google";
      adminDocument.role = existingAdmin?.role === "superadmin" ? "superadmin" : adminDocument.role || "admin";
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
        adminDocument.role = existingAdmin?.role || (inferredRole === "superadmin" ? "superadmin" : "admin");
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
    const email = req.auth?.email;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid auth payload",
      });
    }

    const { account: user, role: currentRole } = await resolveCurrentAccount(userId, email, role);

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
        role: currentRole,
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
