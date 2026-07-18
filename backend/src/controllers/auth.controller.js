const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const AccessRequest = require("../models/AccessRequest");
const CustomerProfile = require("../models/CustomerProfile");
const env = require("../config/env");
const { sendWelcomeEmail } = require("../services/mail.service");
const { setAuthCookie } = require("../middleware/cookie-auth.middleware");

function normalizeDisplayName(email, displayName) {
  const normalizedName = String(displayName || "").trim();
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  return String(email || "user").split("@")[0];
}

function issueJwtToken(authDocument, inferredRole) {
  const jwtPayload = {
    sub: authDocument._id.toString(),
    email: authDocument.email,
    role: inferredRole || authDocument.role,
  };

  const jwtOptions = env.jwtExpiresIn ? { expiresIn: env.jwtExpiresIn } : undefined;
  return jwt.sign(jwtPayload, env.jwtSecret, jwtOptions);
}

function issueAuthResponse(authDocument, inferredRole, res) {
  const appToken = issueJwtToken(authDocument, inferredRole);

  // Set HttpOnly cookie if response object is provided
  if (res) {
    setAuthCookie(res, appToken);
  }

  return {
    success: true,
    message: "Authenticated successfully",
    // Token is also in the response body because the frontend needs it for:
    // (1) Next.js middleware cookie (non-HttpOnly, read by middleware.ts)
    // (2) Bearer header fallback in fetch-client.ts
    token: appToken,
    user: {
      id: authDocument._id,
      email: authDocument.email,
      displayName: authDocument.displayName,
      photoURL: authDocument.photoURL,
      role: inferredRole || authDocument.role,
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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function resolvePortalRoleForEmail(email, existingAdminRole = null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return "customer";
  }

  if (env.superAdminAllowedEmails.includes(normalizedEmail)) {
    return "superadmin";
  }

  if (existingAdminRole === "superadmin") {
    return "superadmin";
  }

  if (existingAdminRole === "admin") {
    return "admin";
  }

  if (env.adminAllowedEmails.includes(normalizedEmail)) {
    return "admin";
  }

  return "customer";
}

function portalMismatchMessage(email, expectedRole) {
  return `${normalizeEmail(email)} is assigned to the ${expectedRole} portal. Please use the correct Gmail account.`;
}

async function resolveCurrentAccount(userId, email, role) {
  const normalizedEmail = email ? normalizeEmail(email) : null;

  if (normalizedEmail) {
    const activeAdmin = await AdminProfile.findOne({ email: normalizedEmail, active: true });
    const resolvedAdminRole = resolvePortalRoleForEmail(normalizedEmail, activeAdmin?.role || null);

    if (activeAdmin) {
      return {
        account: activeAdmin,
        role: resolvedAdminRole,
      };
    }

    const userAccount = await User.findOne({ email: normalizedEmail });

    if (userAccount) {
      return {
        account: userAccount,
        role: resolvePortalRoleForEmail(normalizedEmail, null),
      };
    }
  }

  if (userId) {
    const adminById = await AdminProfile.findById(userId);

    if (adminById && adminById.active) {
      return {
        account: adminById,
        role: resolvePortalRoleForEmail(adminById.email, adminById.role || "admin"),
      };
    }

    const userById = await User.findById(userId);

    if (userById) {
      return {
        account: userById,
        role: resolvePortalRoleForEmail(userById.email, null),
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
    const selectedRole = normalizedRole === "admin" || normalizedRole === "superadmin" || normalizedRole === "customer" ? normalizedRole : null;

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

    const normalizedEmail = normalizeEmail(googleProfile.email);
    const existingAdmin = await AdminProfile.findOne({ email: normalizedEmail, active: true });
    const existingUser = await User.findOne({ email: normalizedEmail });

    const requestedRole = selectedRole || "customer";
    const inferredRole = resolvePortalRoleForEmail(normalizedEmail, existingAdmin?.role || null);
    const isEligibleForAdminRequest =
      env.adminAllowedEmails.length === 0 || env.adminAllowedEmails.includes(normalizedEmail);

    if (requestedRole === "customer" && inferredRole !== "customer") {
      return res.status(409).json({
        success: false,
        message: portalMismatchMessage(normalizedEmail, inferredRole),
      });
    }

    if (requestedRole === "superadmin" && inferredRole !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: portalMismatchMessage(normalizedEmail, "superadmin"),
      });
    }

    if (requestedRole === "admin" && inferredRole === "superadmin") {
      return res.status(409).json({
        success: false,
        message: portalMismatchMessage(normalizedEmail, "superadmin"),
      });
    }

    if (requestedRole === "admin" && inferredRole !== "admin") {
      if (env.adminAllowedEmails.length > 0) {
        return res.status(403).json({
          success: false,
          message: portalMismatchMessage(normalizedEmail, "admin"),
        });
      }
    }

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
        // Access token is NOT persisted — used only for the initial userinfo call.
        tokenType: null,
        scope: null,
        expiresAt: calculateExpiryDate(expiresIn),
        lastLoginAt: new Date(),
      },
    };

    let authDocument;
    let shouldSendWelcomeEmail = false;

    if (inferredRole === "superadmin") {

      await User.deleteOne({ email: userPayload.email });

      const isNewSuperAdmin = !existingAdmin;
      const adminDocument = existingAdmin || new AdminProfile({ email: userPayload.email });
      adminDocument.googleId = userPayload.googleId;
      adminDocument.displayName = userPayload.displayName;
      adminDocument.photoURL = userPayload.photoURL;
      adminDocument.provider = "google";
      adminDocument.role = "superadmin";
      adminDocument.active = true;
      adminDocument.lastAdminLoginAt = new Date();
      adminDocument.loginCount = Number(adminDocument.loginCount || 0) + 1;
      authDocument = await adminDocument.save();
      shouldSendWelcomeEmail = isNewSuperAdmin;
    } else if (requestedRole === "admin" && inferredRole === "customer") {
      if (!isEligibleForAdminRequest) {
        return res.status(403).json({
          success: false,
          message: "This email is not eligible for admin access request.",
        });
      }

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
    } else {
      if (inferredRole === "admin") {
        await User.deleteOne({ email: userPayload.email });

        const isNewAdmin = !existingAdmin;
        const adminDocument = existingAdmin || new AdminProfile({ email: userPayload.email });
        adminDocument.googleId = userPayload.googleId;
        adminDocument.displayName = userPayload.displayName;
        adminDocument.photoURL = userPayload.photoURL;
        adminDocument.provider = "google";
        adminDocument.role = existingAdmin?.role === "superadmin" ? "superadmin" : "admin";
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

    console.log("[DEBUG] shouldSendWelcomeEmail:", shouldSendWelcomeEmail, "| email:", authDocument?.email);
    if (shouldSendWelcomeEmail) {
      sendWelcomeEmail({
        to: authDocument.email,
        displayName: authDocument.displayName,
      }).catch((mailError) => {
        console.error("Welcome email failed:", mailError.message || mailError);
      });
    }

    // Create CustomerProfile for new customers
    if (shouldSendWelcomeEmail && inferredRole === "customer") {
      CustomerProfile.findOneAndUpdate(
        { userId: authDocument._id },
        {
          $setOnInsert: {
            userId: authDocument._id,
            email: authDocument.email,
            displayName: authDocument.displayName || "",
            photoURL: authDocument.photoURL || null,
          },
        },
        { upsert: true, new: true }
      ).catch((profileError) => {
        console.error("CustomerProfile creation failed:", profileError.message || profileError);
      });
    }

    return res.status(200).json(issueAuthResponse(authDocument, inferredRole, res));
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
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = String(role || "customer").trim().toLowerCase();
    const selectedRole = normalizedRole === "admin" ? "admin" : "customer";

    if (selectedRole === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin signup is Google-only. Use admin login with Google to request access.",
      });
    }

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
    const registeredPortalRole = resolvePortalRoleForEmail(normalizedEmail, existingAdmin?.role || null);

    if (registeredPortalRole !== "customer") {
      return res.status(403).json({
        success: false,
        message: portalMismatchMessage(normalizedEmail, registeredPortalRole),
      });
    }

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

    // Create CustomerProfile for new credentials customer
    CustomerProfile.findOneAndUpdate(
      { userId: savedUser._id },
      {
        $setOnInsert: {
          userId: savedUser._id,
          email: savedUser.email,
          displayName: savedUser.displayName || "",
          photoURL: null,
        },
      },
      { upsert: true, new: true }
    ).catch((profileError) => {
      console.error("CustomerProfile creation failed:", profileError.message || profileError);
    });

    sendWelcomeEmail({
      to: savedUser.email,
      displayName: savedUser.displayName,
    }).catch((mailError) => {
      console.error("Welcome email failed:", mailError.message || mailError);
    });

    return res.status(201).json(issueAuthResponse(savedUser, savedUser.role || "customer", res));
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
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = role === null || typeof role === "undefined" ? null : String(role).toLowerCase();
    const selectedRole = normalizedRole === "admin" || normalizedRole === "superadmin" || normalizedRole === "customer" ? normalizedRole : null;

    if (selectedRole === "admin" || selectedRole === "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Admin and superadmin login is Google-only.",
      });
    }

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const adminAccount = await AdminProfile.findOne({ email: normalizedEmail, active: true });
    const registeredPortalRole = resolvePortalRoleForEmail(normalizedEmail, adminAccount?.role || null);

    if (registeredPortalRole !== "customer") {
      return res.status(403).json({
        success: false,
        message: portalMismatchMessage(normalizedEmail, registeredPortalRole),
      });
    }

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

    if (user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Privileged accounts must use Google sign-in.",
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

    return res.status(200).json(issueAuthResponse(user, user.role || "customer", res));
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

    const refreshedToken = issueJwtToken(user, currentRole);

    return res.status(200).json({
      success: true,
      token: refreshedToken,
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
