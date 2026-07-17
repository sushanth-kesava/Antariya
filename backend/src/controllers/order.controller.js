const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Review = require("../models/Review");
const WishlistItem = require("../models/WishlistItem");
const CustomerProfile = require("../models/CustomerProfile");
const { isValidRazorpaySignature, isRazorpayConfigured } = require("./payment.controller");
const { sendOrderInvoiceEmail } = require("../services/mail.service");
const {
  reserveForOrder,
  releaseForOrder,
  commitForOrder,
} = require("../services/inventory.service");

const INDIA_FREE_SHIPPING_THRESHOLD = 1499;
const INDIA_STANDARD_SHIPPING = 99;
// GST set to 0 — business is not GST-registered (no GSTIN).
const INDIA_GST_RATE = 0;
// TODO: Replace with a live exchange rate API or remove USD pricing entirely.
// This hardcoded rate drifts over time and causes financial discrepancies.
const LEGACY_USD_TO_INR_RATE = Number(process.env.USD_TO_INR_RATE) || 85;
// Minutes an unpaid online order holds its reserved stock before the expiry
// sweeper releases it back to available.
const ORDER_HOLD_MINUTES = Number(process.env.ORDER_HOLD_MINUTES || 30);

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
      return res.status(400).json({
        success: false,
        message: "Order items are required",
      });
    }

    // --- Payment method + verification gate -------------------------------
    // An order must never be persisted without a valid payment. For online
    // (UPI/card/netbanking) payments we re-verify the Razorpay signature
    // server-side; only Cash-on-Delivery may skip a payment id.
    // Cash on Delivery has been removed — the store is online-payment only.
    // Reject any COD request outright so no COD order can be created, even by
    // a direct API call.
    const rawMethod = String(req.body?.paymentMethod || "").toLowerCase();
    if (rawMethod === "cod") {
      return res.status(400).json({
        success: false,
        message: "Cash on Delivery is no longer available. Please pay online to place your order.",
        code: "COD_DISABLED",
      });
    }
    const paymentMethod = "upi";
    const razorpayOrderId = String(req.body?.razorpay_order_id || "").trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || "").trim();
    const razorpaySignature = String(req.body?.razorpay_signature || "").trim();
    let paymentStatus = "pending";

    if (paymentMethod === "upi") {
      if (!isRazorpayConfigured()) {
        return res.status(500).json({
          success: false,
          message: "Online payments are not configured",
        });
      }
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: "Payment verification details are required for online payment",
        });
      }
      if (!isValidRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
        return res.status(400).json({
          success: false,
          message: "Payment could not be verified. Order was not created.",
        });
      }
      paymentStatus = "paid";
    }
    // --------------------------------------------------------------------

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
      const variantSku = item.variantSku ? String(item.variantSku).trim() : "";
      quantitiesByProductId.set(productId, (quantitiesByProductId.get(productId) || 0) + quantity);
      requestedItems.push({
        productId,
        quantity,
        variantSku,
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

    // Variant-level stock validation: sum requested quantity per (productId, variantSku)
    // and ensure the matching variant has enough stock.
    const variantDemand = new Map();
    for (const item of requestedItems) {
      if (!item.variantSku) continue;
      const mapKey = `${item.productId}::${item.variantSku}`;
      variantDemand.set(mapKey, (variantDemand.get(mapKey) || 0) + item.quantity);
    }
    for (const [mapKey, demand] of variantDemand.entries()) {
      const [productId, sku] = mapKey.split("::");
      const product = productMap.get(productId);
      const variant = Array.isArray(product?.variants)
        ? product.variants.find((entry) => entry.sku === sku)
        : null;
      if (variant && Number(variant.stock) < demand) {
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product.name} (${sku})`,
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

      const matchedVariant = item.variantSku && Array.isArray(product.variants)
        ? product.variants.find((entry) => entry.sku === item.variantSku)
        : null;

      const basePrice = matchedVariant && Number(matchedVariant.price) > 0
        ? Number(matchedVariant.price)
        : product.price;
      const unitPriceINR = normalizeCatalogPriceToINR(basePrice);

      orderItems.push({
        productId: product._id,
        dealerId: product.dealerId,
        dealerName: product.dealerName || "Unknown Admin",
        dealerEmail: product.dealerEmail || "unknown@antariya.local",
        name: product.name,
        image: product.image,
        price: unitPriceINR,
        quantity: item.quantity,
        variantSku: matchedVariant ? matchedVariant.sku : "",
        variant: matchedVariant
          ? {
              sku: matchedVariant.sku || "",
              size: matchedVariant.size || "",
              color: matchedVariant.color || "",
              gender: matchedVariant.gender || "",
              neckType: matchedVariant.neckType || "",
              pattern: matchedVariant.pattern || "",
            }
          : undefined,
        customization: item.customization,
      });

      subtotal += unitPriceINR * item.quantity;
    }

    const shipping = subtotal >= INDIA_FREE_SHIPPING_THRESHOLD ? 0 : INDIA_STANDARD_SHIPPING;
    const tax = subtotal * INDIA_GST_RATE;
    const total = subtotal + shipping + tax;

    // Online-payment only: the full total is paid up front, nothing is due on
    // delivery. (COD has been removed.)
    const amountPrepaid = total;
    const amountDueOnDelivery = 0;

    // Persist the order first (status Processing), then atomically reserve
    // stock via the inventory service. Reservation is the ONLY thing that
    // touches physical stock, inside an ACID transaction with row guards that
    // prevent overselling. If it fails, we roll the order back so no orphan
    // order is left behind.
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
      paymentMethod,
      paymentStatus,
      deliveryPrepaid: false,
      amountPrepaid,
      amountDueOnDelivery,
      razorpayOrderId,
      razorpayPaymentId,
    });

    // Unpaid online (UPI) orders get a hold the expiry sweeper releases if
    // payment never completes. Paid orders and COD do not auto-expire.
    const shouldExpire = paymentMethod === "upi" && paymentStatus !== "paid";
    const expiresAt = shouldExpire ? new Date(Date.now() + ORDER_HOLD_MINUTES * 60 * 1000) : null;

    try {
      await reserveForOrder({
        orderId: order._id,
        lines: orderItems.map((item) => ({
          productId: item.productId,
          variantSku: item.variantSku || "",
          quantity: item.quantity,
          productName: item.name,
        })),
        actor: { userId: req.auth.sub, email: req.auth.email, role: req.auth.role },
        expiresAt,
      });
    } catch (reserveError) {
      // Roll back the just-created order so a failed reservation leaves no trace.
      await Order.deleteOne({ _id: order._id }).catch(() => {});
      if (reserveError && reserveError.code === "OUT_OF_STOCK") {
        return res.status(409).json({
          success: false,
          message: "One or more items just went out of stock. Your order was not placed and you were not charged.",
          code: "OUT_OF_STOCK",
        });
      }
      throw reserveError;
    }

    // Fire-and-forget: email the customer a branded invoice PDF. Never let an
    // email failure break order placement, so we don't await the result.
    (async () => {
      try {
        const normalized = normalizeOrder(order);
        const profile = await CustomerProfile.findOne({ userId: req.auth.sub }).lean();
        const defaultAddress =
          (profile?.addresses || []).find((a) => a.isDefault) || (profile?.addresses || [])[0];
        const addressText = defaultAddress
          ? [defaultAddress.line1, defaultAddress.line2, `${defaultAddress.city}, ${defaultAddress.state} ${defaultAddress.pincode}`]
              .filter(Boolean)
              .join(", ")
          : null;
        await sendOrderInvoiceEmail({
          to: req.auth.email,
          displayName: profile?.displayName || req.auth.email,
          order: normalized,
          buyer: {
            name: profile?.displayName || "Valued Customer",
            email: req.auth.email,
            phone: profile?.phone || null,
            address: addressText,
          },
        });
      } catch (mailError) {
        console.error("Failed to send invoice email:", mailError.message);
      }
    })();

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

module.exports = {
  createOrder,
  getMyOrders,
  getAdminDashboard,
  updateAdminOrderStatus,
};
