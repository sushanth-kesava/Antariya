const mongoose = require("mongoose");
const Category = require("../models/Category");
const Product = require("../models/Product");

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Escape a string for safe use inside a MongoDB $regex (prevents ReDoS / injection). */
function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serialize(cat) {
  return {
    id: cat._id.toString(),
    name: cat.name,
    slug: cat.slug,
    description: cat.description || "",
    icon: cat.icon || "Shirt",
    parentId: cat.parentId ? cat.parentId.toString() : null,
    ancestors: (cat.ancestors || []).map((a) => ({
      id: a._id ? a._id.toString() : null,
      name: a.name,
      slug: a.slug,
    })),
    path: cat.path || "",
    level: cat.level || 0,
    order: cat.order || 0,
    active: cat.active !== false,
    showInNav: cat.showInNav !== false,
    productCount: cat.productCount || 0,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  };
}

/**
 * Build the parent linkage (ancestors, path, level) for a category given its
 * parentId. Returns { parent, ancestors, path, level } or throws on bad parent.
 */
async function buildLineage(name, slug, parentId, session) {
  if (!parentId) {
    return { ancestors: [], path: `/${slug}`, level: 0 };
  }
  const parent = await Category.findById(parentId).session(session || null);
  if (!parent) {
    const err = new Error("Parent category not found");
    err.statusCode = 400;
    throw err;
  }
  const ancestors = [
    ...(parent.ancestors || []),
    { _id: parent._id, name: parent.name, slug: parent.slug },
  ];
  return {
    ancestors,
    path: `${parent.path}/${slug}`,
    level: (parent.level || 0) + 1,
  };
}

// ─── Public: list / tree / filter ───────────────────────────────────────────

/**
 * GET /api/categories
 * Query: ?flat=1 (flat list) | default returns nested tree
 *        ?active=1 (only active) ?search=term
 */
async function listCategories(req, res, next) {
  try {
    const { flat, active, search, nav } = req.query;
    const filter = {};
    if (active === "1" || active === "true") filter.active = true;
    if (nav === "1" || nav === "true") filter.showInNav = true;
    if (search && String(search).trim()) {
      filter.name = { $regex: escapeRegex(String(search).trim()), $options: "i" };
    }

    const cats = await Category.find(filter).sort({ level: 1, order: 1, name: 1 }).lean();
    const serialized = cats.map(serialize);

    if (flat === "1" || flat === "true" || search) {
      return res.status(200).json({ success: true, categories: serialized });
    }

    // Build nested tree
    const byId = new Map(serialized.map((c) => [c.id, { ...c, children: [] }]));
    const roots = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) {
        byId.get(c.parentId).children.push(c);
      } else {
        roots.push(c);
      }
    }
    return res.status(200).json({ success: true, tree: roots, categories: serialized });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/categories/:slug/products — products in a category OR any of its
 * descendants (subtree filter via materialized path prefix).
 */
async function getCategoryProducts(req, res, next) {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // All categories in this subtree (self + descendants).
    const subtree = await Category.find({
      $or: [{ _id: category._id }, { path: { $regex: `^${escapeRegex(category.path)}/` } }],
    }).select("_id");
    const ids = subtree.map((c) => c._id);

    const products = await Product.find({
      published: { $ne: false },
      $or: [{ categoryId: { $in: ids } }, { subCategoryId: { $in: ids } }],
    }).lean();

    return res.status(200).json({ success: true, category: serialize(category), products });
  } catch (error) {
    return next(error);
  }
}

// ─── Superadmin/Admin: CRUD ──────────────────────────────────────────────────

