const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Review = require("../models/Review");
const WishlistItem = require("../models/WishlistItem");
const CustomerProfile = require("../models/CustomerProfile");
const { isValidRazorpaySignature, isRazorpayConfigured } = require("./payment.controller");
const { fulfillPaidOrder } = require("../services/fulfillment.service");
const { sendOrderInvoiceEmail, sendAdminOrderNotificationEmail } = require("../services/mail.service");
const {
  reserveForOrder,
  releaseForOrder,
  commitForOrder,
} = require("../services/inventory.service");
const Coupon = require("../models/Coupon");
const { recordCouponUsage } = require("./coupon.controller");
const FinanceTransaction = require("../models/FinanceTransaction");

const INDIA_FREE_SHIPPING_THRESHOLD = 1499;
const INDIA_STANDARD_SHIPPING = 49;
const INDIA_GST_RATE = 0;
// Minutes an unpaid online order holds its reserved stock before the expiry
// sweeper releases it back to available.
const ORDER_HOLD_MINUTES = Number(process.env.ORDER_HOLD_MINUTES || 30);

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
      variantSku: item.variantSku || "",
      variant: item.variant && item.variant.sku
        ? {
            sku: item.variant.sku || "",
            size: item.variant.size || "",
            color: item.variant.color || "",
            gender: item.variant.gender || "",
            neckType: item.variant.neckType || "",
            pattern: item.variant.pattern || "",
          }
        : undefined,
      customization: item.customization || undefined,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount || 0,
    coupon: order.coupon || null,
    tax: order.tax,
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    razorpayPaymentId: order.razorpayPaymentId || "",
    deliveryPrepaid: Boolean(order.deliveryPrepaid),
    amountPrepaid: Number(order.amountPrepaid || 0),
    amountDueOnDelivery: Number(order.amountDueOnDelivery || 0),
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
      variantSku: item.variantSku || "",
      variant: item.variant && item.variant.sku
        ? {
            sku: item.variant.sku || "",
            size: item.variant.size || "",
            color: item.variant.color || "",
            gender: item.variant.gender || "",
            neckType: item.variant.neckType || "",
            pattern: item.variant.pattern || "",
          }
        : undefined,
      customization: item.customization || undefined,
    })),
    subtotal: scopedSubtotal,
    shipping: scopedShipping,
    tax: scopedTax,
    total: scopedTotal,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    razorpayPaymentId: order.razorpayPaymentId || "",
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
      return res.status(400).json({ success: false, message: "Order items are required" });
    }

    // COD is permanently disabled — reject outright.
    const rawMethod = String(req.body?.paymentMethod || "").toLowerCase();
    if (rawMethod === "cod") {
      return res.status(400).json({
        success: false,
        message: "Cash on Delivery is no longer available. Please pay online to place your order.",
        code: "COD_DISABLED",
      });
    }

    const razorpayOrderId = String(req.body?.razorpay_order_id || "").trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || "").trim();
    const razorpaySignature = String(req.body?.razorpay_signature || "").trim();

    // Online-payment only. Re-verify the Razorpay signature server-side so an
    // order can never be created without a genuine, captured payment.
    if (!isRazorpayConfigured()) {
      return res.status(500).json({ success: false, message: "Online payments are not configured" });
    }
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are required for online payment",
      });
    }
    if (!isValidRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
      console.error(`[createOrder] SIGNATURE FAILED | razorpayOrderId=${razorpayOrderId} | paymentId=${razorpayPaymentId} | user=${req.auth?.email}`);
      return res.status(400).json({
        success: false,
        message: "Payment could not be verified. Order was not created.",
      });
    }
    console.log(`[createOrder] Signature OK | razorpayOrderId=${razorpayOrderId} | user=${req.auth?.email}`);

    // Delegate to the shared fulfilment service — the SAME idempotent path the
    // Razorpay webhook and the reconciliation script use. If the webhook has
    // already created this order, fulfillPaidOrder returns it unchanged
    // (created=false) instead of duplicating it.
    const couponCode = typeof req.body?.couponCode === "string" ? req.body.couponCode : "";
    const { order, created } = await fulfillPaidOrder({
      auth: { sub: req.auth.sub, email: req.auth.email, role: req.auth.role },
      items,
      couponCode,
      razorpayOrderId,
      razorpayPaymentId,
      source: "browser",
    });

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Order placed successfully" : "Order already recorded",
      order,
    });
  } catch (error) {
    console.error(`[createOrder] UNHANDLED ERROR | user=${req.auth?.email}:`, error.message);
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
        { $match: { ...orderFilter, status: { $nin: ["Cancelled", "Returned", "Refunded", "Expired"] } } },
        { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
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

    // Inventory transitions are delegated to the transactional inventory
    // service and are idempotent (safe against duplicate status updates):
    //   -> Cancelled (before dispatch): release reserved stock to available.
    //   -> Shipped   (dispatch):        commit the reservation (stock leaves).
    // Delivered makes no inventory change (already committed at dispatch).
    const wasDispatched = ["Shipped", "Delivered"].includes(order.status);
    const isNewlyCancelled = status === "Cancelled" && order.status !== "Cancelled";
    const isNewlyDispatched = status === "Shipped" && !wasDispatched;

    if (isNewlyCancelled) {
      if (wasDispatched) {
        return res.status(409).json({
          success: false,
          message: "Order already dispatched and cannot be cancelled. Use the return flow instead.",
        });
      }
      await releaseForOrder({
        orderId: order._id,
        reason: "Order cancelled before dispatch",
        actor: { userId: req.auth?.sub, email: req.auth?.email, role: req.auth?.role },
      });
    } else if (isNewlyDispatched) {
      await commitForOrder({
        orderId: order._id,
        reason: "Order dispatched",
        actor: { userId: req.auth?.sub, email: req.auth?.email, role: req.auth?.role },
      });
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

async function cancelMyOrder(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Ensure the customer owns this order
    if (order.userId !== req.auth.sub) {
      return res.status(403).json({
        success: false,
        message: "You can only cancel your own orders",
      });
    }

    // Already cancelled
    if (order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "This order is already cancelled.",
      });
    }

    // Cannot cancel after dispatch
    if (["Shipped", "Delivered"].includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: "This order has already been dispatched and cannot be cancelled. Please use the return/refund process instead.",
      });
    }

    // Release reserved inventory
    await releaseForOrder({
      orderId: order._id,
      reason: "Customer cancelled order",
      actor: { userId: req.auth.sub, email: req.auth.email, role: req.auth.role },
    });

    const updatedOrder = await Order.findByIdAndUpdate(orderId, { status: "Cancelled" }, { new: true });

    // Fire-and-forget: notify admin about the cancellation
    const { sendAdminCancellationEmail } = require("../services/mail.service");
    (async () => {
      try {
        await sendAdminCancellationEmail({
          order: normalizeOrder(updatedOrder),
          customerEmail: req.auth.email || order.userEmail,
          customerName: req.auth.email ? req.auth.email.split("@")[0] : "Customer",
        });
      } catch (emailErr) {
        console.warn("[Order] Admin cancellation email failed:", emailErr.message);
      }
    })();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order: normalizeOrder(updatedOrder),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /orders/admin/:orderId — Full order details for the admin panel.
 * Regular admins can only see orders containing their own products (dealerId match).
 * Superadmins can see any order.
 */
