const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Review = require("../models/Review");
const WishlistItem = require("../models/WishlistItem");

function normalizeOrder(order) {
  return {
    id: order._id.toString(),
    userId: order.userId,
    userEmail: order.userEmail,
    userRole: order.userRole,
    items: order.items.map((item) => ({
      productId: item.productId.toString(),
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      customization: item.customization || undefined,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    tax: order.tax,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
  };
}

function sanitizeCustomization(customization) {
  if (!customization || typeof customization !== "object") {
    return undefined;
  }

  const sizeOptions = new Set(["Small", "Medium", "Large"]);
  const sanitized = {
    symbol: typeof customization.symbol === "string" ? customization.symbol.trim() : undefined,
    threadColor: typeof customization.threadColor === "string" ? customization.threadColor.trim() : undefined,
    fabricColor: typeof customization.fabricColor === "string" ? customization.fabricColor.trim() : undefined,
    size: typeof customization.size === "string" && sizeOptions.has(customization.size) ? customization.size : undefined,
    placement: typeof customization.placement === "string" ? customization.placement.trim() : undefined,
    referenceImage: typeof customization.referenceImage === "string" ? customization.referenceImage : undefined,
    referenceImageName: typeof customization.referenceImageName === "string" ? customization.referenceImageName.trim() : undefined,
    notes: typeof customization.notes === "string" ? customization.notes.trim().slice(0, 300) : undefined,
  };

  const hasValue = Object.values(sanitized).some((value) => typeof value === "string" && value.length > 0);
  return hasValue ? sanitized : undefined;
}

async function createOrder(req, res, next) {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are required",
      });
    }

    const quantitiesByProductId = new Map();
    const requestedItems = [];

    for (const item of items) {
      if (!item.productId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) {
        return res.status(400).json({
          success: false,
          message: "Each order item must include productId and quantity >= 1",
        });
      }

      const productId = String(item.productId);
      const quantity = Number(item.quantity);
      quantitiesByProductId.set(productId, (quantitiesByProductId.get(productId) || 0) + quantity);
      requestedItems.push({
        productId,
        quantity,
        customization: sanitizeCustomization(item.customization),
      });
    }

    const productIds = [...quantitiesByProductId.keys()];
    const products = await Product.find({ _id: { $in: productIds } });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more products no longer exist",
      });
    }

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const orderItems = [];
    let subtotal = 0;

    for (const [productId, quantity] of quantitiesByProductId.entries()) {
      const product = productMap.get(productId);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: "Product lookup failed during checkout",
        });
      }

      if (product.stock < quantity) {
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }
    }

    for (const item of requestedItems) {
      const product = productMap.get(item.productId);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: "Product lookup failed during checkout",
        });
      }

      orderItems.push({
        productId: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity: item.quantity,
        customization: item.customization,
      });

      subtotal += product.price * item.quantity;
    }

    const shipping = subtotal > 100 ? 0 : 15;
    const tax = subtotal * 0.08;
    const total = subtotal + shipping + tax;

    await Promise.all(
      orderItems.map((item) =>
        Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity },
        })
      )
    );

    const order = await Order.create({
      userId: req.auth.sub,
      userEmail: req.auth.email,
      userRole: req.auth.role === "admin" || req.auth.role === "superadmin" ? "admin" : "customer",
      items: orderItems,
      subtotal,
      shipping,
      tax,
      total,
      status: "Processing",
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: normalizeOrder(order),
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ userId: req.auth.sub }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders: orders.map(normalizeOrder),
    });
  } catch (error) {
    return next(error);
  }
}

async function getAdminDashboard(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalCustomers,
      totalOrders,
      todayOrders,
      lowStockProducts,
      pendingReviews,
      wishlistItems,
      revenueStats,
      recentOrders,
      statusAgg,
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      Order.countDocuments({}),
      Order.countDocuments({ createdAt: { $gte: todayStart } }),
      Product.countDocuments({ stock: { $lte: 10 } }),
      Review.countDocuments({ moderationStatus: "pending" }),
      WishlistItem.countDocuments({}),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
          },
        },
      ]),
      Order.find({}).sort({ createdAt: -1 }).limit(8),
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalRevenue = Number(revenueStats?.[0]?.totalRevenue || 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const statusBreakdown = {
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };

    for (const row of statusAgg) {
      if (row && typeof row._id === "string" && Object.prototype.hasOwnProperty.call(statusBreakdown, row._id)) {
        statusBreakdown[row._id] = Number(row.count || 0);
      }
    }

    return res.status(200).json({
      success: true,
      summary: {
        customers: totalCustomers,
        totalOrders,
        totalRevenue,
        averageOrderValue,
        todayOrders,
        lowStockProducts,
        pendingReviews,
        wishlistItems,
      },
      recentOrders: recentOrders.map(normalizeOrder),
      statusBreakdown,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateAdminOrderStatus(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { orderId } = req.params;
    const { status } = req.body;
    const allowedStatuses = new Set(["Processing", "Shipped", "Delivered", "Cancelled"]);

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated",
      order: normalizeOrder(order),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getAdminDashboard,
  updateAdminOrderStatus,
};
