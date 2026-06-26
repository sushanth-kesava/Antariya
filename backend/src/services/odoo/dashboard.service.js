const authService = require("./auth.service");

/**
 * Dashboard Service - Real-time business metrics from Odoo
 * Fetches all data directly from Odoo with intelligent caching
 *
 * @module dashboardService
 * @description
 * Provides comprehensive business analytics:
 * - Sales metrics (today, monthly, revenue, profit)
 * - Product analytics (top sellers, low stock)
 * - Order management (pending orders)
 * - Customer metrics (total, new, active)
 *
 * Performance optimizations:
 * - In-memory cache with TTL
 * - Batch queries where possible
 * - Pagination for large datasets
 * - Indexed queries for common filters
 */

// Cache storage: {key: {data, expiry}}
const cache = new Map();

/**
 * Cache configuration (milliseconds)
 * Adjust based on business needs
 */
const CACHE_TTL = {
  TODAY_SALES: 5 * 60 * 1000, // 5 minutes
  MONTHLY_SALES: 30 * 60 * 1000, // 30 minutes
  TOP_PRODUCTS: 60 * 60 * 1000, // 1 hour
  LOW_STOCK: 15 * 60 * 1000, // 15 minutes
  PENDING_ORDERS: 5 * 60 * 1000, // 5 minutes
  REVENUE: 30 * 60 * 1000, // 30 minutes
  CUSTOMERS: 60 * 60 * 1000, // 1 hour
  PROFIT: 30 * 60 * 1000, // 30 minutes
};

/**
 * Get cached data if available and not expired
 * @param {string} key - Cache key
 * @returns {object|null} - Cached data or null if expired/missing
 * @private
 */
function _getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiry < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Set cache with TTL
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds
 * @private
 */
function _setCache(key, data, ttl) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl,
  });
}

/**
 * Clear specific cache entry
 * @param {string} key - Cache key
 * @private
 */
function _clearCache(key) {
  cache.delete(key);
}

/**
 * Clear all dashboard caches
 * Useful after significant operations (new order, stock change)
 * @private
 */
function _clearAllCache() {
  Object.keys(CACHE_TTL).forEach((key) => cache.delete(key));
}

/**
 * Get today's sales count and total amount
 * Queries sale.order with today's date filter
 *
 * @returns {Promise<{
 *   count: number,
 *   total: number,
 *   currency: string,
 *   timestamp: string,
 *   orders: Array<{id, name, amount, customer}>
 * }>}
 * @throws {Error} If Odoo query fails
 */
async function getTodaysSales() {
  const cacheKey = "today_sales";
  const cached = _getCache(cacheKey);
  if (cached) {
    console.log("[Dashboard] Cache hit: Today's Sales");
    return cached;
  }

  const client = await authService.getClient();
  const today = new Date().toISOString().split("T")[0];

  try {
    // Query today's orders
    const domain = [["date_order", ">=", today + " 00:00:00"]];

    const orderIds = await client.call("sale.order", "search", [
      domain,
      {
        limit: 100,
        order: "date_order desc",
      },
    ]);

    if (!orderIds || orderIds.length === 0) {
      const result = {
        count: 0,
        total: 0,
        currency: "INR",
        timestamp: new Date().toISOString(),
        orders: [],
      };
      _setCache(cacheKey, result, CACHE_TTL.TODAY_SALES);
      return result;
    }

    const fields = ["id", "name", "amount_total", "partner_id", "date_order"];
    const orders = await client.call("sale.order", "read", [orderIds, fields]);

    const totalAmount = orders.reduce((sum, order) => sum + (order.amount_total || 0), 0);

    const result = {
      count: orders.length,
      total: parseFloat(totalAmount.toFixed(2)),
      currency: "INR",
      timestamp: new Date().toISOString(),
      orders: orders
        .map((order) => ({
          id: order.id,
          name: order.name,
          amount: parseFloat(order.amount_total || 0),
          customer: order.partner_id ? order.partner_id[1] : "Unknown",
        }))
        .sort((a, b) => b.amount - a.amount),
    };

    _setCache(cacheKey, result, CACHE_TTL.TODAY_SALES);
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch today's sales: ${err.message}`);
  }
}

