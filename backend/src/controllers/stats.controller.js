const Product = require("../models/Product");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const POSInvoice = require("../models/POSInvoice");

async function getPublicHomeStats(req, res, next) {
  try {
    const [productCount, dealers, categories, orderCount, posCount] = await Promise.all([
      Product.countDocuments({}),
      Product.distinct("dealerId"),
      Product.distinct("category"),
      Order.countDocuments({}),
      POSInvoice.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        products: productCount,
        dealers: dealers.filter(Boolean).length,
        categories: categories.filter(Boolean).length,
        orders: orderCount + posCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Unified Operations Analytics — combines Marketplace + POS data
 * Accessible to admin and superadmin roles.
 */
async function getUnifiedOperationsStats(req, res, next) {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const isSuperAdmin = req.auth?.role === "superadmin";
    const dealerId = req.auth?.sub;

    // Build filters based on role — each admin only sees their own data.
    // For POS, filter by products owned by this admin (not billedBy)
    // so admin sees revenue even if superadmin processed the sale.
    const orderFilter = isSuperAdmin ? {} : { "items.dealerId": dealerId };

    let posFilter = { status: { $ne: "cancelled" } };
    if (!isSuperAdmin) {
      const ownedProducts = await Product.find({ dealerId }).select("_id");
      const ownedProductIds = ownedProducts.map((p) => p._id);
      posFilter = { status: { $ne: "cancelled" }, "items.productId": { $in: ownedProductIds } };
    }

    // --- Marketplace Order Stats ---
    const [
      marketplaceTotalOrders,
      marketplaceTodayOrders,
      marketplaceWeekOrders,
      marketplaceMonthOrders,
      marketplaceRevenueAll,
      marketplaceRevenueToday,
      marketplaceRevenueWeek,
      marketplaceRevenueMonth,
      marketplaceStatusAgg,
      marketplaceRecentOrders,
      marketplaceTopProducts,
      marketplaceRevenueTrend,
    ] = await Promise.all([
      // Total orders
      Order.countDocuments(orderFilter),
      // Today's orders
      Order.countDocuments({ ...orderFilter, createdAt: { $gte: todayStart } }),
      // Week orders
      Order.countDocuments({ ...orderFilter, createdAt: { $gte: weekStart } }),
      // Month orders
      Order.countDocuments({ ...orderFilter, createdAt: { $gte: monthStart } }),
      // Total revenue
      Order.aggregate([
        { $match: { ...orderFilter, status: { $nin: ["Cancelled", "Returned", "Refunded", "Expired"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      // Today's revenue
      Order.aggregate([
        { $match: { ...orderFilter, createdAt: { $gte: todayStart }, status: { $nin: ["Cancelled", "Returned", "Refunded", "Expired"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      // Week revenue
      Order.aggregate([
        { $match: { ...orderFilter, createdAt: { $gte: weekStart }, status: { $nin: ["Cancelled", "Returned", "Refunded", "Expired"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      // Month revenue
      Order.aggregate([
        { $match: { ...orderFilter, createdAt: { $gte: monthStart }, status: { $nin: ["Cancelled", "Returned", "Refunded", "Expired"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      // Status breakdown
      Order.aggregate([
        ...(isSuperAdmin ? [] : [{ $match: { "items.dealerId": dealerId } }]),
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      // Recent orders (last 10)
      Order.find(orderFilter).sort({ createdAt: -1 }).limit(10).lean(),
      // Top selling products (marketplace)
      Order.aggregate([
        ...(isSuperAdmin ? [] : [{ $match: { "items.dealerId": dealerId } }]),
        { $unwind: "$items" },
        ...(isSuperAdmin ? [] : [{ $match: { "items.dealerId": dealerId } }]),
        { $group: { _id: "$items.name", totalQty: { $sum: "$items.quantity" }, totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]),
      // Revenue trend (last 7 days)
      Order.aggregate([
        { $match: { ...orderFilter, createdAt: { $gte: weekStart }, status: { $nin: ["Cancelled", "Returned", "Refunded", "Expired"] } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // --- POS Stats ---
    const [
      posTotalOrders,
      posTodayOrders,
      posWeekOrders,
      posMonthOrders,
      posRevenueAll,
      posRevenueToday,
      posRevenueWeek,
      posRevenueMonth,
      posRecentInvoices,
      posTopProducts,
      posRevenueTrend,
    ] = await Promise.all([
      // Total POS orders
      POSInvoice.countDocuments(posFilter),
      // Today's POS orders
      POSInvoice.countDocuments({ ...posFilter, createdAt: { $gte: todayStart } }),
      // Week POS orders
      POSInvoice.countDocuments({ ...posFilter, createdAt: { $gte: weekStart } }),
      // Month POS orders
      POSInvoice.countDocuments({ ...posFilter, createdAt: { $gte: monthStart } }),
      // Total POS revenue
      POSInvoice.aggregate([
        { $match: posFilter },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      // Today POS revenue
      POSInvoice.aggregate([
        { $match: { ...posFilter, createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      // Week POS revenue
      POSInvoice.aggregate([
        { $match: { ...posFilter, createdAt: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      // Month POS revenue
      POSInvoice.aggregate([
        { $match: { ...posFilter, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      // Recent POS invoices (last 10)
      POSInvoice.find(posFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("billedBy", "displayName")
        .lean(),
      // Top POS products
      POSInvoice.aggregate([
        { $match: { ...posFilter, createdAt: { $gte: monthStart } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.productName", totalQty: { $sum: "$items.quantity" }, totalRevenue: { $sum: "$items.lineTotal" } } },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]),
      // POS Revenue trend (last 7 days)
      POSInvoice.aggregate([
        { $match: { ...posFilter, createdAt: { $gte: weekStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // --- Combine Results ---
    const mktRevTotal = Number(marketplaceRevenueAll[0]?.total || 0);
    const mktRevToday = Number(marketplaceRevenueToday[0]?.total || 0);
    const mktRevWeek = Number(marketplaceRevenueWeek[0]?.total || 0);
    const mktRevMonth = Number(marketplaceRevenueMonth[0]?.total || 0);

    const posRevTotal = Number(posRevenueAll[0]?.total || 0);
    const posRevToday = Number(posRevenueToday[0]?.total || 0);
    const posRevWeek = Number(posRevenueWeek[0]?.total || 0);
    const posRevMonth = Number(posRevenueMonth[0]?.total || 0);

    const totalRevenue = mktRevTotal + posRevTotal;
    const todayRevenue = mktRevToday + posRevToday;
    const weekRevenue = mktRevWeek + posRevWeek;
    const monthRevenue = mktRevMonth + posRevMonth;

    const totalOrders = marketplaceTotalOrders + posTotalOrders;
    const todayOrders = marketplaceTodayOrders + posTodayOrders;
    const weekOrders = marketplaceWeekOrders + posWeekOrders;
    const monthOrders = marketplaceMonthOrders + posMonthOrders;

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Status breakdown from marketplace orders
    const statusBreakdown = {
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    for (const row of marketplaceStatusAgg) {
      if (row && typeof row._id === "string" && Object.prototype.hasOwnProperty.call(statusBreakdown, row._id)) {
        statusBreakdown[row._id] = Number(row.count || 0);
      }
    }

    // Merge top products from both sources
    const topProductsMap = new Map();
    for (const p of marketplaceTopProducts) {
      const existing = topProductsMap.get(p._id) || { name: p._id, totalQty: 0, totalRevenue: 0 };
      existing.totalQty += p.totalQty;
      existing.totalRevenue += p.totalRevenue;
      topProductsMap.set(p._id, existing);
    }
    for (const p of posTopProducts) {
      const existing = topProductsMap.get(p._id) || { name: p._id, totalQty: 0, totalRevenue: 0 };
      existing.totalQty += p.totalQty;
      existing.totalRevenue += p.totalRevenue;
      topProductsMap.set(p._id, existing);
    }
    const topSellingProducts = [...topProductsMap.values()]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 8);

    // Merge revenue trend
    const revenueTrendMap = new Map();
    for (const day of marketplaceRevenueTrend) {
      const existing = revenueTrendMap.get(day._id) || { date: day._id, marketplace: 0, pos: 0, totalRevenue: 0, marketplaceOrders: 0, posOrders: 0 };
      existing.marketplace += Number(day.revenue || 0);
      existing.totalRevenue += Number(day.revenue || 0);
      existing.marketplaceOrders += Number(day.orders || 0);
      revenueTrendMap.set(day._id, existing);
    }
    for (const day of posRevenueTrend) {
      const existing = revenueTrendMap.get(day._id) || { date: day._id, marketplace: 0, pos: 0, totalRevenue: 0, marketplaceOrders: 0, posOrders: 0 };
      existing.pos += Number(day.revenue || 0);
      existing.totalRevenue += Number(day.revenue || 0);
      existing.posOrders += Number(day.orders || 0);
      revenueTrendMap.set(day._id, existing);
    }
    const revenueTrend = [...revenueTrendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    // Format recent orders (combined, sorted by date)
    const normalizedMarketplaceOrders = marketplaceRecentOrders.map((order) => ({
      id: order._id.toString(),
      source: "marketplace",
      customer: order.userEmail || "Customer",
      total: Number(order.total || 0),
      status: order.status,
      paymentMethod: order.paymentMethod || "upi",
      paymentStatus: order.paymentStatus || "pending",
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      createdAt: order.createdAt,
    }));

    const normalizedPosOrders = posRecentInvoices.map((inv) => ({
      id: inv._id.toString(),
      source: "pos",
      customer: inv.customerName || "Walk-in Customer",
      total: Number(inv.totalAmount || 0),
      status: inv.status || "completed",
      paymentMethod: inv.paymentMethod || "cash",
      paymentStatus: inv.paymentStatus || "paid",
      itemCount: Array.isArray(inv.items) ? inv.items.length : 0,
      invoiceNumber: inv.invoiceNumber,
      createdAt: inv.createdAt,
    }));

    const recentOrders = [...normalizedMarketplaceOrders, ...normalizedPosOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 12);

    return res.status(200).json({
      success: true,
      unified: {
        revenue: {
          total: totalRevenue,
          today: todayRevenue,
          week: weekRevenue,
          month: monthRevenue,
          marketplace: mktRevTotal,
          pos: posRevTotal,
        },
        orders: {
          total: totalOrders,
          today: todayOrders,
          week: weekOrders,
          month: monthOrders,
          marketplace: marketplaceTotalOrders,
          pos: posTotalOrders,
        },
        averageOrderValue,
        statusBreakdown,
        posCompleted: posTotalOrders,
        topSellingProducts,
        recentOrders,
        revenueTrend,
        breakdown: {
          marketplace: {
            revenue: mktRevTotal,
            orders: marketplaceTotalOrders,
            todayRevenue: mktRevToday,
            todayOrders: marketplaceTodayOrders,
          },
          pos: {
            revenue: posRevTotal,
            orders: posTotalOrders,
            todayRevenue: posRevToday,
            todayOrders: posTodayOrders,
          },
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPublicHomeStats,
  getUnifiedOperationsStats,
};
