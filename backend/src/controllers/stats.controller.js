const Product = require("../models/Product");
const Order = require("../models/Order");
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

module.exports = {
  getPublicHomeStats,
};