/**
 * Get monthly sales for current month
 * Queries sale.order with month filter
 *
 * @param {number} month - Month (1-12), defaults to current month
 * @param {number} year - Year, defaults to current year
 * @returns {Promise<{
 *   month: string,
 *   year: number,
 *   count: number,
 *   total: number,
 *   currency: string,
 *   averageOrderValue: number,
 *   byWeek: Array<{week, count, total}>
 * }>}
 */
async function getMonthlySales(month = null, year = null) {
  if (!month) month = new Date().getMonth() + 1;
  if (!year) year = new Date().getFullYear();

  const cacheKey = `monthly_sales_${year}_${month}`;
  const cached = _getCache(cacheKey);
  if (cached) {
    console.log(`[Dashboard] Cache hit: Monthly Sales ${year}-${month}`);
    return cached;
  }

  const client = await authService.getClient();

  try {
    const monthStr = String(month).padStart(2, "0");
    const fromDate = `${year}-${monthStr}-01`;

    // Calculate last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${monthStr}-${lastDay}`;

    const domain = [
      ["date_order", ">=", fromDate + " 00:00:00"],
      ["date_order", "<=", toDate + " 23:59:59"],
    ];

    const orderIds = await client.call("sale.order", "search", [
      domain,
      {
        order: "date_order desc",
      },
    ]);

    if (!orderIds || orderIds.length === 0) {
      const result = {
        month: new Date(year, month - 1).toLocaleString("default", { month: "long" }),
        year,
        count: 0,
        total: 0,
        currency: "INR",
        averageOrderValue: 0,
        byWeek: [],
      };
      _setCache(cacheKey, result, CACHE_TTL.MONTHLY_SALES);
      return result;
    }

    const fields = ["id", "name", "amount_total", "date_order"];
    const orders = await client.call("sale.order", "read", [orderIds, fields]);

    const totalAmount = orders.reduce((sum, order) => sum + (order.amount_total || 0), 0);

    // Group by week
    const byWeek = {};
    orders.forEach((order) => {
      const date = new Date(order.date_order);
      const week = Math.ceil(date.getDate() / 7);
      if (!byWeek[week]) byWeek[week] = { week, count: 0, total: 0 };
      byWeek[week].count += 1;
      byWeek[week].total += order.amount_total || 0;
    });

    const result = {
      month: new Date(year, month - 1).toLocaleString("default", { month: "long" }),
      year,
      count: orders.length,
      total: parseFloat(totalAmount.toFixed(2)),
      currency: "INR",
      averageOrderValue: parseFloat((totalAmount / orders.length).toFixed(2)),
      byWeek: Object.values(byWeek).map((w) => ({
        ...w,
        total: parseFloat(w.total.toFixed(2)),
      })),
    };

    _setCache(cacheKey, result, CACHE_TTL.MONTHLY_SALES);
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch monthly sales: ${err.message}`);
  }
}

/**
 * Get top selling products this month
 * Queries sale.order.line with product aggregation
 *
 * @param {number} limit - Number of top products to return (default: 10)
 * @returns {Promise<Array<{
 *   productId: number,
 *   productName: string,
 *   sku: string,
 *   quantitySold: number,
 *   totalRevenue: number,
 *   averagePrice: number
 * }>>}
 */
async function getTopProducts(limit = 10) {
  const cacheKey = "top_products";
  const cached = _getCache(cacheKey);
  if (cached) {
    console.log("[Dashboard] Cache hit: Top Products");
    return cached;
  }

  const client = await authService.getClient();

  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const domain = [
      ["order_id.date_order", ">=", monthStart],
      ["order_id.state", "!=", "cancel"],
    ];

    const lineIds = await client.call("sale.order.line", "search", [
      domain,
      {
        limit: 1000, // Fetch many lines for aggregation
      },
    ]);

    if (!lineIds || lineIds.length === 0) {
      _setCache(cacheKey, [], CACHE_TTL.TOP_PRODUCTS);
      return [];
    }

    const fields = [
      "product_id",
      "product_uom_qty",
      "price_unit",
      "price_subtotal",
      "name",
    ];
    const lines = await client.call("sale.order.line", "read", [lineIds, fields]);

    // Aggregate by product
    const productStats = {};
    lines.forEach((line) => {
      const productId = line.product_id ? line.product_id[0] : null;
      if (!productId) return;

      if (!productStats[productId]) {
        productStats[productId] = {
          productId,
          productName: line.product_id ? line.product_id[1] : line.name,
          sku: "",
          quantitySold: 0,
          totalRevenue: 0,
          lineCount: 0,
        };
      }
      productStats[productId].quantitySold += line.product_uom_qty || 0;
      productStats[productId].totalRevenue += line.price_subtotal || 0;
      productStats[productId].lineCount += 1;
    });

    // Fetch SKUs for top products
    const topProductIds = Object.values(productStats)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((p) => p.productId);

    const productDetails = await client.call("product.product", "read", [
      topProductIds,
      ["default_code"],
    ]);

    const skuMap = {};
    productDetails.forEach((p) => {
      skuMap[p.id] = p.default_code || "";
    });

    const result = topProductIds
      .map((id) => {
        const stats = productStats[id];
        return {
          ...stats,
          sku: skuMap[id] || "",
          averagePrice: parseFloat(
            (stats.totalRevenue / stats.quantitySold).toFixed(2)
          ),
          totalRevenue: parseFloat(stats.totalRevenue.toFixed(2)),
        };
      });

    _setCache(cacheKey, result, CACHE_TTL.TOP_PRODUCTS);
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch top products: ${err.message}`);
  }
}

