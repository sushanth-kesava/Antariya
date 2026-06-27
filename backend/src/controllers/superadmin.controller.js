const AdminProfile = require("../models/AdminProfile");
const AccessRequest = require("../models/AccessRequest");
const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Review = require("../models/Review");
const WishlistItem = require("../models/WishlistItem");
const dashboardService = require("../services/odoo/dashboard.service");
const authService = require("../services/odoo/auth.service");
const env = require("../config/env");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveRegisteredPortalByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return "customer";
  }

  if (env.superAdminAllowedEmails.includes(normalizedEmail)) {
    return "superadmin";
  }

  if (env.adminAllowedEmails.includes(normalizedEmail)) {
    return "admin";
  }

  return "customer";
}

function buildPortalClassificationAudit(adminProfiles, customerProfiles) {
  const accountsByEmail = new Map();

  adminProfiles.forEach((profile) => {
    const email = normalizeEmail(profile.email);

    if (!email) {
      return;
    }

    accountsByEmail.set(email, {
      email,
      source: "admin_profile",
      currentRole: profile.role === "superadmin" ? "superadmin" : "admin",
      active: Boolean(profile.active),
    });
  });

  customerProfiles.forEach((profile) => {
    const email = normalizeEmail(profile.email);

    if (!email) {
      return;
    }

    if (!accountsByEmail.has(email)) {
      accountsByEmail.set(email, {
        email,
        source: "user",
        currentRole: "customer",
        active: true,
      });
    }
  });

  const accounts = [...accountsByEmail.values()].map((account) => {
    const registeredPortal = resolveRegisteredPortalByEmail(account.email);
    const mismatch = account.currentRole !== registeredPortal;

    return {
      email: account.email,
      source: account.source,
      currentRole: account.currentRole,
      registeredPortal,
      active: account.active,
      mismatch,
      reason: mismatch
        ? `Current role is ${account.currentRole} but Gmail allowlist maps to ${registeredPortal}.`
        : "Role matches registered portal.",
    };
  });

  const mismatches = accounts.filter((account) => account.mismatch).length;

  return {
    totalAccounts: accounts.length,
    mismatches,
    accounts,
  };
}

function buildUniquePortalSummaryCounts(adminProfiles, customerProfiles) {
  const uniqueAccountsByEmail = new Map();

  adminProfiles.forEach((profile) => {
    const email = normalizeEmail(profile.email);

    if (!email) {
      return;
    }

    uniqueAccountsByEmail.set(email, profile.role === "superadmin" ? "superadmin" : "admin");
  });

  customerProfiles.forEach((profile) => {
    const email = normalizeEmail(profile.email);

    if (!email || uniqueAccountsByEmail.has(email)) {
      return;
    }

    uniqueAccountsByEmail.set(email, "customer");
  });

  let totalCustomers = 0;
  let totalAdmins = 0;
  let totalSuperAdmins = 0;

  for (const role of uniqueAccountsByEmail.values()) {
    if (role === "superadmin") {
      totalSuperAdmins += 1;
    } else if (role === "admin") {
      totalAdmins += 1;
    } else {
      totalCustomers += 1;
    }
  }

  return {
    totalCustomers,
    totalAdmins,
    totalSuperAdmins,
  };
}

function ensureSuperAdmin(req, res) {
  if (req.auth?.role !== "superadmin") {
    res.status(403).json({
      success: false,
      message: "Superadmin access required",
    });
    return false;
  }

  return true;
}

function normalizeAdminProfile(profile) {
  return {
    id: profile._id.toString(),
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    role: profile.role || "admin",
    active: Boolean(profile.active),
    loginCount: Number(profile.loginCount || 0),
    lastAdminLoginAt: profile.lastAdminLoginAt,
    createdAt: profile.createdAt,
  };
}

