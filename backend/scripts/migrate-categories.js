/**
 * One-time (idempotent) migration that seeds the nested Category tree and
 * back-fills every product's categoryId / subCategoryId.
 *
 *   node scripts/migrate-categories.js
 *
 * What it does:
 *   1. Seeds top-level categories + their sub-categories from the canonical
 *      CATEGORY_TREE (mirrors frontend/src/lib/categories.ts).
 *   2. For every Product, matches its existing string `category` and
 *      `subCategory` to the seeded categories and sets categoryId /
 *      subCategoryId. Products whose category doesn't match a known node are
 *      placed under an "Uncategorized" section so NOTHING is lost.
 *   3. Recounts productCount per category.
 *
 * It NEVER deletes products or categories. Safe to re-run — existing
 * categories are matched by slug and reused.
 *
 * Run with:  npm run db:migrate-categories
 */
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");

const Category = require("../src/models/Category");
const Product = require("../src/models/Product");

// Canonical seed tree (kept in sync with frontend/src/lib/categories.ts).
const CATEGORY_TREE = [
  { category: "Collections", icon: "Sparkles", subCategories: [
    "Signature Collection", "Performance Collection", "Essentials Collection", "Luxury Basics",
    "Heritage Collection", "Motorsport Collection", "Urban Street Collection", "Anime Collection",
    "Minimal Collection", "Vintage Collection", "Artist Collaboration Collection", "Limited Edition",
    "Exclusive Drop", "Oversized Premium Collection",
  ]},
  { category: "Sleeve Type", icon: "Shirt", subCategories: [
    "Half Sleeve T-Shirt", "Full Sleeve T-Shirt", "Sleeveless T-Shirt", "Raglan Sleeve T-Shirt",
  ]},
  { category: "Fit", icon: "Ruler", subCategories: [
    "Regular Fit", "Slim Fit", "Oversized Fit", "Relaxed Fit", "Boxy Fit", "Muscle Fit",
    "Athletic Fit", "Cropped Fit", "Longline Fit",
  ]},
  { category: "Fabric", icon: "Layers", subCategories: [
    "100% Cotton", "Organic Cotton", "Combed Cotton", "Supima Cotton", "Pima Cotton", "Cotton Blend",
    "Polyester", "Poly-Cotton Blend", "Cotton Lycra (Stretch)", "Bamboo Fabric", "Linen Blend",
    "Modal", "Rayon", "Dry-Fit Fabric", "French Terry", "Waffle Knit",
  ]},
  { category: "Style", icon: "Palette", subCategories: [
    "Basic Tee", "Pocket T-Shirt", "Drop Shoulder T-Shirt", "Oversized Streetwear Tee", "Vintage Tee",
    "Washed Tee", "Distressed Tee", "Layered Tee", "Hooded T-Shirt", "Zip T-Shirt", "Color Block T-Shirt",
    "Panel T-Shirt", "Henley T-Shirt", "Baseball Tee", "Polo T-Shirt", "Graphic Printed",
  ]},
  { category: "Occasion", icon: "CalendarHeart", subCategories: [
    "Casual Wear", "Streetwear", "Gym/Fitness", "Sports", "Running", "Travel", "Party Wear",
    "College Wear", "Lounge Wear", "Workwear", "Vacation Wear",
  ]},
  { category: "Audience", icon: "Users", subCategories: [
    "Men's T-Shirts", "Women's T-Shirts", "Unisex T-Shirts", "Kids' T-Shirts", "Couple T-Shirts", "Family T-Shirts",
  ]},
];

async function upsertCategory({ name, icon, parentDoc, order }) {
  const slug = Category.slugify(name);
  let cat = await Category.findOne({ slug });
  if (cat) return cat;

  const ancestors = parentDoc
    ? [...(parentDoc.ancestors || []), { _id: parentDoc._id, name: parentDoc.name, slug: parentDoc.slug }]
    : [];
  const path = parentDoc ? `${parentDoc.path}/${slug}` : `/${slug}`;
  const level = parentDoc ? (parentDoc.level || 0) + 1 : 0;

  cat = await Category.create({
    name, slug, icon: icon || "Shirt",
    parentId: parentDoc ? parentDoc._id : null,
    ancestors, path, level, order: order || 0,
    active: true, showInNav: true, createdBy: "migration",
  });
  return cat;
}

async function main() {
  const uri = env.mongoUri || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  console.log("Connecting:", uri.replace(/\/\/[^@]*@/, "//<redacted>@"));
  await mongoose.connect(uri);
  console.log("Connected. Seeding category tree...");

  // 1. Seed the tree, building a name -> category doc lookup.
  const bySubName = new Map(); // sub-category name -> doc
  const byTopName = new Map(); // top category name -> doc
  let order = 0;
  for (const top of CATEGORY_TREE) {
    const topDoc = await upsertCategory({ name: top.category, icon: top.icon, parentDoc: null, order: order++ });
    byTopName.set(top.category.toLowerCase(), topDoc);
    let subOrder = 0;
    for (const sub of top.subCategories) {
      const subDoc = await upsertCategory({ name: sub, icon: top.icon, parentDoc: topDoc, order: subOrder++ });
      bySubName.set(sub.toLowerCase(), subDoc);
    }
  }

  // Fallback bucket so nothing is ever lost.
  const uncategorized = await upsertCategory({ name: "Uncategorized", icon: "Shirt", parentDoc: null, order: 999 });

  console.log("Categories seeded. Back-filling products...");

  // 2. Back-fill products.
  const products = await Product.find({});
  let matched = 0, bucketed = 0;
  for (const p of products) {
    const catName = String(p.category || "").trim().toLowerCase();
    const subName = String(p.subCategory || "").trim().toLowerCase();

    let categoryDoc = byTopName.get(catName) || null;
    let subDoc = bySubName.get(subName) || null;

    // If subCategory matches a known sub but category didn't, derive parent.
    if (!categoryDoc && subDoc) {
      categoryDoc = await Category.findById(subDoc.parentId);
    }
    // If the string category actually names a sub-category, use it as sub.
    if (!subDoc && bySubName.get(catName)) {
      subDoc = bySubName.get(catName);
      categoryDoc = categoryDoc || (await Category.findById(subDoc.parentId));
    }

    if (!categoryDoc) {
      categoryDoc = uncategorized;
      bucketed++;
    } else {
      matched++;
    }

    p.categoryId = categoryDoc._id;
    p.subCategoryId = subDoc ? subDoc._id : null;
    // Keep denormalized strings consistent with the resolved category.
    if (categoryDoc && categoryDoc !== uncategorized) p.category = categoryDoc.name;
    if (subDoc) p.subCategory = subDoc.name;
    await p.save();
  }

  // 3. Recount.
  const cats = await Category.find().select("_id");
  for (const c of cats) {
    const count = await Product.countDocuments({ $or: [{ categoryId: c._id }, { subCategoryId: c._id }] });
    await Category.updateOne({ _id: c._id }, { $set: { productCount: count } });
  }

  console.log(`Done. Products matched: ${matched}, bucketed to Uncategorized: ${bucketed}, total: ${products.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