async function createCategory(req, res, next) {
  try {
    const { name, description, icon, parentId, order, active, showInNav } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const slug = Category.slugify(name);
    if (!slug) {
      return res.status(400).json({ success: false, message: "Category name produces an invalid slug" });
    }

    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(409).json({ success: false, message: `A category with slug "${slug}" already exists` });
    }

    const lineage = await buildLineage(name, slug, parentId || null);

    const category = await Category.create({
      name: String(name).trim(),
      slug,
      description: description ? String(description).trim() : "",
      icon: icon || "Shirt",
      parentId: parentId || null,
      ancestors: lineage.ancestors,
      path: lineage.path,
      level: lineage.level,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
      active: active !== false,
      showInNav: showInNav !== false,
      createdBy: req.auth?.email || "admin",
    });

    return res.status(201).json({ success: true, message: "Category created", category: serialize(category) });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const { name, description, icon, order, active, showInNav } = req.body;
    const oldName = category.name;
    const oldSlug = category.slug;

    if (name && String(name).trim() && String(name).trim() !== category.name) {
      const newSlug = Category.slugify(name);
      const clash = await Category.findOne({ slug: newSlug, _id: { $ne: category._id } });
      if (clash) {
        return res.status(409).json({ success: false, message: `Slug "${newSlug}" already in use` });
      }
      category.name = String(name).trim();
      category.slug = newSlug;
    }
    if (description !== undefined) category.description = String(description).trim();
    if (icon !== undefined) category.icon = icon;
    if (order !== undefined) category.order = Number(order) || 0;
    if (active !== undefined) category.active = Boolean(active);
    if (showInNav !== undefined) category.showInNav = Boolean(showInNav);

    // If the slug changed, rebuild this node's path and cascade to descendants.
    const slugChanged = category.slug !== oldSlug;
    if (slugChanged) {
      const lineage = await buildLineage(category.name, category.slug, category.parentId);
      const oldPath = category.path;
      category.path = lineage.path;

      await category.save();

      // Cascade path + ancestor-name updates to all descendants.
      const descendants = await Category.find({ path: { $regex: `^${escapeRegex(oldPath)}/` } });
      for (const d of descendants) {
        d.path = d.path.replace(oldPath, category.path);
        d.ancestors = (d.ancestors || []).map((a) =>
          a.slug === oldSlug ? { ...a, name: category.name, slug: category.slug } : a
        );
        await d.save();
      }

      // Propagate the display name to products tagged with this category
      // (keeps the denormalized string fields consistent everywhere).
      await Product.updateMany({ categoryId: category._id }, { $set: { category: category.name } });
      await Product.updateMany({ subCategoryId: category._id }, { $set: { subCategory: category.name } });
    } else {
      await category.save();
    }

    return res.status(200).json({ success: true, message: "Category updated", category: serialize(category) });
  } catch (error) {
    return next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Block deletion if it has children unless ?cascade=1.
    const childCount = await Category.countDocuments({ parentId: category._id });
    const cascade = req.query.cascade === "1" || req.query.cascade === "true";
    if (childCount > 0 && !cascade) {
      return res.status(409).json({
        success: false,
        message: `This category has ${childCount} sub-categor${childCount === 1 ? "y" : "ies"}. Delete or move them first, or pass cascade=1.`,
      });
    }

    // Collect the whole subtree.
    const subtree = await Category.find({
      $or: [{ _id: category._id }, { path: { $regex: `^${escapeRegex(category.path)}/` } }],
    }).select("_id");
    const ids = subtree.map((c) => c._id);

    // Guard: don't orphan products. Clear their category references (products
    // are preserved — never deleted with a category).
    const affected = await Product.countDocuments({
      $or: [{ categoryId: { $in: ids } }, { subCategoryId: { $in: ids } }],
    });
    await Product.updateMany(
      { categoryId: { $in: ids } },
      { $set: { categoryId: null, category: "" } }
    );
    await Product.updateMany(
      { subCategoryId: { $in: ids } },
      { $set: { subCategoryId: null, subCategory: "" } }
    );

    await Category.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      success: true,
      message: `Deleted ${ids.length} categor${ids.length === 1 ? "y" : "ies"}. ${affected} product(s) were un-categorized (not deleted).`,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/categories/recount — refresh denormalized productCount for all
 * categories. Cheap maintenance endpoint; safe to call anytime.
 */
async function recountProducts(req, res, next) {
  try {
    const cats = await Category.find().select("_id");
    for (const c of cats) {
      const count = await Product.countDocuments({
        $or: [{ categoryId: c._id }, { subCategoryId: c._id }],
      });
      await Category.updateOne({ _id: c._id }, { $set: { productCount: count } });
    }
    return res.status(200).json({ success: true, message: `Recounted ${cats.length} categories` });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCategories,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory,
  recountProducts,
};
