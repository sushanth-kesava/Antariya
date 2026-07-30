const mongoose = require("mongoose");

/**
 * Category — nested (Parent → Child) product category tree.
 *
 * Design:
 *  - `parentId` links a child to its parent (null = top-level section).
 *  - `slug` is a URL-safe unique identifier used by the storefront and APIs.
 *  - `path` is a materialized "/parent-slug/child-slug" string so we can
 *    filter an entire subtree with a single indexed prefix query
 *    (Category.find({ path: /^\/collections/ })) without recursion.
 *  - `ancestors` keeps ordered {_id, slug, name} for cheap breadcrumb builds.
 *
 * Backward compatibility: products keep their existing string `category` /
 * `subCategory` fields. This model is the authoritative source that the
 * admin manages; product tagging additionally stores `categoryId` (added to
 * the Product model) so renames propagate everywhere via populate.
 */
function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const ancestorSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    name: String,
    slug: String,
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    icon: { type: String, default: "Shirt", trim: true },

    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    // Materialized ancestor chain (root → immediate parent).
    ancestors: { type: [ancestorSchema], default: [] },
    // Materialized path e.g. "/collections/anime-collection" for subtree queries.
    path: { type: String, default: "", index: true },
    // Depth: 0 = top-level section, 1 = sub-category, etc.
    level: { type: Number, default: 0, index: true },

    // Display / behaviour
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
    // Show in the storefront navigation menus.
    showInNav: { type: Boolean, default: true },

    // Denormalized count of products directly tagged with this category.
    productCount: { type: Number, default: 0 },

    createdBy: { type: String, default: "system" },
  },
  { timestamps: true }
);

categorySchema.index({ parentId: 1, order: 1 });
categorySchema.index({ name: "text", description: "text" });

categorySchema.statics.slugify = slugify;

categorySchema.set("toJSON", { virtuals: true });
categorySchema.set("toObject", { virtuals: true });

module.exports = mongoose.models.Category || mongoose.model("Category", categorySchema);
