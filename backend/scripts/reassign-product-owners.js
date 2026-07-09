/* eslint-disable no-console */
/**
 * Reassign orphaned products to a real admin owner.
 *
 * Background:
 *   Products store `dealerId` as a STRING equal to an AdminProfile `_id`.
 *   Seed/imported products were created with placeholder dealerIds like
 *   "antariyaofficial", which do NOT match any real AdminProfile `_id`.
 *   Those products are "orphaned": they can appear in unscoped lists but the
 *   dealerId-scoped admin catalog + ownership checks never line up, which
 *   surfaces as "Product not found" when adjusting stock.
 *
 * This script finds every product whose `dealerId` is not a valid ObjectId of
 * an existing AdminProfile and reassigns it to a target admin (by email).
 *
 * Usage:
 *   node scripts/reassign-product-owners.js --email you@example.com
 *   node scripts/reassign-product-owners.js --email you@example.com --dry-run
 *   node scripts/reassign-product-owners.js --email you@example.com --all   # reassign ALL products, not just orphans
 *
 * Defaults to the first superadmin (or admin) found if --email is omitted.
 */
const mongoose = require("mongoose");
const env = require("../src/config/env");
const { connectDb } = require("../src/config/db");
const Product = require("../src/models/Product");
const AdminProfile = require("../src/models/AdminProfile");

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { email: "", dryRun: false, all: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--email" && args[i + 1]) {
      options.email = String(args[i + 1]).trim().toLowerCase();
      i += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--all") {
      options.all = true;
    }
  }
  return options;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value)) &&
    String(new mongoose.Types.ObjectId(String(value))) === String(value);
}

async function resolveTargetAdmin(email) {
  if (email) {
    const admin = await AdminProfile.findOne({ email });
    if (!admin) throw new Error(`No AdminProfile found with email "${email}".`);
    return admin;
  }
  // Fallback: prefer a superadmin, else any admin.
  const admin =
    (await AdminProfile.findOne({ role: "superadmin" })) ||
    (await AdminProfile.findOne({ role: "admin" }));
  if (!admin) throw new Error("No AdminProfile exists to assign products to.");
  return admin;
}

async function run() {
  const { email, dryRun, all } = parseArgs(process.argv);
  await connectDb(env.mongoUri);

  const target = await resolveTargetAdmin(email);
  const targetId = target._id.toString();
  console.log(`Target owner: ${target.displayName} <${target.email}> (${target.role})`);
  console.log(`  _id = ${targetId}\n`);

  // Build the set of valid admin ids so we can detect orphans.
  const admins = await AdminProfile.find({}).select("_id");
  const validIds = new Set(admins.map((a) => a._id.toString()));

  const products = await Product.find({}).select("_id name dealerId dealerName dealerEmail");
  const toReassign = products.filter((p) => {
    if (all) return p.dealerId !== targetId;
    // Orphan = dealerId is not a valid ObjectId, or not an existing admin's id.
    return !isValidObjectId(p.dealerId) || !validIds.has(String(p.dealerId));
  });

  console.log(`Scanned ${products.length} product(s). ${toReassign.length} need reassignment.\n`);
  toReassign.forEach((p, idx) => {
    console.log(`  ${idx + 1}. ${p.name}  (dealerId: ${p.dealerId} -> ${targetId})`);
  });

  if (toReassign.length === 0) {
    console.log("\nNothing to do. All products already have a valid owner.");
    await mongoose.connection.close();
    return;
  }

  if (dryRun) {
    console.log("\nDry run — no changes written.");
    await mongoose.connection.close();
    return;
  }

  const ids = toReassign.map((p) => p._id);
  const result = await Product.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        dealerId: targetId,
        dealerName: target.displayName,
        dealerEmail: target.email,
      },
    }
  );

  console.log(`\nReassigned ${result.modifiedCount} product(s) to ${target.email}.`);
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error("Reassignment failed:", err.message);
  process.exit(1);
});
