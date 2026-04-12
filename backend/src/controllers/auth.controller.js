const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const AccessRequest = require("../models/AccessRequest");
const env = require("../config/env");
const { sendWelcomeEmail } = require("../services/mail.service");

function normalizeDisplayName(email, displayName) {
  const normalizedName = String(displayName || "").trim();
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  return String(email || "user").split("@")[0];
}

function issueAuthResponse(authDocument, inferredRole) {
  const jwtPayload = {
    sub: authDocument._id.toString(),
    email: authDocument.email,
    role: authDocument.role || inferredRole,
  };

  const jwtOptions = env.jwtExpiresIn ? { expiresIn: env.jwtExpiresIn } : undefined;
  const appToken = jwt.sign(jwtPayload, env.jwtSecret, jwtOptions);

  return {
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
  };
}

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
    let shouldSendWelcomeEmail = false;

    if (requestedPrivilegedRole === "admin") {
      const isAllowedPrivilegedEmail = emailAllowedAsAdmin || Boolean(existingAdmin);

      if (!isAllowedPrivilegedEmail) {
        let request;

        try {
          request = await AccessRequest.findOneAndUpdate(
            {
              requestType: "admin_approval",
              targetEmail: normalizedEmail,
              status: "pending",
            },
            {
              $setOnInsert: {
                requestType: "admin_approval",
                requestedById: googleProfile.sub,
                requestedByEmail: normalizedEmail,
                requestedByRole: "admin",
                targetEmail: normalizedEmail,
                targetName: googleProfile.name || googleProfile.email.split("@")[0],
                title: "Admin access request",
                message: "An admin access request was submitted from login/sign-up.",
                requestedScopes: ["portal:admin", "portal:customer"],
              },
            },
            {
              new: true,
              upsert: true,
            }
          );
        } catch (requestError) {
          if (requestError?.code === 11000) {
            request = await AccessRequest.findOne({
              requestType: "admin_approval",
              targetEmail: normalizedEmail,
              status: "pending",
            }).sort({ createdAt: -1 });
          } else {
            throw requestError;
          }
        }

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

      const isNewAdmin = !existingAdmin;
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
      shouldSendWelcomeEmail = isNewAdmin;
    } else {
      if (existingAdmin || inferredRole === "admin" || inferredRole === "superadmin") {
        const isNewAdmin = !existingAdmin;
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
        shouldSendWelcomeEmail = isNewAdmin;
      } else if (existingUser) {
        Object.assign(existingUser, userPayload);
        authDocument = await existingUser.save();
      } else {
        try {
          authDocument = await User.create(userPayload);
          shouldSendWelcomeEmail = true;
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

    if (shouldSendWelcomeEmail) {
      sendWelcomeEmail({
        to: authDocument.email,
        displayName: authDocument.displayName,
      }).catch((mailError) => {
        console.error("Welcome email failed:", mailError.message || mailError);
      });
    }

    return res.status(200).json(issueAuthResponse(authDocument, inferredRole));
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

async function signupWithCredentials(req, res, next) {
  try {
    const { email, password, displayName, role = "customer" } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = String(role || "customer").trim().toLowerCase();
    const selectedRole = normalizedRole === "admin" ? "admin" : "customer";

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const existingAdmin = await AdminProfile.findOne({ email: normalizedEmail, active: true });
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingAdmin || (existingUser && existingUser.authProvider === "google" && !existingUser.passwordHash)) {
      return res.status(409).json({
        success: false,
        message: "This account already exists with Google sign-in. Please continue with Google.",
      });
    }

    if (existingUser && existingUser.passwordHash) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please login.",
      });
    }

    const isAllowedAdminEmail = env.adminAllowedEmails.includes(normalizedEmail);

    if (selectedRole === "admin" && !isAllowedAdminEmail) {
      const request = await AccessRequest.create({
        requestType: "admin_approval",
        requestedById: normalizedEmail,
        requestedByEmail: normalizedEmail,
        requestedByRole: "admin",
        targetEmail: normalizedEmail,
        targetName: normalizeDisplayName(normalizedEmail, displayName),
        title: "Admin access request",
        message: "An admin access request was submitted from credentials sign-up.",
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
          displayName: normalizeDisplayName(normalizedEmail, displayName),
          photoURL: null,
          role: "admin",
        },
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);

    const userDocument = new User({ email: normalizedEmail });
    userDocument.displayName = normalizeDisplayName(normalizedEmail, displayName);
    userDocument.photoURL = userDocument.photoURL || null;
    userDocument.role = selectedRole;
    userDocument.authProvider = "credentials";
    userDocument.passwordHash = passwordHash;
    userDocument.oauth = {
      provider: null,
      providerUserId: null,
      accessToken: null,
      tokenType: null,
      scope: null,
      expiresAt: null,
      lastLoginAt: new Date(),
    };

    const savedUser = await userDocument.save();

    sendWelcomeEmail({
      to: savedUser.email,
      displayName: savedUser.displayName,
    }).catch((mailError) => {
      console.error("Welcome email failed:", mailError.message || mailError);
    });

    return res.status(201).json(issueAuthResponse(savedUser, savedUser.role || "customer"));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    return next(error);
  }
}

async function loginWithCredentials(req, res, next) {
  try {
    const { email, password, role = null } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = role === null || typeof role === "undefined" ? null : String(role).toLowerCase();
    const selectedRole = normalizedRole === "admin" || normalizedRole === "superadmin" || normalizedRole === "customer" ? normalizedRole : null;

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const adminAccount = await AdminProfile.findOne({ email: normalizedEmail, active: true });
    if (adminAccount) {
      return res.status(409).json({
        success: false,
        message: "This account uses Google sign-in. Please continue with Google.",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.authProvider === "google" && !user.passwordHash) {
      return res.status(409).json({
        success: false,
        message: "This account uses Google sign-in. Please continue with Google.",
      });
    }

    const passwordMatch = await bcrypt.compare(String(password), String(user.passwordHash || ""));
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (selectedRole && user.role !== selectedRole) {
      return res.status(403).json({
        success: false,
        message: `This account is registered as ${user.role}. Please use the correct portal URL.`,
      });
    }

    user.oauth = {
      provider: null,
      providerUserId: null,
      accessToken: null,
      tokenType: null,
      scope: null,
      expiresAt: null,
      lastLoginAt: new Date(),
    };
    await user.save();

    return res.status(200).json(issueAuthResponse(user, user.role || "customer"));
  } catch (error) {
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
  signupWithCredentials,
  loginWithCredentials,
  getCurrentUser,
};
