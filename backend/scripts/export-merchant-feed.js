/* eslint-disable no-console */
/**
 * Export all inventory products into a Google Merchant Center feed.
 *
 * Produces a CSV in the exact 40-column Merchant Center "Products source"
 * format. Products with variants are expanded into one row per variant,
 * grouped together via `item_group_id` (the parent product _id) — which is
 * how Google expects apparel variants (size/color) to be represented.
 *
 * Read-only: it never writes to the database.
 *
 * Usage:
 *   node scripts/export-merchant-feed.js
 *   node scripts/export-merchant-feed.js --out data/merchant-feed.csv
 *   node scripts/export-merchant-feed.js --published-only   # skip unpublished
 *   node scripts/export-merchant-feed.js --in-stock-only     # skip 0-stock rows
 *
 * Then open the CSV in Excel / Sheets, or upload directly to Merchant Center.
 */
require("dotenv").config();
const fs = require("fs/promises");
const path = require("path");
const { connectDb } = require("../src/config/db");
const env = require("../src/config/env");
const Product = require("../src/models/Product");

// ─── Config ────────────────────────────────────────────────────────────────
const BRAND = "Antariya";
const CURRENCY = "INR";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://antariyaofficial.com").replace(/\/$/, "");
const CONDITION = "new";
const AGE_GROUP = "adult";

// The exact Merchant Center header order (40 columns).
const HEADERS = [
  "id", "title", "description", "availability", "availability_date",
  "expiration_date", "link", "mobile_link", "image_link", "price",
  "sale_price", "sale_price_effective_date", "identifier_exists", "gtin",
  "mpn", "brand", "product_highlight", "product_detail",
  "additional_image_link", "condition", "adult", "color", "size",
  "size_type", "size_system", "gender", "material", "pattern", "age_group",
  "multipack", "is bundle", "unit_pricing_measure", "unit_pricing_base_measure",
  "energy_efficiency_class", "min_energy_efficiency_class",
  "max_energy_efficiency", "item_group_id", "video_link",
  "virtual_model_link", "cost_of_goods_sold",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    outPath: path.resolve(process.cwd(), "data/merchant-feed.csv"),
    publishedOnly: false,
    inStockOnly: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out" && args[i + 1]) {
      opts.outPath = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
    } else if (args[i] === "--published-only") {
      opts.publishedOnly = true;
    } else if (args[i] === "--in-stock-only") {
      opts.inStockOnly = true;
    }
  }
  return opts;
}

// Strip HTML tags (descriptions are stored as HTML) and clamp length.
function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(str, max) {
  const s = String(str || "").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

// RFC-4180 CSV escaping.
function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toFixed(2)} ${CURRENCY}`;
}

function availabilityFor(qty) {
  return Number(qty) > 0 ? "in_stock" : "out_of_stock";
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (Array.isArray(v) && v.length) return v[0];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

// Build one feed row (object keyed by HEADERS) from a product + optional variant.
function buildRow(product, variant) {
  const hasVariant = Boolean(variant);
  const id = hasVariant
    ? variant.sku || `${product._id}-${variant.size || ""}-${variant.color || ""}`
    : String(product._id);

  const price = hasVariant && variant.price > 0 ? variant.price : product.price;
  const stock = hasVariant ? variant.stock : product.stock;

  const color = hasVariant ? variant.color : firstNonEmpty(product.color, product.colors);
  const size = hasVariant ? variant.size : firstNonEmpty(product.size, product.sizes);
  const gender = (hasVariant ? variant.gender : firstNonEmpty(product.gender, product.genders)) || "unisex";
  const pattern = (hasVariant ? variant.pattern : firstNonEmpty(product.pattern, product.patterns)) || "Solid";

  const image = firstNonEmpty(product.image, product.images, product.galleryImages);
  const extraImages = [...(product.images || []), ...(product.galleryImages || [])]
    .filter((u) => u && u !== image)
    .slice(0, 10)
    .join(",");

  const titleBits = [product.name, color, size].filter(Boolean).join(" ");

  const row = {};
  HEADERS.forEach((h) => (row[h] = ""));

  row.id = id;
  row.title = clamp(titleBits, 150);
  row.description = clamp(stripHtml(product.description) || product.name, 200);
  row.availability = availabilityFor(stock);
  row.link = `${SITE_URL}/product/${product._id}`;
  row.image_link = image;
  row.price = money(price);
  row.identifier_exists = "no"; // no GTIN/MPN on handmade/own-brand apparel
  row.brand = BRAND;
  row.additional_image_link = extraImages;
  row.condition = CONDITION;
  row.adult = "no";
  row.color = color;
  row.size = size;
  row.size_system = "IN";
  row.gender = gender;
  row.material = firstNonEmpty(product.material) || "";
  row.pattern = pattern;
  row.age_group = AGE_GROUP;
  // Only set item_group_id when the product actually has multiple variants,
  // so single-SKU products aren't flagged as incomplete variant groups.
  row.item_group_id = hasVariant ? String(product._id) : "";

  return row;
}

async function run() {
  const opts = parseArgs(process.argv);
  if (!env.mongoUri) throw new Error("MONGODB_URI is not set. Check backend/.env");

  await connectDb(env.mongoUri);
  console.log("✅ Connected to MongoDB\n");

  const filter = opts.publishedOnly ? { published: true } : {};
  const products = await Product.find(filter).lean();
  console.log(`Found ${products.length} products.`);

  const rows = [];
  let variantRows = 0;
  let skippedOOS = 0;

  for (const product of products) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) {
      for (const v of variants) {
        if (opts.inStockOnly && Number(v.stock) <= 0) {
          skippedOOS += 1;
          continue;
        }
        rows.push(buildRow(product, v));
        variantRows += 1;
      }
    } else {
      if (opts.inStockOnly && Number(product.stock) <= 0) {
        skippedOOS += 1;
        continue;
      }
      rows.push(buildRow(product, null));
    }
  }

  // Assemble CSV.
  const lines = [HEADERS.join(",")];
  for (const row of rows) {
    lines.push(HEADERS.map((h) => csvCell(row[h])).join(","));
  }
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n"; // BOM for Excel/₹ safety

  await fs.mkdir(path.dirname(opts.outPath), { recursive: true });
  await fs.writeFile(opts.outPath, csv, "utf8");

  console.log(`\n=== Export summary ===`);
  console.log(`  Products processed : ${products.length}`);
  console.log(`  Variant rows       : ${variantRows}`);
  console.log(`  Total feed rows    : ${rows.length}`);
  if (opts.inStockOnly) console.log(`  Skipped (0 stock)  : ${skippedOOS}`);
  console.log(`\n📄 Written to: ${opts.outPath}`);

  await require("mongoose").connection.close();
}

run().catch((err) => {
  console.error("Export failed:", err.message);
  process.exit(1);
});