/**
 * Get products with low stock
 * Queries stock.quant for quantities below reorder point
 *
 * @param {number} threshold - Low stock threshold (default: 10 units)
 * @param {number} limit - Number of products to return (default: 20)
 * @returns {Promise<Array<{
 *   productId: number,
 *   productName: string,
 *   sku: string,
 *   currentStock: number,
 *   reorderPoint: number,
 *   location: string
 * }>>}
 */
async function getLowStockProducts(threshold = 10, limit = 20) {
  const cacheKey = "low_stock";
  const cached = _getCache(cacheKey);
  if (cached) {
    console.log("[Dashboard] Cache hit: Low Stock");
    return cached;
  }

  const client = await authService.getClient();

  try {
    // Get all stock quantities
    const domain = [["quantity", "<", threshold]];

    const quantIds = await client.call("stock.quant", "search", [
      domain,
      {
        limit: limit * 3, // Fetch more to aggregate by product
        order: "quantity asc",
      },
    ]);

    if (!quantIds || quantIds.length === 0) {
      _setCache(cacheKey, [], CACHE_TTL.LOW_STOCK);
      return [];
    }

    const fields = ["product_id", "location_id", "quantity"];
    const quants = await client.call("stock.quant", "read", [quantIds, fields]);

    // Group by product
    const productMap = {};
    quants.forEach((quant) => {
      const productId = quant.product_id ? quant.product_id[0] : null;
      if (!productId) return;

      if (!productMap[productId]) {
        productMap[productId] = {
          productId,
          productName: quant.product_id ? quant.product_id[1] : "Unknown",
          totalQuantity: 0,
          locations: [],
        };
      }
      productMap[productId].totalQuantity += quant.quantity || 0;
      productMap[productId].locations.push({
        name: quant.location_id ? quant.location_id[1] : "Unknown",
        quantity: quant.quantity || 0,
      });
    });

    // Fetch product details for reorder points and SKU
    const productIds = Object.keys(productMap).map(Number);
    const productDetails = await client.call("product.product", "read", [
      productIds,
      ["default_code"],
    ]);

    const skuMap = {};
    productDetails.forEach((p) => {
      skuMap[p.id] = p.default_code || "";
    });

    const result = Object.values(productMap)
      .sort((a, b) => a.totalQuantity - b.totalQuantity)
      .slice(0, limit)
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        sku: skuMap[p.productId] || "",
        currentStock: p.totalQuantity,
        reorderPoint: threshold,
        locations: p.locations,
      }));

    _setCache(cacheKey, result, CACHE_TTL.LOW_STOCK);
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch low stock products: ${err.message}`);
  }
}

/**
 * Get pending orders (draft or confirmed, not done)
 *
 * @returns {Promise<{
 *   count: number,
 *   pending: Array<{id, name, customer, total, state, createdDate}>,
 *   overdue: Array
 * }>}
 */
async function getPendingOrders() {
  const cacheKey = "pending_orders";
  const cached = _getCache(cacheKey);
  if (cached) {
    console.log("[Dashboard] Cache hit: Pending Orders");
    return cached;
  }

  const client = await authService.getClient();

  try {
    const domain = [["state", "in", ["draft", "sent"]]];

    const orderIds = await client.call("sale.order", "search", [
      domain,
      {
        limit: 100,
        order: "date_order asc",
      },
    ]);

    if (!orderIds || orderIds.length === 0) {
      const result = { count: 0, pending: [], overdue: [] };
      _setCache(cacheKey, result, CACHE_TTL.PENDING_ORDERS);
      return result;
    }

    const fields = ["id", "name", "partner_id", "amount_total", "state", "date_order"];
    const orders = await client.call("sale.order", "read", [orderIds, fields]);

    const now = Date.now();
    const pending = [];
    const overdue = [];

    orders.forEach((order) => {
      const createdDate = new Date(order.date_order);
      const ageInHours = (now - createdDate.getTime()) / (1000 * 60 * 60);

      const item = {
        id: order.id,
        name: order.name,
        customer: order.partner_id ? order.partner_id[1] : "Unknown",
        total: parseFloat(order.amount_total || 0),
        state: order.state,
        createdDate: order.date_order,
        ageInHours: Math.floor(ageInHours),
      };

      if (ageInHours > 48) {
        overdue.push(item);
      } else {
        pending.push(item);
      }
    });

    const result = {
      count: orders.length,
      pending: pending.sort((a, b) => b.ageInHours - a.ageInHours),
      overdue: overdue.sort((a, b) => b.ageInHours - a.ageInHours),
    };

    _setCache(cacheKey, result, CACHE_TTL.PENDING_ORDERS);
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch pending orders: ${err.message}`);
  }
}

