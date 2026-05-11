const Product = require("../models/Product");
const Review = require("../models/Review");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const multer = require("multer");
const { hasCloudinaryCredentials, uploadProductImageBuffer } = require("../services/cloudinary.service");

const MAX_PRODUCT_IMAGES = 6;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MARKETPLACE_ROLE_CATEGORIES = {
  customer: ["Fashion Articles", "Dresses", "Hoodies", "Blouses", "Accessories"],
  admin: ["Threads", "Needles", "Spear Parts", "Accessories", "Machine Parts"],
};

const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_PRODUCT_IMAGES,
    fileSize: MAX_PRODUCT_IMAGE_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    if (typeof file.mimetype === "string" && file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }

    cb(new Error("Only image files are allowed"));
  },
}).array("images", MAX_PRODUCT_IMAGES);

function productImageUploadMiddleware(req, res, next) {
  productImageUpload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          success: false,
          message: `Each image must be smaller than ${Math.floor(MAX_PRODUCT_IMAGE_SIZE_BYTES / (1024 * 1024))}MB`,
        });
        return;
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        res.status(400).json({
          success: false,
          message: `You can upload up to ${MAX_PRODUCT_IMAGES} images only`,
        });
        return;
      }
    }

    res.status(400).json({
      success: false,
      message: error.message || "Invalid image upload",
    });
  });
}

