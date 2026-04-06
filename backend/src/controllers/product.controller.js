const Product = require("../models/Product");
const Review = require("../models/Review");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");

const seedProductsData = [
  {
    name: "Royal Zardosi Floral Pack",
    description: "A collection of 5 traditional Indian floral designs optimized for high-speed machines.",
    price: 49.99,
    category: "Embroidery Designs",
    dealerId: "seed-admin",
    image: "https://picsum.photos/seed/design1/600/600",
    galleryImages: [
      "https://images.unsplash.com/photo-1595341595379-cf0f0f94f9d1?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&q=80&w=1200",
    ],
    stock: 999,
    fileDownloadLink: "/designs/royal-zardosi.zip",
    rating: 4.8,
    customizable: false,
  },
  {
    name: "Vibrant Silk Thread Set",
    description: "Set of 24 colors, 1000m each. High sheen and break resistance.",
    price: 35,
    category: "Machine Threads",
    dealerId: "seed-admin",
    image: "https://picsum.photos/seed/thread1/400/400",
    galleryImages: [
      "https://images.unsplash.com/photo-1584208124888-3f7a7f9699d0?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1613626630502-182579c04343?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=1200",
    ],
    stock: 50,
    rating: 4.5,
    customizable: false,
  },
  {
    name: "Premium Cotton Hoodie - Jet Black",
    description: "Heavyweight 400GSM cotton hoodie, perfect for intricate embroidery work.",
    price: 25,
    category: "Hoodies",
    dealerId: "seed-admin",
    image: "https://picsum.photos/seed/hoodie1/600/600",
    galleryImages: [
      "https://images.unsplash.com/photo-1618354691261-e2a0a4f6f07b?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1571945153237-4929e783af4a?auto=format&fit=crop&q=80&w=1200",
    ],
    stock: 100,
    rating: 4.7,
    customizable: true,
  },
  {
    name: "Silk Blend Blouse Piece",
    description: "Unstitched blouse piece in rich silk, ready for custom zardosi embroidery.",
    price: 18.5,
    category: "Blouses",
    dealerId: "seed-admin",
    image: "https://picsum.photos/seed/blouse1/600/600",
    galleryImages: [
      "https://images.unsplash.com/photo-1583391733981-5871f92f9f2f?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1622662021019-ffddc9e60f65?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1614676471928-2ed0ad1061a4?auto=format&fit=crop&q=80&w=1200",
    ],
    stock: 150,
    rating: 4.6,
    customizable: true,
  },
];

function normalizeProduct(doc) {
  const galleryImages = Array.isArray(doc.galleryImages)
    ? doc.galleryImages.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

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
    image: doc.image,
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
    const { category, search, dealerId, customizable } = req.query;

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

    const products = await Product.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      products: products.map(normalizeProduct),
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

async function createProduct(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can create products",
      });
    }

    const { name, description, price, category, image, galleryImages, stock, rating, customizable, fileDownloadLink } = req.body;

    if (!name || !description || typeof price === "undefined" || !category || !image) {
      return res.status(400).json({
        success: false,
        message: "Missing required product fields",
      });
    }

    const normalizedGallery = Array.isArray(galleryImages)
      ? galleryImages
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 10)
      : [];

    if (!normalizedGallery.includes(image)) {
      normalizedGallery.unshift(image);
    }

    const product = await Product.create({
      name,
      description,
      price: Number(price),
      category,
      image,
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

async function seedProducts(req, res, next) {
  try {
    const existingCount = await Product.countDocuments();

    if (existingCount > 0) {
      return res.status(200).json({
        success: false,
        message: "Database already has data.",
      });
    }

    const inserted = await Product.insertMany(seedProductsData);

    return res.status(201).json({
      success: true,
      message: "Database seeded successfully!",
      count: inserted.length,
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

    const reviews = await Review.find({ moderatedAt: { $ne: null } })
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
  getProductById,
  createProduct,
  deleteProduct,
  seedProducts,
  getProductReviews,
  createProductReview,
  getReviewModerationQueue,
  updateReviewModeration,
  getReviewModerationActivity,
};