function normalizeCustomerProfile(profile) {
  return {
    id: profile._id.toString(),
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    role: profile.role || "customer",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function normalizeAccessRequest(request) {
  return {
    id: request._id.toString(),
    requestType: request.requestType,
    status: request.status,
    requestedById: request.requestedById,
    requestedByEmail: request.requestedByEmail,
    requestedByRole: request.requestedByRole,
    targetEmail: request.targetEmail,
    targetName: request.targetName,
    title: request.title,
    message: request.message,
    requestedScopes: request.requestedScopes || [],
    applicationDetails: request.applicationDetails || null,
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt,
    reviewNote: request.reviewNote,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function normalizeApplicationDetails(details) {
  if (!details || typeof details !== "object") {
    return null;
  }

  return {
    fullName: details.fullName ? String(details.fullName).trim() : null,
    email: details.email ? String(details.email).trim().toLowerCase() : null,
    phoneNumber: details.phoneNumber ? String(details.phoneNumber).trim() : null,
    businessName: details.businessName ? String(details.businessName).trim() : null,
    businessType: details.businessType ? String(details.businessType).trim() : null,
    businessAddress: details.businessAddress ? String(details.businessAddress).trim() : null,
    website: details.website ? String(details.website).trim() : null,
    panNumber: details.panNumber ? String(details.panNumber).trim() : null,
    aadharNumber: details.aadharNumber ? String(details.aadharNumber).trim() : null,
    gstNumber: details.gstNumber ? String(details.gstNumber).trim() : null,
    notes: details.notes ? String(details.notes).trim() : null,
  };
}

function buildAdminApplicationMessage(applicationDetails) {
  const summaryParts = [
    applicationDetails.fullName && `Applicant: ${applicationDetails.fullName}`,
    applicationDetails.email && `Email: ${applicationDetails.email}`,
    applicationDetails.phoneNumber && `Phone: ${applicationDetails.phoneNumber}`,
    applicationDetails.businessName && `Business: ${applicationDetails.businessName}`,
    applicationDetails.businessType && `Type: ${applicationDetails.businessType}`,
    applicationDetails.businessAddress && `Address: ${applicationDetails.businessAddress}`,
    applicationDetails.website && `Website: ${applicationDetails.website}`,
    applicationDetails.panNumber && `PAN: ${applicationDetails.panNumber}`,
    applicationDetails.aadharNumber && `Aadhar: ${applicationDetails.aadharNumber}`,
    applicationDetails.gstNumber && `GST: ${applicationDetails.gstNumber}`,
  ].filter(Boolean);

  return [
    "Public admin access application submitted.",
    summaryParts.length > 0 ? summaryParts.join(" | ") : null,
    applicationDetails.notes ? `Notes: ${applicationDetails.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function submitPublicAdminApplication(req, res, next) {
  try {
    const applicationDetails = normalizeApplicationDetails(req.body);

    if (!applicationDetails?.fullName || !applicationDetails.email || !applicationDetails.phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and phone number are required",
      });
    }

    if (!applicationDetails.businessName || !applicationDetails.businessType || !applicationDetails.businessAddress) {
      return res.status(400).json({
        success: false,
        message: "Business name, business type, and business address are required",
      });
    }

    if (!applicationDetails.panNumber || !applicationDetails.aadharNumber) {
      return res.status(400).json({
        success: false,
        message: "PAN and Aadhar numbers are required",
      });
    }

    const request = await AccessRequest.create({
      requestType: "admin_approval",
      requestedById: applicationDetails.email,
      requestedByEmail: applicationDetails.email,
      requestedByRole: "public",
      targetEmail: applicationDetails.email,
      targetName: applicationDetails.fullName,
      title: `${applicationDetails.businessName} admin access application`,
      message: buildAdminApplicationMessage(applicationDetails),
      requestedScopes: ["portal:admin"],
      applicationDetails,
    });

    return res.status(201).json({
      success: true,
      message: "Admin application submitted",
      request: normalizeAccessRequest(request),
    });
  } catch (error) {
    return next(error);
  }
}

function normalizeManagedAccount({ email, role, source, active }) {
  return {
    email,
    role,
    source,
    active,
  };
}

async function getSuperAdminDashboard(req, res, next) {
  try {
    if (!ensureSuperAdmin(req, res)) {
      return;
    }

    const [
      dashboardSnapshot,
      pendingRequests,
      adminProfiles,
      customerProfiles,
      recentRequests,
      pendingReviews,
      wishlistItems,
    ] = await Promise.all([
      dashboardService.getDashboardSnapshot(),
      AccessRequest.countDocuments({ status: "pending" }),
      AdminProfile.find({}).sort({ createdAt: -1 }).limit(100),
      User.find({}).sort({ createdAt: -1 }).limit(100),
      AccessRequest.find({}).sort({ createdAt: -1 }).limit(100),
      Review.countDocuments({ moderationStatus: "pending" }),
      WishlistItem.countDocuments({}),
    ]);

    const client = await authService.getClient();
    const totalOrders = Number(await client.call("sale.order", "search_count", [["state", "!=", "cancel"]])) || 0;
    const totalRevenue = Number(dashboardSnapshot?.revenue?.total || 0);
    const lowStockProducts = Array.isArray(dashboardSnapshot?.lowStock) ? dashboardSnapshot.lowStock.length : 0;
    const normalizedAdminProfiles = adminProfiles.map(normalizeAdminProfile);
    const normalizedCustomerProfiles = customerProfiles.map(normalizeCustomerProfile);
    const portalClassificationAudit = buildPortalClassificationAudit(normalizedAdminProfiles, normalizedCustomerProfiles);
    const portalSummaryCounts = buildUniquePortalSummaryCounts(normalizedAdminProfiles, normalizedCustomerProfiles);

    return res.status(200).json({
      success: true,
      summary: {
        totalCustomers: portalSummaryCounts.totalCustomers,
        totalAdmins: portalSummaryCounts.totalAdmins,
        totalSuperAdmins: portalSummaryCounts.totalSuperAdmins,
        totalOrders,
        totalRevenue,
        pendingRequests,
        lowStockProducts,
        pendingReviews,
        wishlistItems,
      },
      adminProfiles: normalizedAdminProfiles,
      customerProfiles: normalizedCustomerProfiles,
      accessRequests: recentRequests.map(normalizeAccessRequest),
      portalClassificationAudit,
    });
  } catch (error) {
    return next(error);
  }
}

async function createAccessRequest(req, res, next) {
  try {
    if (!req.auth || req.auth.role === "customer") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { requestType, title, message, targetEmail, targetName, requestedScopes = [], applicationDetails } = req.body;
    const validTypes = new Set(["admin_approval", "feature_request"]);

    if (!validTypes.has(requestType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request type",
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    if (requestType === "admin_approval" && !targetEmail) {
      return res.status(400).json({
        success: false,
        message: "Target email is required for approval requests",
      });
    }

    const normalizedTargetEmail = targetEmail ? String(targetEmail).trim().toLowerCase() : null;
    const normalizedTitle = String(title).trim();
    const normalizedMessage = String(message).trim();
    const normalizedScopes = Array.isArray(requestedScopes)
      ? requestedScopes.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const normalizedApplicationDetails = normalizeApplicationDetails(applicationDetails);

    let request;
    if (requestType === "admin_approval" && normalizedTargetEmail) {
      try {
        request = await AccessRequest.findOneAndUpdate(
          {
            requestType: "admin_approval",
            targetEmail: normalizedTargetEmail,
            status: "pending",
          },
          {
            $setOnInsert: {
              requestType,
              requestedById: req.auth.sub,
              requestedByEmail: req.auth.email,
              requestedByRole: req.auth.role,
              targetEmail: normalizedTargetEmail,
              targetName: targetName ? String(targetName).trim() : null,
              title: normalizedTitle,
              message: normalizedMessage,
              requestedScopes: normalizedScopes,
              applicationDetails: normalizedApplicationDetails,
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
            targetEmail: normalizedTargetEmail,
            status: "pending",
          }).sort({ createdAt: -1 });
        } else {
          throw requestError;
        }
      }
    } else {
      request = await AccessRequest.create({
        requestType,
        requestedById: req.auth.sub,
        requestedByEmail: req.auth.email,
        requestedByRole: req.auth.role,
        targetEmail: normalizedTargetEmail,
        targetName: targetName ? String(targetName).trim() : null,
        title: normalizedTitle,
        message: normalizedMessage,
        requestedScopes: normalizedScopes,
          applicationDetails: normalizedApplicationDetails,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Access request submitted",
      request: normalizeAccessRequest(request),
    });
  } catch (error) {
    return next(error);
  }
}

async function listAccessRequests(req, res, next) {
  try {
    if (!ensureSuperAdmin(req, res)) {
      return;
    }

    const requests = await AccessRequest.find({}).sort({ createdAt: -1 }).limit(100);

    return res.status(200).json({
      success: true,
      requests: requests.map(normalizeAccessRequest),
    });
  } catch (error) {
    return next(error);
  }
}

async function reviewAccessRequest(req, res, next) {
  try {
    if (!ensureSuperAdmin(req, res)) {
      return;
    }

    const { requestId } = req.params;
    const { status, reviewNote } = req.body;
    const validStatuses = new Set(["approved", "rejected"]);

    if (!validStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status",
      });
    }

    const request = await AccessRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Access request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Access request has already been reviewed",
      });
    }

    if (status === "approved") {
      if (request.requestType === "superadmin_access") {
        return res.status(400).json({
          success: false,
          message: "Creating new superadmin accounts is disabled",
        });
      }

      if (request.requestType === "feature_request") {
        request.status = status;
        request.reviewedBy = req.auth.sub;
        request.reviewedAt = new Date();
        request.reviewNote = reviewNote ? String(reviewNote).trim() : null;
        await request.save();

        return res.status(200).json({
          success: true,
          message: `Access request ${status}`,
          request: normalizeAccessRequest(request),
        });
      }

      const targetEmail = String(request.targetEmail || request.requestedByEmail || "").trim().toLowerCase();

      if (!targetEmail) {
        return res.status(400).json({
          success: false,
          message: "Target email is required for approval",
        });
      }

      const existingProfile = await AdminProfile.findOne({ email: targetEmail });

      const profile = existingProfile || new AdminProfile({ email: targetEmail, displayName: request.targetName || targetEmail.split("@")[0] });
      profile.displayName = request.targetName || profile.displayName || targetEmail.split("@")[0];
      profile.photoURL = profile.photoURL || null;
      profile.provider = profile.provider || "google";
      profile.role = profile.role === "superadmin" ? "superadmin" : "admin";
      profile.active = true;
      await profile.save();

      await User.deleteOne({ email: targetEmail });
    }

    request.status = status;
    request.reviewedBy = req.auth.sub;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote ? String(reviewNote).trim() : null;
    await request.save();

    return res.status(200).json({
      success: true,
      message: `Access request ${status}`,
      request: normalizeAccessRequest(request),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUserRole(req, res, next) {
  try {
    if (!ensureSuperAdmin(req, res)) {
      return;
    }

    const { email, role } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const nextRole = String(role || "").trim().toLowerCase();
    const validRoles = new Set(["customer", "admin"]);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!validRoles.has(nextRole)) {
      return res.status(400).json({
        success: false,
        message: "Role must be customer or admin",
      });
    }

    const existingAdmin = await AdminProfile.findOne({ email: normalizedEmail });
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (!existingAdmin && !existingUser) {
      return res.status(404).json({
        success: false,
        message: "No account found for this email",
      });
    }

    if (nextRole === "customer") {
      if (existingAdmin) {
        existingAdmin.active = false;
        await existingAdmin.save();
      }

      const userDocument = existingUser || new User({
        email: normalizedEmail,
        displayName: existingAdmin?.displayName || normalizedEmail.split("@")[0],
      });

      userDocument.googleId = userDocument.googleId || existingAdmin?.googleId || null;
      userDocument.displayName = userDocument.displayName || existingAdmin?.displayName || normalizedEmail.split("@")[0];
      userDocument.photoURL = userDocument.photoURL || existingAdmin?.photoURL || null;
      userDocument.role = "customer";
      userDocument.authProvider = userDocument.authProvider || "google";
      await userDocument.save();

      return res.status(200).json({
        success: true,
        message: "Role updated to customer",
        account: normalizeManagedAccount({
          email: normalizedEmail,
          role: "customer",
          source: "user",
          active: true,
        }),
      });
    }

    const adminDocument = existingAdmin || new AdminProfile({
      email: normalizedEmail,
      displayName: existingUser?.displayName || normalizedEmail.split("@")[0],
    });

    adminDocument.googleId = adminDocument.googleId || existingUser?.googleId || null;
    adminDocument.displayName = adminDocument.displayName || existingUser?.displayName || normalizedEmail.split("@")[0];
    adminDocument.photoURL = adminDocument.photoURL || existingUser?.photoURL || null;
    adminDocument.provider = adminDocument.provider || "google";
    adminDocument.role = existingAdmin?.role === "superadmin" ? "superadmin" : "admin";
    adminDocument.active = true;
    await adminDocument.save();

    if (existingUser) {
      await User.deleteOne({ email: normalizedEmail });
    }

    return res.status(200).json({
      success: true,
      message: `Role updated to ${adminDocument.role}`,
      account: normalizeManagedAccount({
        email: normalizedEmail,
        role: adminDocument.role,
        source: "admin_profile",
        active: true,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSuperAdminDashboard,
  submitPublicAdminApplication,
  createAccessRequest,
  listAccessRequests,
  reviewAccessRequest,
  updateUserRole,
};