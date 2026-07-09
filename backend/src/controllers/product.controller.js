const mongoose = require("mongoose");
const Product = require("../models/Product");
const Review = require("../models/Review");
const User = require("../models/User");
const Order = require("../models/Order");
const AdminProfile = require("../models/AdminProfile");
const StockAdjustment = require("../models/StockAdjustment");
const multer = require("multer");
const { hasCloudinaryCredentials, uploadProductImageBuffer } = require("../services/cloudinary.service");

const MAX_PRODUCT_IMAGES = 6;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;
// Curated Antariya storefront categories (order defines the marketplace bar order).
const ANTARIYA_CATEGORIES = [
    "Oversized T-Shirts",
    "Regular Fit T-Shirts",
    "Premium Cotton T-Shirts",
    "Graphic Printed",
    "Minimal Collection",
    "Motorsport Collection",
    "Anime Collection",
    "Streetwear Collection",
    "Signature Collection",
    "Limited Edition",
    "Essentials",
    "Full Sleeve T-Shirts",
    "Polo T-Shirts",
    "Sleeveless T-Shirts",
];

const MARKETPLACE_ROLE_CATEGORIES = {
  customer: ANTARIYA_CATEGORIES,
  admin: ANTARIYA_CATEGORIES,
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
    subCategory: doc.subCategory || "",
    size: doc.size || "",
    color: doc.color || "",
    gender: doc.gender || "",
    neckType: doc.neckType || "",
    pattern: doc.pattern || "",
    sizes: Array.isArray(doc.sizes) ? doc.sizes : [],
    colors: Array.isArray(doc.colors) ? doc.colors : [],
    genders: Array.isArray(doc.genders) ? doc.genders : [],
    neckTypes: Array.isArray(doc.neckTypes) ? doc.neckTypes : [],
    patterns: Array.isArray(doc.patterns) ? doc.patterns : [],
    reorderPoint: Number(doc.reorderPoint) || 0,
    variants: Array.isArray(doc.variants)
      ? doc.variants.map((variant) => ({
          sku: variant.sku || "",
          size: variant.size || "",
          color: variant.color || "",
          gender: variant.gender || "",
          neckType: variant.neckType || "",
          pattern: variant.pattern || "",
          price: Number.isFinite(Number(variant.price)) ? Number(variant.price) : 0,
          stock: Number.isFinite(Number(variant.stock)) ? Number(variant.stock) : 0,
          reorderPoint: Number.isFinite(Number(variant.reorderPoint)) ? Number(variant.reorderPoint) : 0,
        }))
      : [],
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

function normalizeReviewImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

function buildReviewSummary(reviews) {
  const summary = {
    reviewCount: 0,
    averageRating: 0,
    ratingBreakdown: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
    reviewImageCount: 0,
  };

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return summary;
  }

  let ratingTotal = 0;

  for (const review of reviews) {
    const rating = Number(review?.rating || 0);

    if (rating >= 1 && rating <= 5) {
      summary.ratingBreakdown[rating] += 1;
      ratingTotal += rating;
    }

    summary.reviewImageCount += normalizeReviewImages(review?.images).length;
  }

  summary.reviewCount = reviews.length;
  summary.averageRating = Math.round((ratingTotal / reviews.length) * 10) / 10;

  return summary;
}

function createEmptyReviewSummary() {
  return {
    reviewCount: 0,
    averageRating: 0,
    ratingBreakdown: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
    reviewImageCount: 0,
  };
}

function updateReviewSummary(summary, review) {
  const rating = Number(review?.rating || 0);

  if (rating >= 1 && rating <= 5) {
    summary.ratingBreakdown[rating] += 1;
    summary._ratingTotal += rating;
  }

  summary.reviewCount += 1;
  summary.reviewImageCount += normalizeReviewImages(review?.images).length;
}

function finalizeReviewSummary(summary) {
  summary.averageRating = summary.reviewCount > 0 ? Math.round((summary._ratingTotal / summary.reviewCount) * 10) / 10 : 0;
  delete summary._ratingTotal;
  return summary;
}

function buildReviewSummaryMap(reviews) {
  const summaryMap = new Map();

  for (const review of Array.isArray(reviews) ? reviews : []) {
    const productId = review?.productId?.toString?.() || "";

    if (!productId) {
      continue;
    }

    if (!summaryMap.has(productId)) {
      summaryMap.set(productId, { ...createEmptyReviewSummary(), _ratingTotal: 0 });
    }

    updateReviewSummary(summaryMap.get(productId), review);
  }

  for (const summary of summaryMap.values()) {
    finalizeReviewSummary(summary);
  }

  return summaryMap;
}

