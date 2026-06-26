/**
 * Admin Dashboard Service
 * Business intelligence APIs for backend analytics
 *
 * @module adminDashboardService
 * @description
 * Provides comprehensive dashboard metrics:
 * - Revenue analytics (daily, weekly, monthly)
 * - Order analytics (pending, delivered, etc.)
 * - Inventory analytics (low stock, value)
 * - Customer analytics
 * - Vendor analytics
 */

const { getClient } = require("../odoo/auth.service");
const { withRetry } = require("../../utils/retry.util");
const { getOrFetch, invalidateCache } = require("../cache/cache.manager");
const { logError } = require("../../middleware/error-handler.middleware");

/**
 * Get today's revenue
 * @returns {object} { totalAmount, orderCount, breakdown }
 */
async function getTodayRevenue() {
  const cacheKey = "admin:revenue:today";

  return await getOrFetch(
    cacheKey,
    async () => {
      const client = await getClient();
      const today = new Date().toISOString().split("T")[0];

      const orders = await withRetry(
        () =>
          client.call("sale.order", "search_read", [
            [
              ["date_order", ">=", `${today} 00:00:00`],
              ["date_order", "<=", `${today} 23:59:59`],
              ["state", "in", ["sale", "done"]],
            ],
          ], {
            fields: ["id", "amount_total", "state", "date_order"],
          }),
        "Fetch today revenue",
        { maxRetries: 2 }
      );

      const totalAmount = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

      return {
        totalAmount,
        orderCount: orders.length,
        currency: "INR",
        date: today,
        breakdown: {
          confirmed: orders.filter((o) => o.state === "sale").length,
          completed: orders.filter((o) => o.state === "done").length,
        },
      };
    },
    300 // 5 minute cache
  );
}

/**
 * Get weekly revenue
 * @param {number} days - Days to look back (default: 7)
 * @returns {object} { totalAmount, averageOrder, daily: [] }
 */
async function getWeeklyRevenue(days = 7) {
  const client = await getClient();
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const orders = await withRetry(
    () =>
      client.call("sale.order", "search_read", [
        [
          ["date_order", ">=", fromDate.toISOString()],
          ["date_order", "<=", toDate.toISOString()],
          ["state", "in", ["sale", "done"]],
        ],
      ], {
        fields: ["id", "amount_total", "date_order", "state"],
      }),
    "Fetch weekly revenue",
    { maxRetries: 2 }
  );

  // Group by day
  const daily = {};
  orders.forEach((order) => {
    const date = order.date_order.split(" ")[0];
    if (!daily[date]) {
      daily[date] = { amount: 0, count: 0 };
    }
    daily[date].amount += order.amount_total || 0;
    daily[date].count += 1;
  });

  const totalAmount = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);
  const averageOrder = orders.length > 0 ? totalAmount / orders.length : 0;

  return {
    totalAmount,
    averageOrder,
    orderCount: orders.length,
    days,
    daily: Object.entries(daily).map(([date, data]) => ({
      date,
      ...data,
    })),
  };
}

/**
 * Get monthly revenue
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {object} Revenue data for month
 */
async function getMonthlyRevenue(month, year) {
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 0, 23, 59, 59);

  const client = await getClient();

  const orders = await withRetry(
    () =>
      client.call("sale.order", "search_read", [
        [
          ["date_order", ">=", fromDate.toISOString()],
          ["date_order", "<=", toDate.toISOString()],
          ["state", "in", ["sale", "done"]],
        ],
      ], {
        fields: ["id", "amount_total", "date_order"],
      }),
    "Fetch monthly revenue",
    { maxRetries: 2 }
  );

  const totalAmount = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

  return {
    totalAmount,
    orderCount: orders.length,
    averageOrder: orders.length > 0 ? totalAmount / orders.length : 0,
    month,
    year,
  };
}

/**
 * Get orders today
 */
async function getOrdersToday() {
  const today = new Date().toISOString().split("T")[0];
  const client = await getClient();

  const orders = await withRetry(
    () =>
      client.call("sale.order", "search_read", [
        [
          ["date_order", ">=", `${today} 00:00:00`],
          ["date_order", "<=", `${today} 23:59:59`],
        ],
      ], {
        fields: ["id", "name", "state", "amount_total", "date_order"],
        order: "date_order desc",
        limit: 100,
      }),
    "Fetch orders today",
    { maxRetries: 2 }
  );

  return {
    total: orders.length,
    orders: orders.map((o) => ({
      id: o.id,
      number: o.name,
      status: o.state,
      amount: o.amount_total,
      date: o.date_order,
    })),
  };
}

