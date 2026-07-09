/* eslint-disable no-console */
/**
 * Inspect the real product dataset and admin accounts.
 *
 * Answers, in one run:
 *   - How many products are actually in MongoDB?
 *   - What dealerId / dealerEmail owns each one?
 *   - Which admin accounts exist (and their real _id values)?
 *   - Which products are "orphaned" (owner is not a real admin)?
 *
 * This is read-only. It writes nothing.
 *
 * Usage:
 *   node scripts/inspect-products.js
 */
const mongoose = require("mongoose");
const env = require("../src/config/env");
const { connectDb } = require("../src/config/db");
const Product = require("../src/models/Product");
const AdminProfile = require("../src/models/AdminProfile");

async function run() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is not set. Check backend/.env");
  }
  await connectDb(env.mongoUri);
  console.log("Connected to MongoDB.\n");

  const admins = await AdminProfile.find({}).select("_id email displayName role");
  console.log(`=== Admin accounts (${admins.length}) ===`);
  admins.forEach((a) => {
    console.log(`  ${a._id.toString()}  ${a.email}  [${a.role}]  ${a.displayName}`);
  });
  const validIds = new Set(admins.map((a) => a._id.toString()));

  const products = await Product.find({}).select("_id name dealerId dealerEmail stock variants");
  console.log(`\n=== Products (${products.length}) ===`);
  products.forEach((p) => {
    const owner = validIds.has(String(p.dealerId)) ? "OK" : "ORPHAN";
    const variantCount = Array.isArray(p.variants) ? p.variants.length : 0;
    console.log(
      `  [${owner}] ${p._id.toString()}  "${p.name}"  dealerId=${p.dealerId}  email=${p.dealerEmail}  stock=${p.stock}  variants=${variantCount}`
    );
  });

  const orphans = products.filter((p) => !validIds.has(String(p.dealerId)));
  console.log(`\n=== Summary ===`);
  console.log(`  Total products: ${products.length}`);
  console.log(`  Orphaned (owner is not a real admin): ${orphans.length}`);
  console.log(`  Properly owned: ${products.length - orphans.length}`);

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error("Inspection failed:", err.message);
  process.exit(1);
});