async function getProductReviewSummary(productId) {
  const summaryMap = await getProductReviewSummariesByProductIds([productId]);
  return summaryMap.get(productId.toString()) || createEmptyReviewSummary();
}

async function getProductReviewSummariesByProductIds(productIds) {
  const normalizedIds = Array.isArray(productIds)
    ? productIds.map((productId) => productId?.toString?.()).filter((productId) => typeof productId === "string" && productId.length > 0)
    : [];

  if (normalizedIds.length === 0) {
    return new Map();
  }

  const reviews = await Review.find({
    productId: { $in: normalizedIds },
    $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }],
  }).select("productId rating images");

  return buildReviewSummaryMap(reviews);
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
    images: normalizeReviewImages(doc.images),
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
    images: normalizeReviewImages(doc.images),
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

async function getReviewEligibilityState(productId, userId) {
  const [hasDeliveredOrder, existingReview] = await Promise.all([
    Order.exists({
      userId,
      status: "Delivered",
      items: {
        $elemMatch: {
          productId,
        },
      },
    }),
    Review.findOne({ productId, userId }).select("_id rating title comment images createdAt"),
  ]);

  return {
    canReview: Boolean(hasDeliveredOrder),
    hasDeliveredOrder: Boolean(hasDeliveredOrder),
    hasReviewed: Boolean(existingReview),
    existingReview: existingReview ? normalizeReview(existingReview) : null,
  };
}

