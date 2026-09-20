/* eslint-disable no-console */
/**
 * Backfill `mrp` (Maximum Retail Price / compare-at price) on existing products
 * so the storefront's strikethrough + discount % renders on the current catalog.
 *
 * The storefront only shows a discount when `mrp > price`, so this script
 * derives an MRP from each product's real selling price by picking a RANDOMIZED
 * discount % per product (within a configurable range), then rounding the MRP
 * up to an attractive price point (…99). Randomizing makes the catalog look
 * organic instead of a uniform flat markup.
 *
 * DETERMINISTIC RANDOMNESS:
 *   The per-product discount is seeded from the product's _id, so the dry-run
 *   preview is EXACTLY what --commit writes (re-running is stable, not shuffled).
 *
 * SAFE BY DEFAULT:
 *   - Only touches products where `mrp` is missing / 0 / <= price (never
 *     overwrites an MRP an admin already set intentionally).
 *   - Runs in DRY-RUN mode unless you pass --commit.
 *
 * Usage:
 *   node scripts/backfill-mrp.js                    # dry run, random 25-45% off
 *   node scripts/backfill-mrp.js --min 20 --max 50  # dry run, random 20-50% off
 *   node scripts/backfill-mrp.js --commit           # actually write
 *   node scripts/backfill-mrp.js --min 30 --max 45 --commit
 *   node scripts/backfill-mrp.js --force --commit   # also recompute existing MRPs
 *
 * npm:
 *   npm run db:backfill-mrp -- --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../src/config/db");
const env = require("../src/config/env");
const Product = require("../src/models/Product");

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { min: 25, max: 45, commit: false, force: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--min" && args[i + 1]) {
      const v = parseFloat(args[i + 1]);
      if (Number.isFinite(v) && v > 0 && v < 90) opts.min = v;
      i += 1;
    } else if (args[i] === "--max" && args[i + 1]) {
      const v = parseFloat(args[i + 1]);
      if (Number.isFinite(v) && v > 0 && v < 90) opts.max = v;
      i += 1;
    } else if (args[i] === "--commit") {
      opts.commit = true;
    } else if (args[i] === "--force") {
      opts.force = true;
    }
  }
  // Guard against an inverted range.
  if (opts.min > opts.max) {
    const t = opts.min;
    opts.min = opts.max;
    opts.max = t;
  }
  return opts;
}

// Deterministic 0..1 pseudo-random derived from a string seed (the product _id),
// so the same product always yields the same discount across dry-run and commit.
function seededUnit(seed) {
  let h = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Normalize to [0, 1).
  return ((h >>> 0) % 100000) / 100000;
}

// Round an MRP up to a psychologically "nice" price point so the strikethrough
// looks like a real original price, not a raw division. Always steps up to the
// nearest value ending in ...99 (e.g. 999 -> 1399, 1499 -> 2099).
function prettyRoundUp(value) {
  if (value <= 0) return 0;
  return Math.max(99, Math.ceil((value - 99) / 100) * 100 + 99);
}

async function run() {
  const opts = parseArgs(process.argv);
  if (!env.mongoUri) throw new Error("MONGODB_URI is not set. Check backend/.env");

  await connectDb(env.mongoUri);
  console.log("Connected to MongoDB.");
  console.log(
    `Mode: ${opts.commit ? "COMMIT (writing)" : "DRY RUN (no writes)"} | random discount: ${opts.min}-${opts.max}% off | force: ${opts.force}\n`
  );

  const products = await Product.find({}).select("_id name price mrp");
  console.log(`Scanning ${products.length} products...\n`);

  let updated = 0;
  let skipped = 0;
  const preview = [];
  let discountSum = 0;

  for (const product of products) {
    const price = Number(product.price) || 0;
    const currentMrp = Number(product.mrp) || 0;

    if (price <= 0) {
      skipped += 1;
      continue;
    }

    // Skip products that already carry a valid, higher MRP — unless --force.
    if (!opts.force && currentMrp > price) {
      skipped += 1;
      continue;
    }

    // Pick a deterministic per-product discount % within [min, max].
    const unit = seededUnit(product._id);
    const targetOff = opts.min + unit * (opts.max - opts.min);

    // MRP such that price is `targetOff`% below it: mrp = price / (1 - off/100).
    const rawMrp = price / (1 - targetOff / 100);
    const proposedMrp = prettyRoundUp(rawMrp);

    // Guard: the computed MRP must end up strictly greater than price.
    if (proposedMrp <= price) {
      skipped += 1;
      continue;
    }

    const off = Math.round((1 - price / proposedMrp) * 100);
    discountSum += off;
    preview.push({ name: product.name, price, mrp: proposedMrp, off });

    if (opts.commit) {
      await Product.updateOne({ _id: product._id }, { $set: { mrp: proposedMrp } });
    }
    updated += 1;
  }

  // Show a sample so you can eyeball the results.
  console.log("Sample of computed MRPs:");
  preview.slice(0, 15).forEach((p) => {
    console.log(`  ${p.price}  ->  MRP ${p.mrp}  (${p.off}% off)   ${p.name.slice(0, 50)}`);
  });
  if (preview.length > 15) console.log(`  ...and ${preview.length - 15} more`);

  console.log("\n=== Summary ===");
  console.log(`  Products scanned : ${products.length}`);
  console.log(`  ${opts.commit ? "Updated" : "Would update"} : ${updated}`);
  console.log(`  Skipped (already had MRP / price 0) : ${skipped}`);
  if (updated > 0) {
    console.log(`  Average discount shown : ${Math.round(discountSum / updated)}% off`);
  }
  if (!opts.commit) {
    console.log("\nDRY RUN complete — no changes written. Re-run with --commit to apply.");
  } else {
    console.log("\n✅ Backfill complete.");
  }

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