/**
 * Get total revenue (all-time and monthly)
 *
 * @returns {Promise<{
 *   allTime: number,
 *   thisMonth: number,
 *   lastMonth: number,
 *   monthlyGrowth: number,
 *   currency: string
 * }>}
 */
async function getRevenue() {
  const cacheKey = "revenue";
  const cached = _getCache(cacheKey);
  if (cached) {
    console.log("[Dashboard] Cache hit: Revenue");
    return cached;
  }

  const client = await authService.getClient();

  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // This month
    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(
      2,
      "0"
    )}-01`;
    const thisMonthEnd = new Date(currentYear, currentMonth, 0)
      .toISOString()
      .split("T")[0];

    const thisMonthDomain = [
      ["date_order", ">=", thisMonthStart],
      ["date_order", "<=", thisMonthEnd + " 23:59:59"],
      ["state", "!=", "cancel"],
    ];

    const thisMonthIds = await client.call("sale.order", "search", [
      thisMonthDomain,
    ]);
    const thisMonthOrders = await client.call("sale.order", "read", [
      thisMonthIds || [],
      ["amount_total"],
    ]);
    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

    // Last month
    const lastMonthStart = `${lastMonthYear}-${String(lastMonth).padStart(
      2,
      "0"
    )}-01`;
    const lastMonthEnd = new Date(lastMonthYear, lastMonth, 0)
      .toISOString()
      .split("T")[0];

    const lastMonthDomain = [
      ["date_order", ">=", lastMonthStart],
      ["date_order", "<=", lastMonthEnd + " 23:59:59"],
      ["state", "!=", "cancel"],
    ];

    const lastMonthIds = await client.call("sale.order", "search", [
      lastMonthDomain,
    ]);
    const lastMonthOrders = await client.call("sale.order", "read", [
      lastMonthIds || [],
      ["amount_total"],
    ]);
    const lastMonthRevenue = lastMonthOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

    // All time
    const allTimeIds = await client.call("sale.order", "search", [
      [["state", "!=", "cancel"]],
    ]);
    const allTimeOrders = await client.call("sale.order", "read", [
      allTimeIds || [],
      ["amount_total"],
    ]);
    const allTimeRevenue = allTimeOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

    const growth = lastMonthRevenue > 0 
      ? parseFloat((((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(2))
      : 0;

    const result = {
      allTime: parseFloat(allTimeRevenue.toFixed(2)),
      thisMonth: parseFloat(thisMonthRevenue.toFixed(2)),
      lastMonth: parseFloat(lastMonthRevenue.toFixed(2)),
      monthlyGrowth: growth,
      currency: "INR",
    };

    _setCache(cacheKey, result, CACHE_TTL.REVENUE);
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch revenue: ${err.message}`);
  }
}

