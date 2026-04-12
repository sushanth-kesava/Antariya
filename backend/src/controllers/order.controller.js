const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Review = require("../models/Review");
const WishlistItem = require("../models/WishlistItem");

const INDIA_FREE_SHIPPING_THRESHOLD = 1499;
const INDIA_STANDARD_SHIPPING = 99;
const INDIA_GST_RATE = 0.18;
const LEGACY_USD_TO_INR_RATE = 83;

function normalizeCatalogPriceToINR(price) {
  const value = Number(price || 0);
  return value > 0 && value <= 200 ? value * LEGACY_USD_TO_INR_RATE : value;
}

function normalizeOrder(order) {
  return {
    id: order._id.toString(),
    userId: order.userId,
    userEmail: order.userEmail,
    userRole: order.userRole,
    items: order.items.map((item) => ({
      productId: item.productId.toString(),
      dealerId: item.dealerId,
      dealerName: item.dealerName,
      dealerEmail: item.dealerEmail,
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

function normalizeOrderForDealer(order, dealerId) {
  const scopedItems = order.items.filter((item) => item.dealerId === dealerId);

  const scopedSubtotal = scopedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const ratio = Number(order.subtotal || 0) > 0 ? scopedSubtotal / Number(order.subtotal || 0) : 0;
  const scopedTax = Number(order.tax || 0) * ratio;
  const scopedShipping = Number(order.shipping || 0) * ratio;
  const scopedTotal = scopedSubtotal + scopedTax + scopedShipping;

  return {
    id: order._id.toString(),
    userId: order.userId,
    userEmail: order.userEmail,
    userRole: order.userRole,
    items: scopedItems.map((item) => ({
      productId: item.productId.toString(),
      dealerId: item.dealerId,
      dealerName: item.dealerName,
      dealerEmail: item.dealerEmail,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      customization: item.customization || undefined,
    })),
    subtotal: scopedSubtotal,
    shipping: scopedShipping,
    tax: scopedTax,
    total: scopedTotal,
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

      const unitPriceINR = normalizeCatalogPriceToINR(product.price);

      orderItems.push({
        productId: product._id,
        dealerId: product.dealerId,
        dealerName: product.dealerName || "Unknown Admin",
        dealerEmail: product.dealerEmail || "unknown@stitchmart.local",
        name: product.name,
        image: product.image,
        price: unitPriceINR,
        quantity: item.quantity,
        customization: item.customization,
      });

      subtotal += unitPriceINR * item.quantity;
    }

    const shipping = subtotal >= INDIA_FREE_SHIPPING_THRESHOLD ? 0 : INDIA_STANDARD_SHIPPING;
    const tax = subtotal * INDIA_GST_RATE;
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
    const isSuperAdmin = req.auth?.role === "superadmin";
    const ownedProductFilter = isSuperAdmin ? {} : { dealerId: req.auth.sub };
    const ownedProducts = await Product.find(ownedProductFilter).select("_id");
    const ownedProductIds = ownedProducts.map((product) => product._id);

    if (!isSuperAdmin && ownedProductIds.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          customers: 0,
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          todayOrders: 0,
          lowStockProducts: 0,
          pendingReviews: 0,
          wishlistItems: 0,
        },
        recentOrders: [],
        statusBreakdown: {
          Processing: 0,
          Shipped: 0,
          Delivered: 0,
          Cancelled: 0,
        },
      });
    }

    const orderFilter = isSuperAdmin ? {} : { "items.dealerId": req.auth.sub };

    const [
      totalCustomersRaw,
      totalOrders,
      todayOrders,
      lowStockProducts,
      pendingReviews,
      wishlistItems,
      revenueStats,
      recentOrders,
      statusAgg,
    ] = await Promise.all([
      isSuperAdmin ? User.countDocuments({ role: "customer" }) : Order.distinct("userId", orderFilter),
      Order.countDocuments(orderFilter),
      Order.countDocuments({ ...orderFilter, createdAt: { $gte: todayStart } }),
      Product.countDocuments({ ...ownedProductFilter, stock: { $lte: 10 } }),
      Review.countDocuments({
        moderationStatus: "pending",
        ...(isSuperAdmin ? {} : { productId: { $in: ownedProductIds } }),
      }),
      WishlistItem.countDocuments(isSuperAdmin ? {} : { productId: { $in: ownedProductIds } }),
      Order.aggregate([
        ...(isSuperAdmin
          ? []
          : [
              {
                $match: { "items.dealerId": req.auth.sub },
              },
            ]),
        {
          $unwind: "$items",
        },
        ...(isSuperAdmin
          ? []
          : [
              {
                $match: { "items.dealerId": req.auth.sub },
              },
            ]),
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          },
        },
      ]),
      Order.find(orderFilter).sort({ createdAt: -1 }).limit(8),
      Order.aggregate([
        ...(isSuperAdmin
          ? []
          : [
              {
                $match: { "items.dealerId": req.auth.sub },
              },
            ]),
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalRevenue = Number(revenueStats?.[0]?.totalRevenue || 0);
    const totalCustomers = Array.isArray(totalCustomersRaw) ? totalCustomersRaw.length : Number(totalCustomersRaw || 0);
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
      recentOrders: recentOrders.map((order) =>
        isSuperAdmin ? normalizeOrder(order) : normalizeOrderForDealer(order, req.auth.sub)
      ),
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

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (req.auth?.role !== "superadmin") {
      const canManageOrder = order.items.some((item) => item.dealerId === req.auth.sub);

      if (!canManageOrder) {
        return res.status(403).json({
          success: false,
          message: "You can update only orders that include your products",
        });
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated",
      order: req.auth?.role === "superadmin" ? normalizeOrder(updatedOrder) : normalizeOrderForDealer(updatedOrder, req.auth.sub),
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