async function getProducts(req, res, next) {
  try {
    const { category, subCategory, size, color, gender, neckType, pattern, search, dealerId, customizable, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (subCategory) {
      filter.subCategory = subCategory;
    }

    if (size) {
      filter.size = size;
    }

    if (color) {
      filter.color = color;
    }

    if (gender) {
      filter.gender = gender;
    }

    if (neckType) {
      filter.neckType = neckType;
    }

    if (pattern) {
      filter.pattern = pattern;
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

    const reviewSummaryMap = await getProductReviewSummariesByProductIds(products.map((product) => product._id));

    return res.status(200).json({
      success: true,
      products: products.map((product) => {
        const reviewSummary = reviewSummaryMap.get(product._id.toString()) || createEmptyReviewSummary();

        return {
          ...normalizeProduct(product),
          reviewCount: reviewSummary.reviewCount,
          reviewAverage: reviewSummary.averageRating,
          reviewBreakdown: reviewSummary.ratingBreakdown,
          reviewImageCount: reviewSummary.reviewImageCount,
        };
      }),
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

    const reviewSummary = await getProductReviewSummary(product._id);

    return res.status(200).json({
      success: true,
      product: {
        ...normalizeProduct(product),
        reviewCount: reviewSummary.reviewCount,
        reviewAverage: reviewSummary.averageRating,
        reviewBreakdown: reviewSummary.ratingBreakdown,
        reviewImageCount: reviewSummary.reviewImageCount,
      },
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

    const { name, description, price, category, subCategory, size, color, gender, neckType, pattern, sizes, colors, genders, neckTypes, patterns, variants, image, images, galleryImages, stock, rating, customizable, fileDownloadLink } = req.body;

    const normalizedGallery = (Array.isArray(images) ? images : Array.isArray(galleryImages) ? galleryImages : [image])
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MAX_PRODUCT_IMAGES);

    if (!name || !description || typeof price === "undefined" || normalizedGallery.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required product fields",
      });
    }

    const cleanStringArray = (value) =>
      Array.isArray(value)
        ? Array.from(
            new Set(
              value
                .map((item) => String(item || "").trim())
                .filter((item) => item.length > 0)
            )
          )
        : [];

    const normalizedVariants = Array.isArray(variants)
      ? variants
          .map((variant) => ({
            sku: String(variant?.sku || "").trim(),
            size: String(variant?.size || "").trim(),
            color: String(variant?.color || "").trim(),
            gender: String(variant?.gender || "").trim(),
            neckType: String(variant?.neckType || "").trim(),
            pattern: String(variant?.pattern || "").trim(),
            price: Number.isFinite(Number(variant?.price)) ? Math.max(0, Number(variant.price)) : 0,
            stock: Number.isFinite(Number(variant?.stock)) ? Math.max(0, Number(variant.stock)) : 0,
          }))
          .slice(0, 500)
      : [];

    const variantStockTotal = normalizedVariants.reduce((sum, variant) => sum + variant.stock, 0);
    const resolvedStock = normalizedVariants.length > 0
      ? variantStockTotal
      : (Number.isFinite(Number(stock)) ? Number(stock) : 0);

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
      category: category || "",
      subCategory: subCategory || "",
      size: size || "",
      color: color || "",
      gender: gender || "",
      neckType: neckType || "",
      pattern: pattern || "",
      sizes: cleanStringArray(sizes),
      colors: cleanStringArray(colors),
      genders: cleanStringArray(genders),
      neckTypes: cleanStringArray(neckTypes),
      patterns: cleanStringArray(patterns),
      variants: normalizedVariants,
      dealerName,
      dealerEmail,
      image: primaryImage,
      images: normalizedGallery,
      galleryImages: normalizedGallery,
      stock: resolvedStock,
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

    const summary = buildReviewSummary(reviews);

    return res.status(200).json({
      success: true,
      reviews: reviews.map(normalizeReview),
      summary,
    });
  } catch (error) {
    return next(error);
  }
}

async function getReviewEligibility(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).select("_id name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const eligibility = await getReviewEligibilityState(product._id, req.auth.sub);

    return res.status(200).json({
      success: true,
      productId: product._id.toString(),
      productName: product.name,
      ...eligibility,
      message: eligibility.canReview
        ? eligibility.hasReviewed
          ? "You can update your delivered-product review."
          : "You can review this delivered product."
        : "Reviews are available after your order is delivered.",
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

    const eligibility = await getReviewEligibilityState(product._id, req.auth.sub);

    if (!eligibility.canReview) {
      return res.status(403).json({
        success: false,
        message: "Only customers who received this product can submit a review",
      });
    }

    const { rating, title, comment, tags, images } = req.body;
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

    if (Array.isArray(images) && images.length > 4) {
      return res.status(400).json({
        success: false,
        message: "You can attach up to 4 review images",
      });
    }

    const normalizedImages = normalizeReviewImages(images);

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
          images: normalizedImages,
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

async function getInventoryReport(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const isSuperAdmin = req.auth?.role === "superadmin";
    const scopeFilter = isSuperAdmin ? {} : { dealerId: req.auth.sub };
    const products = await Product.find(scopeFilter).sort({ createdAt: -1 });

    const LOW_STOCK_DEFAULT = 10;

    let totalUnits = 0;
    let totalValue = 0;
    let variantCount = 0;
    const lowStock = [];
    const outOfStock = [];

    for (const product of products) {
      const price = Number(product.price) || 0;
      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      if (hasVariants) {
        for (const variant of product.variants) {
          variantCount += 1;
          const vStock = Number(variant.stock) || 0;
          const vPrice = Number(variant.price) > 0 ? Number(variant.price) : price;
          totalUnits += vStock;
          totalValue += vStock * vPrice;

          const threshold = Number(variant.reorderPoint) > 0
            ? Number(variant.reorderPoint)
            : (Number(product.reorderPoint) > 0 ? Number(product.reorderPoint) : LOW_STOCK_DEFAULT);

          const label = [variant.size, variant.color, variant.gender, variant.neckType, variant.pattern]
            .filter(Boolean)
            .join(" · ");

          const entry = {
            productId: product._id.toString(),
            name: product.name,
            sku: variant.sku || "",
            variantLabel: label,
            stock: vStock,
            reorderPoint: threshold,
            image: product.image,
          };

          if (vStock <= 0) {
            outOfStock.push(entry);
          } else if (vStock <= threshold) {
            lowStock.push(entry);
          }
        }
      } else {
        const stock = Number(product.stock) || 0;
        const threshold = Number(product.reorderPoint) > 0 ? Number(product.reorderPoint) : LOW_STOCK_DEFAULT;
        totalUnits += stock;
        totalValue += stock * price;

        const entry = {
          productId: product._id.toString(),
          name: product.name,
          sku: "",
          variantLabel: "",
          stock,
          reorderPoint: threshold,
          image: product.image,
        };

        if (stock <= 0) {
          outOfStock.push(entry);
        } else if (stock <= threshold) {
          lowStock.push(entry);
        }
      }
    }

    lowStock.sort((a, b) => a.stock - b.stock);

    return res.status(200).json({
      success: true,
      summary: {
        totalProducts: products.length,
        totalVariants: variantCount,
        totalUnits,
        totalValue,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
      },
      lowStock: lowStock.slice(0, 50),
      outOfStock: outOfStock.slice(0, 50),
    });
  } catch (error) {
    return next(error);
  }
}

async function canManageProduct(req, product) {
  if (!product) return false;
  if (req.auth?.role === "superadmin") return true;
  if (product.dealerId === req.auth?.sub) return true;
  // Allow an admin to claim an "orphaned" product — one whose dealerId is not a
  // real existing admin id (e.g. seed/imported products with placeholder owners
  // like "antariyaofficial"). This keeps stock management live without a manual
  // data migration.
  return isOrphanedDealerId(product.dealerId);
}

// A dealerId is considered orphaned when it is not a valid ObjectId of an
// existing AdminProfile. Such products cannot be managed by their "owner"
// because no such owner exists.
async function isOrphanedDealerId(dealerId) {
  if (!mongoose.Types.ObjectId.isValid(dealerId)) return true;
  const owner = await AdminProfile.findById(dealerId).select("_id");
  return !owner;
}

async function adjustStock(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { productId } = req.params;
    const { type = "add", quantity, variantSku = "", reason = "" } = req.body;

    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity)) {
      return res.status(400).json({ success: false, message: "Quantity must be a number" });
    }

    // Guard against malformed ids so Mongoose does not throw a CastError (500).
    // A malformed id can only mean the client sent a stale/invalid product ref.
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (!(await canManageProduct(req, product))) {
      return res.status(403).json({ success: false, message: "You can only adjust your own products" });
    }

    // Self-heal: if this product was orphaned (placeholder/seed owner) and a
    // non-superadmin admin is adjusting it, claim it for them so it appears in
    // their scoped catalog and stays adjustable going forward.
    if (req.auth?.role === "admin" && product.dealerId !== req.auth?.sub) {
      if (await isOrphanedDealerId(product.dealerId)) {
        const claimer = await AdminProfile.findById(req.auth.sub).select("displayName email");
        product.dealerId = req.auth.sub;
        if (claimer) {
          product.dealerName = claimer.displayName || product.dealerName;
          product.dealerEmail = (claimer.email || product.dealerEmail || "").toLowerCase();
        }
      }
    }

    const applyDelta = (current) => {
      const value = Number(current) || 0;
      if (type === "set") return Math.max(0, numericQuantity);
      if (type === "remove") return Math.max(0, value - Math.abs(numericQuantity));
      return Math.max(0, value + Math.abs(numericQuantity)); // add
    };

    let previousStock;
    let newStock;

    if (variantSku && Array.isArray(product.variants) && product.variants.length > 0) {
      const variant = product.variants.find((entry) => entry.sku === variantSku);
      if (!variant) {
        return res.status(404).json({ success: false, message: "Variant not found" });
      }
      previousStock = Number(variant.stock) || 0;
      newStock = applyDelta(previousStock);
      variant.stock = newStock;
      // Roll product-level stock to the sum of variants.
      product.stock = product.variants.reduce((sum, entry) => sum + (Number(entry.stock) || 0), 0);
    } else {
      previousStock = Number(product.stock) || 0;
      newStock = applyDelta(previousStock);
      product.stock = newStock;
    }

    await product.save();

    const appliedDelta = newStock - previousStock;
    const log = await StockAdjustment.create({
      productId: product._id,
      productName: product.name,
      variantSku,
      type,
      quantity: appliedDelta,
      previousStock,
      newStock,
      reason: String(reason || "").trim(),
      performedByUserId: req.auth?.sub || "",
      performedByEmail: req.auth?.email || "",
    });

    return res.status(200).json({
      success: true,
      message: "Stock adjusted",
      adjustment: {
        id: log._id.toString(),
        productId: product._id.toString(),
        productName: product.name,
        variantSku,
        type,
        quantity: appliedDelta,
        previousStock,
        newStock,
        reason: log.reason,
        performedByEmail: log.performedByEmail,
        createdAt: log.createdAt,
      },
      product: normalizeProduct(product),
    });
  } catch (error) {
    return next(error);
  }
}

async function getStockHistory(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const isSuperAdmin = req.auth?.role === "superadmin";
    let productFilter = {};
    if (!isSuperAdmin) {
      const owned = await Product.find({ dealerId: req.auth.sub }).select("_id");
      productFilter = { productId: { $in: owned.map((p) => p._id) } };
    }
    if (req.query.productId) {
      productFilter = { productId: req.query.productId };
    }

    const history = await StockAdjustment.find(productFilter).sort({ createdAt: -1 }).limit(100);

    return res.status(200).json({
      success: true,
      history: history.map((entry) => ({
        id: entry._id.toString(),
        productId: entry.productId.toString(),
        productName: entry.productName,
        variantSku: entry.variantSku || "",
        type: entry.type,
        quantity: entry.quantity,
        previousStock: entry.previousStock,
        newStock: entry.newStock,
        reason: entry.reason || "",
        performedByEmail: entry.performedByEmail || "",
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateInventorySettings(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { productId } = req.params;
    const { reorderPoint, variantReorderPoints } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (!(await canManageProduct(req, product))) {
      return res.status(403).json({ success: false, message: "You can only update your own products" });
    }

    if (Number.isFinite(Number(reorderPoint))) {
      product.reorderPoint = Math.max(0, Number(reorderPoint));
    }

    if (variantReorderPoints && typeof variantReorderPoints === "object" && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (variant.sku && Number.isFinite(Number(variantReorderPoints[variant.sku]))) {
          variant.reorderPoint = Math.max(0, Number(variantReorderPoints[variant.sku]));
        }
      }
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Inventory settings updated",
      product: normalizeProduct(product),
    });
  } catch (error) {
    return next(error);
  }
}

function csvEscape(value) {
  const str = String(value == null ? "" : value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function exportInventoryCsv(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const isSuperAdmin = req.auth?.role === "superadmin";
    const scopeFilter = isSuperAdmin ? {} : { dealerId: req.auth.sub };
    const products = await Product.find(scopeFilter).sort({ name: 1 });

    const header = ["productId", "name", "sku", "variant", "price", "stock", "reorderPoint"];
    const rows = [header.join(",")];

    for (const product of products) {
      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
      if (hasVariants) {
        for (const variant of product.variants) {
          const label = [variant.size, variant.color, variant.gender, variant.neckType, variant.pattern].filter(Boolean).join(" / ");
          rows.push([
            csvEscape(product._id.toString()),
            csvEscape(product.name),
            csvEscape(variant.sku),
            csvEscape(label),
            csvEscape(Number(variant.price) > 0 ? variant.price : product.price),
            csvEscape(variant.stock),
            csvEscape(variant.reorderPoint || product.reorderPoint || 0),
          ].join(","));
        }
      } else {
        rows.push([
          csvEscape(product._id.toString()),
          csvEscape(product.name),
          csvEscape(""),
          csvEscape(""),
          csvEscape(product.price),
          csvEscape(product.stock),
          csvEscape(product.reorderPoint || 0),
        ].join(","));
      }
    }

    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="antariya-inventory.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
}

function parseCsv(text) {
  // Minimal CSV parser handling quoted fields and commas/newlines within quotes.
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else { inQuotes = false; }
      } else { field += char; }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else { field += char; }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function importInventoryCsv(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const { csv } = req.body;
    if (typeof csv !== "string" || csv.trim().length === 0) {
      return res.status(400).json({ success: false, message: "CSV content is required" });
    }

    const rows = parseCsv(csv.trim());
    if (rows.length < 2) {
      return res.status(400).json({ success: false, message: "CSV has no data rows" });
    }

    const header = rows[0].map((h) => String(h).trim().toLowerCase());
    const idIdx = header.indexOf("productid");
    const skuIdx = header.indexOf("sku");
    const stockIdx = header.indexOf("stock");
    const reorderIdx = header.indexOf("reorderpoint");

    if (idIdx === -1 || stockIdx === -1) {
      return res.status(400).json({ success: false, message: "CSV must include productId and stock columns" });
    }

    let updated = 0;
    const errors = [];

    for (let r = 1; r < rows.length; r += 1) {
      const cells = rows[r];
      const productId = String(cells[idIdx] || "").trim();
      const sku = skuIdx !== -1 ? String(cells[skuIdx] || "").trim() : "";
      const stock = Number(cells[stockIdx]);
      const reorder = reorderIdx !== -1 ? Number(cells[reorderIdx]) : NaN;
      if (!productId || !Number.isFinite(stock)) continue;

      const product = await Product.findById(productId).catch(() => null);
      if (!product) { errors.push(`Row ${r + 1}: product not found`); continue; }
      if (req.auth?.role !== "superadmin" && product.dealerId !== req.auth.sub) {
        errors.push(`Row ${r + 1}: not your product`); continue;
      }

      if (sku && Array.isArray(product.variants) && product.variants.length > 0) {
        const variant = product.variants.find((v) => v.sku === sku);
        if (!variant) { errors.push(`Row ${r + 1}: variant ${sku} not found`); continue; }
        variant.stock = Math.max(0, stock);
        if (Number.isFinite(reorder)) variant.reorderPoint = Math.max(0, reorder);
        product.stock = product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      } else {
        product.stock = Math.max(0, stock);
        if (Number.isFinite(reorder)) product.reorderPoint = Math.max(0, reorder);
      }
      await product.save();
      updated += 1;
    }

    return res.status(200).json({
      success: true,
      message: `Imported ${updated} row(s).`,
      updated,
      errors: errors.slice(0, 20),
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
  getReviewEligibility,
  getInventoryReport,
  adjustStock,
  getStockHistory,
  updateInventorySettings,
  exportInventoryCsv,
  importInventoryCsv,
};
