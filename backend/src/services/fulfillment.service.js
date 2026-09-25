const Product = require("../models/Product");
const Order = require("../models/Order");
const CustomerProfile = require("../models/CustomerProfile");
const Coupon = require("../models/Coupon");
const FinanceTransaction = require("../models/FinanceTransaction");
const PendingOrder = require("../models/PendingOrder");
const { reserveForOrder } = require("./inventory.service");
const { sendOrderInvoiceEmail, sendAdminOrderNotificationEmail } = require("./mail.service");

// Pricing constants (kept in sync with order.controller.js).
const INDIA_FREE_SHIPPING_THRESHOLD = 1499;
const INDIA_STANDARD_SHIPPING = 49;
const INDIA_GST_RATE = 0;

function sanitizeCustomization(customization) {
  if (!customization || typeof customization !== "object") return undefined;
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
  const hasValue = Object.values(sanitized).some((v) => typeof v === "string" && v.length > 0);
  return hasValue ? sanitized : undefined;
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
      variant: item.variant && item.variant.sku ? {
        sku: item.variant.sku || "",
        size: item.variant.size || "",
        color: item.variant.color || "",
        gender: item.variant.gender || "",
        neckType: item.variant.neckType || "",
        pattern: item.variant.pattern || "",
      } : undefined,
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

/**
 * The SINGLE source of truth for turning a paid Razorpay order into a
 * persisted Order. Idempotent by razorpayOrderId: if an Order already exists
 * for this Razorpay order, it is returned unchanged (no double reserve, no
 * duplicate finance row, no duplicate email).
 *
 * Callable from three places with identical results:
 *   1. the browser success handler (order.controller.createOrder)
 *   2. the Razorpay webhook (payment.captured)
 *   3. the reconciliation script / cron
 *
 * @param {Object} p
 * @param {{sub:string,email:string,role?:string}} p.auth  who is buying
 * @param {Array}  p.items          cart lines [{productId, quantity, variantSku?, customization?}]
 * @param {string} [p.couponCode]
 * @param {string} p.razorpayOrderId
 * @param {string} p.razorpayPaymentId
 * @param {string} [p.source]       tag for logs/emails ("browser" | "webhook" | "reconcile")
 * @returns {Promise<{order: object, created: boolean}>}
 */
async function fulfillPaidOrder({ auth, items, couponCode = "", razorpayOrderId, razorpayPaymentId, source = "browser" }) {
  console.log(`[Fulfill:${source}] START razorpayOrderId=${razorpayOrderId} paymentId=${razorpayPaymentId} user=${auth?.email} items=${Array.isArray(items) ? items.length : 0}`);
  if (!razorpayOrderId) {
    const e = new Error("razorpayOrderId is required to fulfill an order");
    e.statusCode = 400;
    throw e;
  }
  if (!auth || !auth.sub || !auth.email) {
    const e = new Error("Buyer identity (auth.sub, auth.email) is required to fulfill an order");
    e.statusCode = 400;
    throw e;
  }

  // ---- Idempotency guard: has this Razorpay order already been fulfilled? ----
  const existing = await Order.findOne({ razorpayOrderId });
  if (existing) {
    // Backfill the payment id if the webhook arrives with one we didn't have.
    if (razorpayPaymentId && !existing.razorpayPaymentId) {
      existing.razorpayPaymentId = razorpayPaymentId;
      await existing.save();
    }
    return { order: normalizeOrder(existing), created: false };
  }

  if (!Array.isArray(items) || items.length === 0) {
    const e = new Error("Cannot fulfill an order with no items");
    e.statusCode = 400;
    throw e;
  }

  // ---- Rebuild the order exactly like createOrder did ----
  const quantitiesByProductId = new Map();
  const requestedItems = [];
  for (const item of items) {
    const productId = String(item.productId);
    const quantity = Number(item.quantity);
    const variantSku = item.variantSku ? String(item.variantSku).trim() : "";
    quantitiesByProductId.set(productId, (quantitiesByProductId.get(productId) || 0) + quantity);
    requestedItems.push({ productId, quantity, variantSku, customization: sanitizeCustomization(item.customization) });
  }

  const productIds = [...quantitiesByProductId.keys()];
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const orderItems = [];
  let subtotal = 0;
  for (const item of requestedItems) {
    const product = productMap.get(item.productId);
    if (!product) {
      // A product vanished between checkout and fulfilment. Because payment is
      // already captured we must NOT abort — skip-guarding here would lose the
      // paid line, so we throw and let the caller retain the paid state for
      // manual handling instead of silently dropping items.
      const e = new Error(`Product ${item.productId} no longer exists — cannot auto-fulfill paid order ${razorpayOrderId}`);
      e.statusCode = 409;
      e.code = "PRODUCT_MISSING";
      throw e;
    }
    const matchedVariant = item.variantSku && Array.isArray(product.variants)
      ? product.variants.find((entry) => entry.sku === item.variantSku)
      : null;
    const basePrice = matchedVariant && Number(matchedVariant.price) > 0 ? Number(matchedVariant.price) : product.price;
    const unitPriceINR = Number(basePrice);
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
      variant: matchedVariant ? {
        sku: matchedVariant.sku || "",
        size: matchedVariant.size || "",
        color: matchedVariant.color || "",
        gender: matchedVariant.gender || "",
        neckType: matchedVariant.neckType || "",
        pattern: matchedVariant.pattern || "",
      } : undefined,
      customization: item.customization,
    });
    subtotal += unitPriceINR * item.quantity;
  }

  // ---- Coupon re-validation (server-side, same rules as createOrder) ----
  const normalizedCoupon = typeof couponCode === "string" ? couponCode.trim().toUpperCase() : "";
  let couponDiscount = 0;
  let couponFreeShipping = false;
  let couponData = { code: "", discountType: "", discountValue: 0, discountAmount: 0, freeShipping: false };
  if (normalizedCoupon) {
    const coupon = await Coupon.findOne({ code: normalizedCoupon, active: true });
    if (coupon) {
      const now = new Date();
      const isValid = now >= coupon.validFrom && now <= coupon.validUntil;
      const subtotalPaise = Math.round(subtotal * 100);
      const totalQuantity = Array.from(quantitiesByProductId.values()).reduce((s, q) => s + q, 0);
      const meetsMin = subtotalPaise >= (coupon.minOrderValue || 0);
      const meetsQty = !coupon.minQuantity || totalQuantity >= coupon.minQuantity;
      const buyerEmail = String(auth.email || "").trim().toLowerCase();
      const isAllowedForUser = coupon.visibility !== "restricted"
        || (Array.isArray(coupon.allowedEmails) && buyerEmail && coupon.allowedEmails.includes(buyerEmail));
      const underUsageCap = coupon.maxUses == null || coupon.currentUses < coupon.maxUses;
      const userUseCount = Array.isArray(coupon.usageLog)
        ? coupon.usageLog.filter((log) => log.userId === auth.sub || log.email === buyerEmail).length
        : 0;
      const underPerUserCap = !coupon.maxUsesPerUser || userUseCount < coupon.maxUsesPerUser;
      if (isValid && meetsMin && meetsQty && isAllowedForUser && underUsageCap && underPerUserCap) {
        if (coupon.discountType === "percentage") {
          couponDiscount = Math.round((subtotalPaise * coupon.discountValue) / 100);
          if (coupon.maxDiscount != null && couponDiscount > coupon.maxDiscount) couponDiscount = coupon.maxDiscount;
        } else if (coupon.discountType === "flat") {
          couponDiscount = coupon.discountValue;
        } else if (coupon.discountType === "free_shipping") {
          couponFreeShipping = true;
        }
        if (coupon.freeDelivery) couponFreeShipping = true;
        if (couponDiscount > subtotalPaise) couponDiscount = subtotalPaise;
        couponDiscount = couponDiscount / 100;
        couponData = {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountAmount: couponDiscount,
          freeShipping: couponFreeShipping,
        };
      }
    }
  }

  const baseShipping = subtotal >= INDIA_FREE_SHIPPING_THRESHOLD ? 0 : INDIA_STANDARD_SHIPPING;
  const shipping = couponFreeShipping ? 0 : baseShipping;
  const tax = subtotal * INDIA_GST_RATE;
  const total = Math.max(0, subtotal + shipping + tax - couponDiscount);

  const userRole = auth.role === "admin" || auth.role === "superadmin" ? "admin" : "customer";

  // ---- Persist the paid order ----
  console.log(`[Fulfill:${source}] Reached Order.create | razorpayOrderId=${razorpayOrderId} | subtotal=${subtotal} | shipping=${shipping} | total=${total} | items=${orderItems.length}`);
  // NOTE: we set razorpayOrderId so the idempotency guard above catches any
  // concurrent second caller (browser + webhook racing). A unique index on
  // razorpayOrderId (added in Order model) turns a race into a safe duplicate-key.
  let order;
  try {
    order = await Order.create({
      userId: auth.sub,
      userEmail: auth.email,
      userRole,
      items: orderItems,
      subtotal,
      shipping,
      discount: couponDiscount,
      coupon: couponData,
      tax,
      total,
      status: "Processing",
      paymentMethod: "upi",
      paymentStatus: "paid",
      deliveryPrepaid: false,
      amountPrepaid: total,
      amountDueOnDelivery: 0,
      razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId || "",
    });
  } catch (err) {
    // Duplicate key => another path fulfilled it a millisecond ago. Return that.
    if (err && err.code === 11000) {
      console.log(`[Fulfill:${source}] Duplicate key (race) — returning existing order for ${razorpayOrderId}`);
      const winner = await Order.findOne({ razorpayOrderId });
      if (winner) return { order: normalizeOrder(winner), created: false };
    }
    console.error(`[Fulfill:${source}] Order.create FAILED for ${razorpayOrderId}:`, err.message, err.stack ? err.stack.split("\n").slice(0,4).join(" | ") : "");
    throw err;
  }

  console.log(`[Fulfill:${source}] ✅ Order created: ${order._id} for ${auth.email} | razorpayOrderId=${razorpayOrderId}`);

  // ---- Reserve inventory (paid orders are retained even if reservation fails) ----
  try {
    await reserveForOrder({
      orderId: order._id,
      lines: orderItems.map((item) => ({
        productId: item.productId,
        variantSku: item.variantSku || "",
        quantity: item.quantity,
        productName: item.name,
      })),
      actor: { userId: auth.sub, email: auth.email, role: auth.role },
      expiresAt: null,
    });
  } catch (reserveError) {
    console.error(`[Fulfill:${source}] Inventory reservation failed after payment | Order: ${order._id} | ${reserveError.message}`);
    console.warn(`[Fulfill:${source}] Paid order retained in Processing for manual fulfilment | Order: ${order._id}`);
  }

  // ---- Finance transaction (fire-and-forget) ----
  (async () => {
    try {
      const count = await FinanceTransaction.countDocuments();
      await FinanceTransaction.create({
        transactionNumber: `ORD-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, "0")}`,
        type: "payment_received",
        category: "sales",
        subCategory: "marketplace_sale",
        amount: Math.round(order.subtotal),
        taxAmount: Math.round(order.tax || 0),
        netAmount: Math.round(order.total),
        paidAmount: Math.round(order.total),
        balanceAmount: 0,
        paymentMethod: "upi",
        paymentStatus: "paid",
        accountHead: "income",
        description: `Online order: ${order._id.toString().slice(-8).toUpperCase()} (${source})`,
        partyType: "customer",
        partyName: auth.email.split("@")[0],
        partyEmail: auth.email,
        referenceType: "order",
        referenceId: order._id,
        referenceNumber: order._id.toString(),
        createdBy: order.items[0]?.dealerId || auth.sub,
      });
    } catch (err) {
      console.warn(`[Fulfill:${source}] Finance transaction creation failed:`, err.message);
    }
  })();

  // ---- Customer invoice email (fire-and-forget) ----
  (async () => {
    try {
      const normalized = normalizeOrder(order);
      const profile = await CustomerProfile.findOne({ userId: auth.sub }).lean();
      const defaultAddress = (profile?.addresses || []).find((a) => a.isDefault) || (profile?.addresses || [])[0];
      const addressText = defaultAddress
        ? [defaultAddress.line1, defaultAddress.line2, `${defaultAddress.city}, ${defaultAddress.state} ${defaultAddress.pincode}`].filter(Boolean).join(", ")
        : null;
      await sendOrderInvoiceEmail({
        to: auth.email,
        displayName: profile?.displayName || auth.email,
        order: normalized,
        buyer: { name: profile?.displayName || "Valued Customer", email: auth.email, phone: profile?.phone || null, address: addressText },
      });
      console.log(`[Fulfill:${source}] ✅ Invoice email sent to ${auth.email} | Order: ${order._id}`);
    } catch (mailError) {
      console.error(`[Fulfill:${source}] ❌ Invoice email failed for ${auth.email} | Order: ${order._id} | ${mailError.message}`);
    }
  })();

  // ---- Admin notification (fire-and-forget) ----
  sendAdminOrderNotificationEmail({
    order: normalizeOrder(order),
    customerEmail: auth.email,
    customerName: auth.email.split("@")[0],
    source,
  }).catch((err) => console.error(`[Fulfill:${source}] Admin notification failed:`, err.message));

  // ---- Mark the snapshot fulfilled (best-effort) ----
  PendingOrder.updateOne(
    { razorpayOrderId },
    { $set: { status: "fulfilled", orderId: order._id, razorpayPaymentId: razorpayPaymentId || "", fulfilledAt: new Date(), lastError: "" } }
  ).catch(() => {});

  return { order: normalizeOrder(order), created: true };
}

module.exports = {
  fulfillPaidOrder,
  normalizeOrder,
  sanitizeCustomization,
  INDIA_FREE_SHIPPING_THRESHOLD,
  INDIA_STANDARD_SHIPPING,
  INDIA_GST_RATE,
};
