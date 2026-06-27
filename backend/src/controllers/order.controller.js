const Review = require("../models/Review");
const WishlistItem = require("../models/WishlistItem");
const customerService = require("../services/odoo/customer.service");
const productService = require("../services/odoo/product.service");
const salesService = require("../services/odoo/sales.service");
const inventoryService = require("../services/odoo/inventory.service");
const dashboardService = require("../services/odoo/dashboard.service");
const authService = require("../services/odoo/auth.service");

const INDIA_FREE_SHIPPING_THRESHOLD = 1499;
const INDIA_STANDARD_SHIPPING = 99;
const INDIA_GST_RATE = 0.18;
const LEGACY_USD_TO_INR_RATE = 83;

const ODOO_STATE_BY_STATUS = {
  Processing: "draft",
  Shipped: "sale",
  Delivered: "done",
  Cancelled: "cancel",
};

const ODOO_STATUS_TO_LABEL = {
  draft: "Processing",
  sent: "Processing",
  sale: "Shipped",
  done: "Delivered",
  cancel: "Cancelled",
};

function normalizeCatalogPriceToINR(price) {
  const value = Number(price || 0);
  return value > 0 && value <= 200 ? value * LEGACY_USD_TO_INR_RATE : value;
}

function normalizeCustomization(customization) {
  if (!customization || typeof customization !== "object") {
    return undefined;
  }

  const sizeOptions = new Set(["Small", "Medium", "Large"]);
  const normalized = {
    symbol: typeof customization.symbol === "string" ? customization.symbol.trim() : undefined,
    threadColor: typeof customization.threadColor === "string" ? customization.threadColor.trim() : undefined,
    fabricColor: typeof customization.fabricColor === "string" ? customization.fabricColor.trim() : undefined,
    size: typeof customization.size === "string" && sizeOptions.has(customization.size) ? customization.size : undefined,
    placement: typeof customization.placement === "string" ? customization.placement.trim() : undefined,
    referenceImage: typeof customization.referenceImage === "string" ? customization.referenceImage : undefined,
    referenceImageName: typeof customization.referenceImageName === "string" ? customization.referenceImageName.trim() : undefined,
    notes: typeof customization.notes === "string" ? customization.notes.trim().slice(0, 300) : undefined,
  };

  const hasValue = Object.values(normalized).some((value) => typeof value === "string" && value.length > 0);
  return hasValue ? normalized : undefined;
}

function formatOrderStatus(state) {
  return ODOO_STATUS_TO_LABEL[String(state || "draft").trim().toLowerCase()] || "Processing";
}

function formatOrderDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function summarizeCustomization(items = []) {
  return items
    .map((item) => {
      if (!item.customization) {
        return null;
      }

      const parts = [];
      if (item.customization.symbol) parts.push(`symbol=${item.customization.symbol}`);
      if (item.customization.threadColor) parts.push(`threadColor=${item.customization.threadColor}`);
      if (item.customization.fabricColor) parts.push(`fabricColor=${item.customization.fabricColor}`);
      if (item.customization.size) parts.push(`size=${item.customization.size}`);
      if (item.customization.placement) parts.push(`placement=${item.customization.placement}`);
      if (item.customization.notes) parts.push(`notes=${item.customization.notes}`);

      return parts.length > 0 ? `${item.productId}: ${parts.join("; ")}` : null;
    })
    .filter(Boolean)
    .join(" | ");
}

async function getCurrentCustomerFromAuth(auth) {
  const email = String(auth?.email || "").trim().toLowerCase();

  if (!email) {
    return null;
  }

  const result = await customerService.syncCustomer({
    email,
    name: email.split("@")[0] || "Customer",
  });

  return result?.customer || null;
}

async function getCustomerEmailByPartnerId(partnerId) {
  if (!partnerId) {
    return "";
  }

  const client = await authService.getClient();
  const data = await client.call("res.partner", "read", [[Number(partnerId)], ["email"]]);
  return Array.isArray(data) && data[0]?.email ? String(data[0].email) : "";
}

async function getProductLookupMap(productIds) {
  const products = await productService.getProductsByIds(productIds);
  return new Map(products.map((product) => [String(product.id), product]));
}

async function getInventoryQuantityForProduct(productId) {
  const inventory = await inventoryService.getInventoryByProductId(productId);
  if (!Array.isArray(inventory) || inventory.length === 0) {
    return 0;
  }

  return inventory.reduce((sum, item) => sum + Number(item.availableQuantity || 0), 0);
}

function normalizeOdooLine(line, productMap) {
  const productId = String(line.productId || line.product_id?.[0] || line.product_id || "");
  const product = productMap.get(productId) || null;

  return {
    productId: productId,
    dealerId: product?.dealerId || null,
    dealerName: product?.dealerName || null,
    dealerEmail: product?.dealerEmail || null,
    name: product?.name || line.productName || line.name || "Unknown product",
    image: product?.image || line.image || "",
    price: Number(line.unitPrice ?? line.price_unit ?? product?.price ?? 0),
    quantity: Number(line.quantity ?? line.product_uom_qty ?? 0),
    customization: line.customization || undefined,
  };
}

