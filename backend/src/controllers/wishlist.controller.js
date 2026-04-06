const mongoose = require("mongoose");
const WishlistItem = require("../models/WishlistItem");

function normalizeWishlistItem(doc) {
  const product = doc.productId && typeof doc.productId === "object" ? doc.productId : null;
  const galleryImages = Array.isArray(product?.galleryImages) ? product.galleryImages : [];

  return {
    id: doc._id.toString(),
    productId: product?._id ? product._id.toString() : String(doc.productId),
    product: product
      ? {
          id: product._id.toString(),
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          dealerId: product.dealerId,
          image: product.image,
          galleryImages,
          stock: product.stock,
          fileDownloadLink: product.fileDownloadLink,
          rating: product.rating,
          customizable: product.customizable,
        }
      : null,
    createdAt: doc.createdAt,
  };
}

async function getWishlist(req, res, next) {
  try {
    const items = await WishlistItem.find({ userId: req.auth.sub })
      .populate("productId")
      .sort({ createdAt: -1 });

    const wishlist = items
      .map(normalizeWishlistItem)
      .filter((item) => Boolean(item.product));

    return res.status(200).json({
      success: true,
      wishlist,
    });
  } catch (error) {
    return next(error);
  }
}

async function setWishlistState(req, res, next) {
  try {
    const { productId } = req.params;
    const { saved } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const shouldSave = Boolean(saved);

    if (shouldSave) {
      const item = await WishlistItem.findOneAndUpdate(
        { userId: req.auth.sub, productId },
        { $setOnInsert: { userId: req.auth.sub, productId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate("productId");

      return res.status(200).json({
        success: true,
        saved: true,
        item: normalizeWishlistItem(item),
      });
    }

    await WishlistItem.deleteOne({ userId: req.auth.sub, productId });

    return res.status(200).json({
      success: true,
      saved: false,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getWishlist,
  setWishlistState,
};