async function getAdminOrderById(req, res, next) {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isSuperAdmin = req.auth?.role === "superadmin";
    const dealerId = req.auth?.sub;

    // Access control: regular admins can only see orders that contain their items
    if (!isSuperAdmin) {
      const hasOwnItems = order.items.some((item) => item.dealerId === dealerId);
      if (!hasOwnItems) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    // Fetch customer profile if available
    let customerProfile = null;
    if (order.userId) {
      customerProfile = await CustomerProfile.findOne({ userId: order.userId }).lean();
    }

    // Get default address if available
    const defaultAddr = customerProfile?.addresses?.find((a) => a.isDefault) || customerProfile?.addresses?.[0] || null;

    return res.status(200).json({
      success: true,
      order: {
        ...normalizeOrder(order),
        customer: customerProfile
          ? {
              name: customerProfile.displayName || "",
              email: customerProfile.email || order.userEmail,
              phone: customerProfile.phone || "",
              address: defaultAddr
                ? { line1: defaultAddr.line1, line2: defaultAddr.line2, city: defaultAddr.city, state: defaultAddr.state, pincode: defaultAddr.pincode, country: defaultAddr.country }
                : null,
            }
          : { name: "", email: order.userEmail, phone: "", address: null },
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getAdminDashboard,
  getAdminOrderById,
  updateAdminOrderStatus,
  cancelMyOrder,
};
