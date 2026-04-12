const AdminProfile = require("../models/AdminProfile");
const AccessRequest = require("../models/AccessRequest");
const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Review = require("../models/Review");
const WishlistItem = require("../models/WishlistItem");

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
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt,
    reviewNote: request.reviewNote,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
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
      totalCustomers,
      totalAdmins,
      totalSuperAdmins,
      totalOrders,
      totalRevenueStats,
      pendingRequests,
      adminProfiles,
      customerProfiles,
      recentRequests,
      lowStockProducts,
      pendingReviews,
      wishlistItems,
    ] = await Promise.all([
      User.countDocuments({}),
      AdminProfile.countDocuments({ role: "admin" }),
      AdminProfile.countDocuments({ role: "superadmin" }),
      Order.countDocuments({}),
      Order.aggregate([{ $group: { _id: null, totalRevenue: { $sum: "$total" } } }]),
      AccessRequest.countDocuments({ status: "pending" }),
      AdminProfile.find({}).sort({ createdAt: -1 }).limit(100),
      User.find({}).sort({ createdAt: -1 }).limit(100),
      AccessRequest.find({}).sort({ createdAt: -1 }).limit(100),
      Product.countDocuments({ stock: { $lte: 10 } }),
      Review.countDocuments({ moderationStatus: "pending" }),
      WishlistItem.countDocuments({}),
    ]);

    const totalRevenue = Number(totalRevenueStats?.[0]?.totalRevenue || 0);

    return res.status(200).json({
      success: true,
      summary: {
        totalCustomers,
        totalAdmins,
        totalSuperAdmins,
        totalOrders,
        totalRevenue,
        pendingRequests,
        lowStockProducts,
        pendingReviews,
        wishlistItems,
      },
      adminProfiles: adminProfiles.map(normalizeAdminProfile),
      customerProfiles: customerProfiles.map(normalizeCustomerProfile),
      accessRequests: recentRequests.map(normalizeAccessRequest),
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

    const { requestType, title, message, targetEmail, targetName, requestedScopes = [] } = req.body;
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

    if (existingUser && existingUser.role !== "customer") {
      existingUser.role = "customer";
      await existingUser.save();
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
  createAccessRequest,
  listAccessRequests,
  reviewAccessRequest,
  updateUserRole,
};