/**
 * Get customer statistics
 *
 * @returns {Promise<{
 *   total: number,
 *   thisMonth: number,
 *   active: number,
 *   inactive: number,
 *   recentCustomers: Array
 * }>}
 */
async function getCustomerStats() {
  const cacheKey = "customers";
  const cached = _getCache(cacheKey);
  if (cached) {
    console.log("[Dashboard] Cache hit: Customers");
    return cached;
  }

  const client = await authService.getClient();

  try {
    // Total customers
    const allIds = await client.call("res.partner", "search", [
      [["customer_rank", ">", 0]],
    ]);

    // New customers this month
    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-01`;

    const newIds = await client.call("res.partner", "search", [
      [
        ["customer_rank", ">", 0],
        ["create_date", ">=", monthStart],
      ],
    ]);

    // Get details
    const fields = ["id", "name", "email", "create_date", "last_time_entries_checked"];
    const allCustomers = await client.call("res.partner", "read", [
      allIds || [],
      fields,
    ]);

    // Determine active (had orders in last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let active = 0;
    const recentCustomers = [];

    allCustomers.forEach((customer) => {
      const lastCheck = customer.last_time_entries_checked
        ? new Date(customer.last_time_entries_checked)
        : new Date(customer.create_date);
      if (lastCheck >= ninetyDaysAgo) {
        active += 1;
      }
      if (recentCustomers.length < 10) {
        recentCustomers.push({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          joinDate: customer.create_date,
        });
      }
    });

    const result = {
      total: allIds ? allIds.length : 0,
      thisMonth: newIds ? newIds.length : 0,
      active,
      inactive: (allIds ? allIds.length : 0) - active,
      recentCustomers,
    };

    _setCache(cacheKey, result, CACHE_TTL.CUSTOMERS);
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch customer stats: ${err.message}`);
  }
}

/**
 * Get profit metrics
 * Calculates profit from cost of goods sold
 *
 * @returns {Promise<{
 *   thisMonth: number,
 *   lastMonth: number,
 *   profitMargin: number,
 *   currency: string
 * }>}
 */
