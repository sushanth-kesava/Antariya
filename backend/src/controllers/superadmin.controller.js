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
    const validTypes = new Set(["admin_approval", "superadmin_access", "feature_request"]);

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

    if ((requestType === "admin_approval" || requestType === "superadmin_access") && !targetEmail) {
      return res.status(400).json({
        success: false,
        message: "Target email is required for approval requests",
      });
    }

    const request = await AccessRequest.create({
      requestType,
      requestedById: req.auth.sub,
      requestedByEmail: req.auth.email,
      requestedByRole: req.auth.role,
      targetEmail: targetEmail ? String(targetEmail).trim().toLowerCase() : null,
      targetName: targetName ? String(targetName).trim() : null,
      title: String(title).trim(),
      message: String(message).trim(),
      requestedScopes: Array.isArray(requestedScopes)
        ? requestedScopes.map((value) => String(value).trim()).filter(Boolean)
        : [],
    });

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
      const targetEmail = String(request.targetEmail || request.requestedByEmail || "").trim().toLowerCase();

      if (!targetEmail) {
        return res.status(400).json({
          success: false,
          message: "Target email is required for approval",
        });
      }

      const nextRole = request.requestType === "superadmin_access" ? "superadmin" : "admin";
      const existingProfile = await AdminProfile.findOne({ email: targetEmail });

      const profile = existingProfile || new AdminProfile({ email: targetEmail, displayName: request.targetName || targetEmail.split("@")[0] });
      profile.displayName = request.targetName || profile.displayName || targetEmail.split("@")[0];
      profile.photoURL = profile.photoURL || null;
      profile.provider = profile.provider || "google";
      profile.role = nextRole === "superadmin" ? "superadmin" : profile.role || "admin";
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

module.exports = {
  getSuperAdminDashboard,
  createAccessRequest,
  listAccessRequests,
  reviewAccessRequest,
};