/**
 * Get pending orders
 */
async function getPendingOrders() {
  const client = await getClient();

  const orders = await withRetry(
    () =>
      client.call("sale.order", "search_read", [
        [["state", "in", ["draft", "sent"]]],
      ], {
        fields: ["id", "name", "state", "amount_total", "date_order"],
        order: "date_order asc",
      }),
    "Fetch pending orders",
    { maxRetries: 2 }
  );

  return {
    total: orders.length,
    orders: orders.map((o) => ({
      id: o.id,
      number: o.name,
      status: o.state,
      amount: o.amount_total,
      createdDaysAgo: Math.floor((Date.now() - new Date(o.date_order)) / (1000 * 60 * 60 * 24)),
    })),
  };
}

/**
 * Get low stock products
 */
async function getLowStockProducts(threshold = 10) {
  const client = await getClient();

  const products = await withRetry(
    () =>
      client.call(
        "product.product",
        "search_read",
        [
          [
            ["qty_available", "<", threshold],
            ["type", "=", "product"],
          ],
        ],
        {
          fields: ["id", "name", "qty_available", "sku", "list_price"],
          limit: 50,
        }
      ),
    "Fetch low stock products",
    { maxRetries: 2 }
  );

  return {
    threshold,
    total: products.length,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      quantity: p.qty_available,
      price: p.list_price,
    })),
  };
}

/**
 * Get inventory value
 */
async function getInventoryValue() {
  const client = await getClient();

  const quants = await withRetry(
    () =>
      client.call("stock.quant", "search_read", [], {
        fields: ["id", "product_id", "quantity", "cost"],
      }),
    "Fetch inventory",
    { maxRetries: 2 }
  );

  const totalValue = quants.reduce(
    (sum, q) => sum + (q.quantity * q.cost || 0),
    0
  );

  return {
    totalValue,
    itemCount: quants.length,
    currency: "INR",
  };
}

/**
 * Get best selling products
 */
async function getBestSellingProducts(limit = 10) {
  const client = await getClient();

  const lines = await withRetry(
    () =>
      client.call("sale.order.line", "search_read", [
        [["order_id.state", "in", ["sale", "done"]]],
      ], {
        fields: ["product_id", "qty_delivered", "price_unit"],
      }),
    "Fetch best sellers",
    { maxRetries: 2 }
  );

  // Group by product
  const productSales = {};
  lines.forEach((line) => {
    const productId = line.product_id[0];
    const productName = line.product_id[1];
    if (!productSales[productId]) {
      productSales[productId] = {
        name: productName,
        quantity: 0,
        revenue: 0,
      };
    }
    productSales[productId].quantity += line.qty_delivered || 0;
    productSales[productId].revenue += (line.qty_delivered || 0) * (line.price_unit || 0);
  });

  const sorted = Object.entries(productSales)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limit);

  return {
    total: sorted.length,
    products: sorted.map(([id, data]) => ({
      id: parseInt(id),
      name: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
    })),
  };
}

/**
 * Get customer statistics
 */
async function getCustomerStats() {
  const client = await getClient();

  const customers = await withRetry(
    () =>
      client.call("res.partner", "search_read", [
        [["customer_rank", ">", 0]],
      ], {
        fields: ["id", "name", "email", "create_date"],
      }),
    "Fetch customers",
    { maxRetries: 2 }
  );

  return {
    totalCustomers: customers.length,
    newThisMonth: customers.filter(
      (c) => new Date(c.create_date).getMonth() === new Date().getMonth()
    ).length,
    timestamp: new Date(),
  };
}

/**
 * Get top cities
 */
async function getTopCities() {
  const client = await getClient();

  const orders = await withRetry(
    () =>
      client.call("sale.order", "search_read", [], {
        fields: ["partner_id"],
      }),
    "Fetch orders for cities",
    { maxRetries: 2 }
  );

  // Would need to fetch partner details for city info
  return {
    total: orders.length,
    // Aggregate by city when partner data available
  };
}

module.exports = {
  getTodayRevenue,
  getWeeklyRevenue,
  getMonthlyRevenue,
  getOrdersToday,
  getPendingOrders,
  getLowStockProducts,
  getInventoryValue,
  getBestSellingProducts,
  getCustomerStats,
  getTopCities,
};
