const Product = require("../models/Product");
const Order = require("../models/Order");

async function getPublicHomeStats(req, res, next) {
  try {
    const [productCount, dealers, categories, orderCount] = await Promise.all([
      Product.countDocuments({}),
      Product.distinct("dealerId"),
      Product.distinct("category"),
      Order.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        products: productCount,
        dealers: dealers.filter(Boolean).length,
        categories: categories.filter(Boolean).length,
        orders: orderCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPublicHomeStats,
};