function normalizeOdooOrder(order, productMap) {
  const lines = Array.isArray(order.order_line) ? order.order_line : [];
  const items = lines.map((line) => normalizeOdooLine(line, productMap)).filter(Boolean);

  return {
    id: String(order.id),
    userId: String(order.customerId || order.partner_id?.[0] || ""),
    userEmail: order.customerEmail || order.partnerEmail || order.partner_id?.[1] || "",
    userRole: order.userRole || "customer",
    items,
    subtotal: Number(order.subtotal || order.amount_untaxed || 0),
    shipping: Number(order.shippingAmount || 0),
    tax: Number(order.tax || order.amount_tax || 0),
    total: Number(order.total || order.amount_total || 0),
    status: formatOrderStatus(order.state),
    createdAt: order.orderDate || order.date_order || new Date().toISOString(),
  };
}

async function fetchOrdersForDomain(domain, { limit = 100, dealerId = null } = {}) {
  const client = await authService.getClient();
  const orderIds = await client.call("sale.order", "search", [domain, { limit, order: "date_order desc" }]);

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return [];
  }

  const fields = [
    "id",
    "name",
    "date_order",
    "state",
    "partner_id",
    "amount_untaxed",
    "amount_tax",
    "amount_total",
    "order_line",
    "note",
    "client_order_ref",
    "payment_state",
    "invoice_status",
  ];

  const orders = await client.call("sale.order", "read", [orderIds, fields]);
  if (!Array.isArray(orders) || orders.length === 0) {
    return [];
  }

  const lineIds = orders.flatMap((order) => (Array.isArray(order.order_line) ? order.order_line : []));
  const lineFields = [
    "id",
    "order_id",
    "product_id",
    "name",
    "product_uom_qty",
    "price_unit",
    "discount",
    "price_subtotal",
    "price_tax",
    "price_total",
  ];

  const lines = lineIds.length > 0 ? await client.call("sale.order.line", "read", [lineIds, lineFields]) : [];
  const productIds = Array.from(
    new Set(
      (Array.isArray(lines) ? lines : [])
        .map((line) => line.product_id?.[0])
        .filter((productId) => Number.isInteger(Number(productId)))
        .map((productId) => String(productId))
    )
  );
  const productMap = await getProductLookupMap(productIds);

  const linesByOrderId = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    const productId = line.product_id?.[0];
    const mappedLine = {
      orderId: line.order_id?.[0],
      productId,
      productName: line.product_id?.[1] || line.name,
      name: line.name,
      quantity: Number(line.product_uom_qty || 0),
      unitPrice: Number(line.price_unit || 0),
      discount: Number(line.discount || 0),
      subtotal: Number(line.price_subtotal || 0),
      tax: Number(line.price_tax || 0),
      total: Number(line.price_total || 0),
    };

    const orderLineOrderId = line.order_id?.[0];
    if (!linesByOrderId.has(orderLineOrderId)) {
      linesByOrderId.set(orderLineOrderId, []);
    }
    linesByOrderId.get(orderLineOrderId).push(mappedLine);
  }

  return orders.map((order) => {
    const normalizedOrder = normalizeOdooOrder(
      {
        id: order.id,
        partner_id: order.partner_id,
        date_order: order.date_order,
        state: order.state,
        amount_untaxed: order.amount_untaxed,
        amount_tax: order.amount_tax,
        amount_total: order.amount_total,
        order_line: linesByOrderId.get(order.id) || [],
      },
      productMap
    );

    if (!normalizedOrder.userEmail) {
      normalizedOrder.userEmail = `partner-${order.partner_id?.[0] || order.id}@odoo.local`;
    }

    if (dealerId) {
      const scopedItems = normalizedOrder.items.filter((item) => item.dealerId === dealerId);
      const scopedSubtotal = scopedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
      const ratio = Number(normalizedOrder.subtotal || 0) > 0 ? scopedSubtotal / Number(normalizedOrder.subtotal || 0) : 0;

      return {
        ...normalizedOrder,
        items: scopedItems,
        subtotal: scopedSubtotal,
        shipping: Number(normalizedOrder.shipping || 0) * ratio,
        tax: Number(normalizedOrder.tax || 0) * ratio,
        total: scopedSubtotal + Number(normalizedOrder.tax || 0) * ratio + Number(normalizedOrder.shipping || 0) * ratio,
      };
    }

    return normalizedOrder;
  });
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
        customization: normalizeCustomization(item.customization),
      });
    }

    const productIds = [...quantitiesByProductId.keys()];
    const productMap = await getProductLookupMap(productIds);

    if (productMap.size !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more products no longer exist",
      });
    }

    for (const [productId, quantity] of quantitiesByProductId.entries()) {
      const availableQuantity = await getInventoryQuantityForProduct(productId);

      if (availableQuantity < quantity) {
        const product = productMap.get(productId);
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product?.name || "selected product"}`,
        });
      }
    }

    const customer = await getCurrentCustomerFromAuth(req.auth);

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Unable to resolve customer in Odoo",
      });
    }

    const lines = requestedItems.map((item) => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: normalizeCatalogPriceToINR(product.price),
        productName: product.name,
        customization: item.customization,
      };
    });

    const notes = summarizeCustomization(requestedItems);
    const shippingAmount = lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0) >= INDIA_FREE_SHIPPING_THRESHOLD ? 0 : INDIA_STANDARD_SHIPPING;

    const createdOrder = await salesService.createSalesOrder({
      customerId: customer.id,
      lines,
      shippingAmount,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: {
        id: String(createdOrder.id),
        userId: String(customer.id),
        userEmail: customer.email || req.auth.email,
        userRole: req.auth.role === "admin" || req.auth.role === "superadmin" ? "admin" : "customer",
        items: (createdOrder.lines || []).map((line) => ({
          productId: String(line.productId || ""),
          dealerId: null,
          dealerName: null,
          dealerEmail: null,
          name: line.productName || line.name || "Unknown product",
          image: productMap.get(String(line.productId || ""))?.image || "",
          price: Number(line.unitPrice || 0),
          quantity: Number(line.quantity || 0),
          customization: undefined,
        })),
        subtotal: Number(createdOrder.subtotal || 0),
        shipping: Number(createdOrder.shippingAmount || shippingAmount || 0),
        tax: Number(createdOrder.tax || 0) || Math.round(Number(createdOrder.subtotal || 0) * INDIA_GST_RATE),
        total: Number(createdOrder.total || 0),
        status: formatOrderStatus(createdOrder.state),
        createdAt: formatOrderDate(createdOrder.orderDate || createdOrder.date_order),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const customer = await getCurrentCustomerFromAuth(req.auth);

    if (!customer) {
      return res.status(200).json({
        success: true,
        orders: [],
      });
    }

    const orders = await fetchOrdersForDomain([["partner_id", "=", Number(customer.id)]], { limit: 100 });

    if (orders.length > 0 && !orders[0].userEmail) {
      orders[0].userEmail = await getCustomerEmailByPartnerId(customer.id);
    }

    return res.status(200).json({
      success: true,
      orders,
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

    const isSuperAdmin = req.auth?.role === "superadmin";
    const dealerProductIds = isSuperAdmin
      ? []
      : (await productService.getProducts({ limit: 1000, filters: { dealerId: req.auth.sub } })).products.map((product) => product.id);

    if (!isSuperAdmin && dealerProductIds.length === 0) {
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

    const orderDomain = isSuperAdmin
      ? []
      : [["order_line.product_id", "in", dealerProductIds.map((productId) => Number(productId))]];

    const [allCustomerStats, lowStockProducts, pendingReviews, wishlistItems, orders] = await Promise.all([
      dashboardService.getCustomerStats(),
      dashboardService.getLowStockProducts(10, 100),
      Review.countDocuments({ moderationStatus: "pending" }),
      WishlistItem.countDocuments({}),
      fetchOrdersForDomain(orderDomain, { limit: 200, dealerId: isSuperAdmin ? null : req.auth.sub }),
    ]);

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter((order) => new Date(order.createdAt).getTime() >= todayStart.getTime()).length;

    const statusBreakdown = {
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };

    for (const order of orders) {
      if (Object.prototype.hasOwnProperty.call(statusBreakdown, order.status)) {
        statusBreakdown[order.status] += 1;
      }
    }

    return res.status(200).json({
      success: true,
      summary: {
        customers: allCustomerStats.total,
        totalOrders,
        totalRevenue,
        averageOrderValue,
        todayOrders,
        lowStockProducts: lowStockProducts.length,
        pendingReviews,
        wishlistItems,
      },
      recentOrders: orders.slice(0, 8),
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

    if (!Object.prototype.hasOwnProperty.call(ODOO_STATE_BY_STATUS, status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const allOrders = await fetchOrdersForDomain([["id", "=", Number(orderId)]], { limit: 1 });
    const existingOrder = allOrders[0];

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (req.auth?.role !== "superadmin") {
      const dealerProducts = (await productService.getProducts({ limit: 1000, filters: { dealerId: req.auth.sub } })).products;
      const dealerProductIds = new Set(dealerProducts.map((product) => String(product.id)));
      const canManageOrder = existingOrder.items.some((item) => dealerProductIds.has(String(item.productId)));

      if (!canManageOrder) {
        return res.status(403).json({
          success: false,
          message: "You can update only orders that include your products",
        });
      }
    }

    const client = await authService.getClient();
    const targetState = ODOO_STATE_BY_STATUS[status];

    if (targetState === "sale") {
      await salesService.confirmSalesOrder(orderId);
    } else if (targetState === "cancel") {
      await salesService.cancelSalesOrder(orderId);
    } else {
      await client.call("sale.order", "write", [[Number(orderId)], { state: targetState }]);
    }

    const updatedOrders = await fetchOrdersForDomain([["id", "=", Number(orderId)]], { limit: 1, dealerId: req.auth?.role === "superadmin" ? null : req.auth.sub });
    const updatedOrder = updatedOrders[0];

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated",
      order: updatedOrder,
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