function normalizeProduct(doc) {
  const productImages = Array.isArray(doc.images)
    ? doc.images.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  const legacyGalleryImages = Array.isArray(doc.galleryImages)
    ? doc.galleryImages.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  const galleryImages = [...productImages, ...legacyGalleryImages].filter(
    (item, index, array) => array.indexOf(item) === index
  );

  if (!galleryImages.includes(doc.image)) {
    galleryImages.unshift(doc.image);
  }

  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    price: doc.price,
    category: doc.category,
    dealerId: doc.dealerId,
    dealerName: doc.dealerName || "Unknown Admin",
    dealerEmail: doc.dealerEmail || null,
    image: doc.image,
    images: galleryImages,
    galleryImages,
    stock: doc.stock,
    fileDownloadLink: doc.fileDownloadLink,
    rating: doc.rating,
    customizable: doc.customizable,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeReview(doc) {
  return {
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    userId: doc.userId,
    userName: doc.userName,
    rating: doc.rating,
    title: doc.title,
    comment: doc.comment,
    verified: doc.verified,
    tags: doc.tags || [],
    moderationStatus: doc.moderationStatus || "approved",
    createdAt: doc.createdAt,
  };
}

function normalizeModerationReview(doc) {
  const product = doc.productId && typeof doc.productId === "object" ? doc.productId : null;

  return {
    id: doc._id.toString(),
    productId: product?._id ? product._id.toString() : doc.productId?.toString?.() || "",
    productName: product?.name || "Unknown product",
    productCategory: product?.category || null,
    userId: doc.userId,
    userEmail: doc.userEmail,
    userName: doc.userName,
    rating: doc.rating,
    title: doc.title,
    comment: doc.comment,
    verified: doc.verified,
    tags: doc.tags || [],
    moderationStatus: doc.moderationStatus || "approved",
    moderationNote: doc.moderationNote || null,
    moderatedBy: doc.moderatedBy || null,
    moderatedAt: doc.moderatedAt || null,
    createdAt: doc.createdAt,
  };
}

function bufferToDataUrl(file) {
  const mimeType = typeof file?.mimetype === "string" && file.mimetype.trim().length > 0 ? file.mimetype.trim() : "image/jpeg";
  const base64 = Buffer.from(file.buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function groupProductsByDealerAndCategory(products) {
  const dealerMap = new Map();

  for (const product of products) {
    const dealerId = product.dealerId || "unknown";
    const dealerName = product.dealerName || product.dealerEmail || product.dealerId || "Unknown Dealer";
    const categoryName = product.category || "Uncategorized";

    if (!dealerMap.has(dealerId)) {
      dealerMap.set(dealerId, {
        dealerId,
        dealerName,
        categories: new Map(),
      });
    }

    const dealerEntry = dealerMap.get(dealerId);
    if (!dealerEntry.categories.has(categoryName)) {
      dealerEntry.categories.set(categoryName, []);
    }

    dealerEntry.categories.get(categoryName).push(normalizeProduct(product));
  }

  return Array.from(dealerMap.values())
    .map((dealerEntry) => ({
      dealerId: dealerEntry.dealerId,
      dealerName: dealerEntry.dealerName,
      categories: Array.from(dealerEntry.categories.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, items]) => ({
          name,
          count: items.length,
          products: items,
        })),
    }))
    .sort((a, b) => a.dealerName.localeCompare(b.dealerName));
}

async function resolveModeratorNames(reviews) {
  const moderatorIds = Array.from(
    new Set(
      reviews
        .map((review) => (typeof review.moderatedBy === "string" ? review.moderatedBy.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );

  if (moderatorIds.length === 0) {
    return new Map();
  }

  const [admins, users] = await Promise.all([
    AdminProfile.find({ _id: { $in: moderatorIds } }).select("displayName"),
    User.find({ _id: { $in: moderatorIds } }).select("displayName"),
  ]);

  const names = new Map();

  for (const admin of admins) {
    names.set(admin._id.toString(), admin.displayName || "Admin");
  }

  for (const user of users) {
    if (!names.has(user._id.toString())) {
      names.set(user._id.toString(), user.displayName || "User");
    }
  }

  return names;
}

async function getDisplayNameForUser(userId, role) {
  if (role === "admin" || role === "superadmin") {
    const admin = await AdminProfile.findById(userId).select("displayName");
    return admin?.displayName || "Admin";
  }

  const user = await User.findById(userId).select("displayName");
  return user?.displayName || "Customer";
}

async function getScopedProductIdsForModerator(auth) {
  if (auth?.role === "superadmin") {
    return null;
  }

  const ownedProducts = await Product.find({ dealerId: auth.sub }).select("_id");
  return ownedProducts.map((product) => product._id);
}

async function syncProductRating(productId) {
  const stats = await Review.aggregate([
    {
      $match: {
        productId: productId,
        $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }],
      },
    },
    {
      $group: {
        _id: "$productId",
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  const average = stats[0]?.avgRating;
  const rounded = typeof average === "number" ? Math.round(average * 10) / 10 : 0;

  await Product.findByIdAndUpdate(productId, { rating: rounded });
}

async function getProducts(req, res, next) {
  try {
    const { category, search, dealerId, customizable, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (dealerId) {
      filter.dealerId = dealerId;
    }

    if (typeof customizable !== "undefined") {
      filter.customizable = customizable === "true";
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      products: products.map(normalizeProduct),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getMarketplaceLayout(req, res, next) {
  try {
    const role = String(req.query.role || "customer").trim().toLowerCase();

    if (role === "superadmin") {
      const products = await Product.find({}).sort({ createdAt: -1 });
      const dealerSections = groupProductsByDealerAndCategory(products);

      return res.status(200).json({
        success: true,
        role: "superadmin",
        dealerSections,
      });
    }

    const availableCategories = (await Product.distinct("category")).filter(
      (category) => typeof category === "string" && category.trim().length > 0
    );
    const availableSet = new Set(availableCategories.map((category) => category.trim()));
    const preferredCategories = MARKETPLACE_ROLE_CATEGORIES[role] || MARKETPLACE_ROLE_CATEGORIES.customer;
    const categories = preferredCategories.filter((category) => availableSet.has(category));

    return res.status(200).json({
      success: true,
      role: role === "admin" ? "admin" : "customer",
      categories: categories.length > 0 ? categories : availableCategories.sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    return next(error);
  }
}

async function getProductById(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product: normalizeProduct(product),
    });
  } catch (error) {
    return next(error);
  }
}

async function uploadProductImages(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can upload product images",
      });
    }

    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image",
      });
    }

    let imageUrls = [];

    if (hasCloudinaryCredentials) {
      try {
        const uploaded = await Promise.all(
          files.map((file) =>
            uploadProductImageBuffer(file.buffer, {
              folder: `antariya/products/${req.auth.sub}`,
            })
          )
        );

        imageUrls = uploaded
          .map((item) => item?.secure_url)
          .filter((value) => typeof value === "string" && value.trim().length > 0);
      } catch (uploadError) {
        console.warn("Cloudinary upload failed, falling back to inline image data:", uploadError.message);
        imageUrls = files.map(bufferToDataUrl);
      }
    } else {
      imageUrls = files.map(bufferToDataUrl);
    }

    if (imageUrls.length === 0) {
      return res.status(500).json({
        success: false,
        message: "No images were uploaded",
      });
    }

    return res.status(201).json({
      success: true,
      message: hasCloudinaryCredentials ? "Images uploaded" : "Images stored locally for this request",
      images: imageUrls,
    });
  } catch (error) {
    return next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can create products",
      });
    }

    const { name, description, price, category, image, images, galleryImages, stock, rating, customizable, fileDownloadLink } = req.body;

    const normalizedGallery = (Array.isArray(images) ? images : Array.isArray(galleryImages) ? galleryImages : [image])
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MAX_PRODUCT_IMAGES);

    if (!name || !description || typeof price === "undefined" || !category || normalizedGallery.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required product fields",
      });
    }

    const creatorProfile = await AdminProfile.findById(req.auth.sub).select("displayName email");
    const fallbackName = String(req.auth.email || "admin").split("@")[0];
    const dealerName = creatorProfile?.displayName || fallbackName;
    const dealerEmail = String(creatorProfile?.email || req.auth.email || "").trim().toLowerCase();

    if (!dealerEmail) {
      return res.status(400).json({
        success: false,
        message: "Admin email is required to create products",
      });
    }

    const primaryImage = normalizedGallery[0];

    const product = await Product.create({
      name,
      description,
      price: Number(price),
      category,
      dealerName,
      dealerEmail,
      image: primaryImage,
      images: normalizedGallery,
      galleryImages: normalizedGallery,
      stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
      rating: Number.isFinite(Number(rating)) ? Number(rating) : 0,
      customizable: Boolean(customizable),
      fileDownloadLink: fileDownloadLink || null,
      dealerId: req.auth.sub,
    });

    return res.status(201).json({
      success: true,
      message: "Product created",
      product: normalizeProduct(product),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can delete products",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.dealerId !== req.auth.sub) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own products",
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Product deleted",
    });
  } catch (error) {
    return next(error);
  }
}

