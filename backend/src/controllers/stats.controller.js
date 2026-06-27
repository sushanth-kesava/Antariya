const authService = require("../services/odoo/auth.service");
const productService = require("../services/odoo/product.service");

async function getPublicHomeStats(req, res, next) {
  try {
    const client = await authService.getClient();
    const [catalogSummary, orderCount] = await Promise.all([
      productService.getCatalogSummary(),
      client.call("sale.order", "search_count", [["state", "!=", "cancel"]]),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        products: catalogSummary.totalProducts,
        dealers: catalogSummary.totalDealers,
        categories: catalogSummary.totalCategories,
        orders: Number(orderCount || 0),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPublicHomeStats,
};
