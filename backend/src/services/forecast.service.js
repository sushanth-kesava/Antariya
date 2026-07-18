const Order = require('../models/Order');
const Product = require('../models/Product');
const InventoryItem = require('../models/InventoryItem');

class ForecastService {

  /**
   * AI Demand Forecasting Dashboard
   * Uses historical order data to predict trends
   */
  static async getDashboard() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Revenue last 30 days vs previous 30 days (for trend)
    const [revenueThisMonth, revenuePrevMonth] = await Promise.all([
      Order.aggregate([{ $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }])
    ]);

    const currentRev = revenueThisMonth[0]?.total || 0;
    const prevRev = revenuePrevMonth[0]?.total || 0;
    const revGrowth = prevRev > 0 ? (((currentRev - prevRev) / prevRev) * 100).toFixed(1) : 0;

    // Top selling products (last 90 days)
    const topProducts = await Order.aggregate([
      { $match: { createdAt: { $gte: ninetyDaysAgo }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { totalQty: -1 } },
      { $limit: 10 }
    ]);

    // Populate product names
    const productIds = topProducts.map(p => p._id);
    const products = await Product.find({ _id: { $in: productIds } }).select('name sku category');
    const productMap = {};
    products.forEach(p => { productMap[p._id.toString()] = p; });

    const topSelling = topProducts.map(p => ({
      productId: p._id,
      name: productMap[p._id?.toString()]?.name || 'Unknown',
      sku: productMap[p._id?.toString()]?.sku || '',
      category: productMap[p._id?.toString()]?.category || '',
      totalQty: p.totalQty,
      totalRevenue: p.totalRevenue
    }));

    // Dead stock (products with no sales in 60+ days)
    const soldProductIds = await Order.aggregate([
      { $match: { createdAt: { $gte: sixtyDaysAgo } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId' } }
    ]);
    const soldSet = new Set(soldProductIds.map(s => s._id?.toString()));
    const allProducts = await Product.find({ published: true }).select('name sku stock');
    const deadStock = allProducts.filter(p => !soldSet.has(p._id.toString()) && p.stock > 0).slice(0, 10);

    // Low stock predictions (based on sales velocity)
    const salesVelocity = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', avgDailySales: { $sum: '$items.quantity' } } }
    ]);
    // Normalize to daily
    salesVelocity.forEach(sv => { sv.avgDailySales = sv.avgDailySales / 30; });

    const stockoutRisk = [];
    for (const sv of salesVelocity) {
      if (sv.avgDailySales <= 0) continue;
      const product = await Product.findById(sv._id).select('name sku stock');
      if (!product || product.stock <= 0) continue;
      const daysUntilStockout = Math.floor(product.stock / sv.avgDailySales);
      if (daysUntilStockout <= 30) {
        stockoutRisk.push({ productId: sv._id, name: product.name, sku: product.sku, currentStock: product.stock, dailySales: sv.avgDailySales.toFixed(1), daysUntilStockout, suggestedReorder: Math.ceil(sv.avgDailySales * 45) });
      }
    }
    stockoutRisk.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

    // Category performance
    const categoryPerformance = await Order.aggregate([
      { $match: { createdAt: { $gte: ninetyDaysAgo }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$product.category', totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, totalOrders: { $sum: 1 } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 8 }
    ]);

    // Monthly trend (6 months)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const monthlyTrend = await Order.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Revenue forecast (simple linear projection)
    const nextMonthForecast = currentRev * (1 + (Number(revGrowth) / 100));

    return {
      revenue: { current: currentRev, previous: prevRev, growth: Number(revGrowth), forecast: Math.round(nextMonthForecast) },
      orders: { current: revenueThisMonth[0]?.count || 0, previous: revenuePrevMonth[0]?.count || 0 },
      topSelling,
      deadStock: deadStock.map(p => ({ name: p.name, sku: p.sku, stock: p.stock })),
      stockoutRisk: stockoutRisk.slice(0, 10),
      categoryPerformance,
      monthlyTrend
    };
  }
}

module.exports = ForecastService;