async function getProductReviews(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).select("_id");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const reviews = await Review.find({
      productId: product._id,
      $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }],
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      reviews: reviews.map(normalizeReview),
    });
  } catch (error) {
    return next(error);
  }
}

async function createProductReview(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const { rating, title, comment, tags } = req.body;
    const numericRating = Number(rating);

    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    if (!title || !comment) {
      return res.status(400).json({
        success: false,
        message: "Title and comment are required",
      });
    }

    const normalizedTags = Array.isArray(tags)
      ? tags
          .filter((tag) => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
          .slice(0, 5)
      : [];

    const displayName = await getDisplayNameForUser(req.auth.sub, req.auth.role);

    const review = await Review.findOneAndUpdate(
      { productId: product._id, userId: req.auth.sub },
      {
        $set: {
          userEmail: req.auth.email,
          userName: displayName,
          rating: numericRating,
          title: String(title).trim(),
          comment: String(comment).trim(),
          verified: true,
          tags: normalizedTags,
          moderationStatus: "approved",
          moderationNote: null,
          moderatedBy: null,
          moderatedAt: null,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    await syncProductRating(product._id);

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review: normalizeReview(review),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Review already exists for this user and product",
      });
    }

    return next(error);
  }
}

async function getReviewModerationQueue(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access review moderation",
      });
    }

    const { status, search } = req.query;
    const filter = {};
    const scopedProductIds = await getScopedProductIdsForModerator(req.auth);

    if (Array.isArray(scopedProductIds)) {
      if (scopedProductIds.length === 0) {
        return res.status(200).json({
          success: true,
          reviews: [],
        });
      }

      filter.productId = { $in: scopedProductIds };
    }

    if (status && ["approved", "hidden", "flagged", "pending"].includes(String(status))) {
      filter.moderationStatus = String(status);
    }

    if (search) {
      const searchRegex = { $regex: String(search), $options: "i" };
      filter.$or = [{ title: searchRegex }, { comment: searchRegex }, { userName: searchRegex }, { userEmail: searchRegex }];
    }

    const reviews = await Review.find(filter)
      .populate("productId", "name category")
      .sort({ createdAt: -1 })
      .limit(200);

    return res.status(200).json({
      success: true,
      reviews: reviews.map(normalizeModerationReview),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateReviewModeration(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can moderate reviews",
      });
    }

    const { reviewId } = req.params;
    const { moderationStatus, moderationNote } = req.body;

    if (!["approved", "hidden", "flagged", "pending"].includes(String(moderationStatus))) {
      return res.status(400).json({
        success: false,
        message: "Invalid moderation status",
      });
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (req.auth?.role !== "superadmin") {
      const product = await Product.findById(review.productId).select("dealerId");

      if (!product || product.dealerId !== req.auth.sub) {
        return res.status(403).json({
          success: false,
          message: "You can only moderate reviews for your own products",
        });
      }
    }

    review.moderationStatus = String(moderationStatus);
    review.moderationNote = typeof moderationNote === "string" ? moderationNote.trim().slice(0, 300) : null;
    review.moderatedBy = req.auth.sub;
    review.moderatedAt = new Date();
    await review.save();

    await syncProductRating(review.productId);

    const withProduct = await Review.findById(review._id).populate("productId", "name category");

    return res.status(200).json({
      success: true,
      message: "Review moderation updated",
      review: normalizeModerationReview(withProduct),
    });
  } catch (error) {
    return next(error);
  }
}

async function getReviewModerationActivity(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access moderation activity",
      });
    }

    const limitValue = Number.parseInt(String(req.query.limit || "50"), 10);
    const safeLimit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 200) : 50;
    const scopedProductIds = await getScopedProductIdsForModerator(req.auth);
    const activityFilter = { moderatedAt: { $ne: null } };

    if (Array.isArray(scopedProductIds)) {
      if (scopedProductIds.length === 0) {
        return res.status(200).json({
          success: true,
          activity: [],
        });
      }

      activityFilter.productId = { $in: scopedProductIds };
    }

    const reviews = await Review.find(activityFilter)
      .populate("productId", "name category")
      .sort({ moderatedAt: -1 })
      .limit(safeLimit);

    const moderatorNames = await resolveModeratorNames(reviews);

    const activity = reviews.map((review) => ({
      ...normalizeModerationReview(review),
      moderatorName: review.moderatedBy ? moderatorNames.get(review.moderatedBy) || "Unknown moderator" : "Unknown moderator",
    }));

    return res.status(200).json({
      success: true,
      activity,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getProducts,
  getMarketplaceLayout,
  getProductById,
  uploadProductImages,
  productImageUploadMiddleware,
  createProduct,
  deleteProduct,
  getProductReviews,
  createProductReview,
  getReviewModerationQueue,
  updateReviewModeration,
  getReviewModerationActivity,
};
