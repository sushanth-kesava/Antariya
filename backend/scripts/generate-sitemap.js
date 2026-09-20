/* eslint-disable no-console */
/**
 * Generate a full sitemap.xml that includes every published product URL
 * alongside the static marketing/shop pages.
 *
 * Why a script: products live in MongoDB, so the sitemap must be regenerated
 * from the DB (there is no request-time sitemap because the frontend is a
 * static export — output: "export").
 *
 * Trailing slashes: the frontend uses `trailingSlash: true`, so every <loc>
 * ends with "/". This matches the canonical URLs and avoids Apache's
 * /path -> /path/ 301 redirect, which otherwise causes "Page with redirect"
 * errors in Google Search Console.
 *
 * Writes to BOTH canonical locations:
 *   - public_html/sitemap.xml        (Hostinger deploy target)
 *   - frontend/public/sitemap.xml    (bundled into the Next.js build)
 *
 * Usage:
 *   node scripts/generate-sitemap.js
 *   node scripts/generate-sitemap.js --base https://antariyaofficial.com
 *
 * npm:
 *   npm run db:generate-sitemap
 */
require("dotenv").config();
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const { connectDb } = require("../src/config/db");
const env = require("../src/config/env");
const Product = require("../src/models/Product");

const DEFAULT_BASE = "https://antariyaofficial.com";

// Static routes that are always in the sitemap (public, indexable).
// Kept in sync with the hand-written sitemap. Auth/private routes are
// intentionally excluded (they're also disallowed in robots.txt).
const STATIC_ROUTES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/marketplace/", changefreq: "daily", priority: "0.9" },
  { loc: "/shop/", changefreq: "daily", priority: "0.8" },
  { loc: "/shop/hoodies/", changefreq: "weekly", priority: "0.7" },
  { loc: "/customize/", changefreq: "weekly", priority: "0.7" },
  { loc: "/about/", changefreq: "monthly", priority: "0.7" },
  { loc: "/contact-support/", changefreq: "monthly", priority: "0.6" },
  { loc: "/track-order/", changefreq: "monthly", priority: "0.5" },
  { loc: "/sitemap/", changefreq: "monthly", priority: "0.3" },
  { loc: "/legal/policies/", changefreq: "yearly", priority: "0.4" },
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { base: (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_BASE).replace(/\/+$/, "") };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--base" && args[i + 1]) {
      opts.base = args[i + 1].replace(/\/+$/, "");
      i += 1;
    }
  }
  return opts;
}

function isoDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
}

function urlBlock({ loc, lastmod, changefreq, priority }) {
  const lines = [
    "  <url>",
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
  ];
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  lines.push("  </url>");
  return lines.join("\n");
}

async function run() {
  const opts = parseArgs(process.argv);
  if (!env.mongoUri) throw new Error("MONGODB_URI is not set. Check backend/.env");

  await connectDb(env.mongoUri);
  console.log("Connected to MongoDB.");
  console.log(`Base URL: ${opts.base}\n`);

  const today = new Date().toISOString().slice(0, 10);

  // Only published products belong in the sitemap.
  const products = await Product.find({ published: true })
    .select("_id updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  console.log(`Found ${products.length} published products.`);

  const staticBlocks = STATIC_ROUTES.map((r) =>
    urlBlock({
      loc: `${opts.base}${r.loc}`,
      lastmod: today,
      changefreq: r.changefreq,
      priority: r.priority,
    })
  );

  const productBlocks = products.map((p) =>
    urlBlock({
      loc: `${opts.base}/product/${p._id.toString()}/`,
      lastmod: isoDate(p.updatedAt),
      changefreq: "weekly",
      priority: "0.6",
    })
  );

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "  <!-- Static pages -->\n" +
    staticBlocks.join("\n") +
    "\n\n  <!-- Products (auto-generated) -->\n" +
    productBlocks.join("\n") +
    "\n</urlset>\n";

  // Write to both canonical locations.
  const targets = [
    path.resolve(__dirname, "../../public_html/sitemap.xml"),
    path.resolve(__dirname, "../../frontend/public/sitemap.xml"),
  ];

  for (const target of targets) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, xml, "utf8");
    console.log(`  Wrote ${target}`);
  }

  console.log("\n=== Summary ===");
  console.log(`  Static URLs  : ${staticBlocks.length}`);
  console.log(`  Product URLs : ${productBlocks.length}`);
  console.log(`  Total URLs   : ${staticBlocks.length + productBlocks.length}`);
  console.log("\n✅ Sitemap generated. Remember to redeploy so the new sitemap ships.");

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error("Sitemap generation failed:", err.message);
  process.exit(1);
});