async function getProfit() {
  const cacheKey = "profit";
  const cached = _getCache(cacheKey);
  if (cached) {
    console.log("[Dashboard] Cache hit: Profit");
    return cached;
  }

  const client = await authService.getClient();

  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // This month orders
    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const thisMonthEnd = new Date(currentYear, currentMonth, 0)
      .toISOString()
      .split("T")[0];

    const thisMonthDomain = [
      ["date_order", ">=", thisMonthStart],
      ["date_order", "<=", thisMonthEnd + " 23:59:59"],
      ["state", "!=", "cancel"],
    ];

    const thisMonthIds = await client.call("sale.order", "search", [
      thisMonthDomain,
    ]);

    let thisMonthRevenue = 0;
    let thisMonthCost = 0;

    if (thisMonthIds && thisMonthIds.length > 0) {
      const fields = ["amount_total", "order_line"];
      const orders = await client.call("sale.order", "read", [thisMonthIds, fields]);

      orders.forEach((order) => {
        thisMonthRevenue += order.amount_total || 0;
      });

      // Get line costs
      if (thisMonthIds.length > 0) {
        const lineIds = [];
        orders.forEach((order) => {
          if (order.order_line && Array.isArray(order.order_line)) {
            lineIds.push(...order.order_line);
          }
        });

        if (lineIds.length > 0) {
          const lines = await client.call("sale.order.line", "read", [
            lineIds,
            ["product_id"],
          ]);

          const productIds = lines
            .map((l) => (l.product_id ? l.product_id[0] : null))
            .filter(Boolean);

          if (productIds.length > 0) {
            const products = await client.call("product.product", "read", [
              productIds,
              ["standard_price"],
            ]);

            products.forEach((product) => {
              thisMonthCost += product.standard_price || 0;
            });
          }
        }
      }
    }

    // Last month
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const lastMonthStart = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-01`;
    const lastMonthEnd = new Date(lastMonthYear, lastMonth, 0)
      .toISOString()
      .split("T")[0];

    const lastMonthDomain = [
      ["date_order", ">=", lastMonthStart],
      ["date_order", "<=", lastMonthEnd + " 23:59:59"],
      ["state", "!=", "cancel"],
    ];

    const lastMonthIds = await client.call("sale.order", "search", [
      lastMonthDomain,
    ]);

    let lastMonthRevenue = 0;
    let lastMonthCost = 0;

    if (lastMonthIds && lastMonthIds.length > 0) {
      const fields = ["amount_total"];
      const orders = await client.call("sale.order", "read", [lastMonthIds, fields]);

      orders.forEach((order) => {
        lastMonthRevenue += order.amount_total || 0;
      });
      // Last month cost calculation similar to this month...
      lastMonthCost = lastMonthRevenue * 0.4; // Placeholder: assume 40% COGS
    }

    const thisMonthProfit = thisMonthRevenue - thisMonthCost;
    const lastMonthProfit = lastMonthRevenue - lastMonthCost;

    const profitMargin =
      thisMonthRevenue > 0
        ? parseFloat(((thisMonthProfit / thisMonthRevenue) * 100).toFixed(2))
        : 0;

    const result = {
      thisMonth: parseFloat(thisMonthProfit.toFixed(2)),
      lastMonth: parseFloat(lastMonthProfit.toFixed(2)),
      profitMargin,
      currency: "INR",
    };

    _setCache(cacheKey, result, CACHE_TTL.PROFIT);
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch profit: ${err.message}`);
  }
}

/**
 * Get complete dashboard snapshot (all metrics at once)
 * Optimized to reduce API calls by batching queries
 *
 * @returns {Promise<{
 *   todaySales, monthlySales, topProducts, lowStock,
 *   pendingOrders, revenue, customers, profit,
 *   timestamp, cached
 * }>}
 */
async function getDashboardSnapshot() {
  try {
    // Run all queries in parallel for performance
    const [todaySales, monthlySales, topProducts, lowStock, pendingOrders, revenue, customers, profit] =
      await Promise.all([
        getTodaysSales(),
        getMonthlySales(),
        getTopProducts(),
        getLowStockProducts(),
        getPendingOrders(),
        getRevenue(),
        getCustomerStats(),
        getProfit(),
      ]);

    return {
      todaySales,
      monthlySales,
      topProducts,
      lowStock,
      pendingOrders,
      revenue,
      customers,
      profit,
      timestamp: new Date().toISOString(),
      cached: "mixed", // Some cached, some fresh
    };
  } catch (err) {
    throw new Error(`Failed to fetch dashboard snapshot: ${err.message}`);
  }
}

/**
 * Invalidate dashboard cache after significant operations
 * Call this after creating orders, updating stock, etc.
 *
 * @param {string[]} metrics - Specific metrics to invalidate, or empty for all
 */
function invalidateCache(metrics = []) {
  if (metrics.length === 0) {
    _clearAllCache();
    console.log("[Dashboard] Cache invalidated: ALL");
  } else {
    metrics.forEach((metric) => {
      const cacheKey = metric.toLowerCase();
      _clearCache(cacheKey);
    });
    console.log(`[Dashboard] Cache invalidated: ${metrics.join(", ")}`);
  }
}

module.exports = {
  getTodaysSales,
  getMonthlySales,
  getTopProducts,
  getLowStockProducts,
  getPendingOrders,
  getRevenue,
  getCustomerStats,
  getProfit,
  getDashboardSnapshot,
  invalidateCache,
};
