/**
 * One-time (idempotent) migration to the warehouse-based inventory model.
 *
 *   node scripts/migrate-inventory.js
 *
 * What it does:
 *   1. Ensures a DEFAULT warehouse exists.
 *   2. For every Product, creates Inventory rows in the DEFAULT warehouse:
 *        - one row per variant (variantSku = variant.sku) using variant.stock
 *        - OR a single row (variantSku = "") using product.stock when no variants
 *      Existing rows are left untouched (safe to re-run).
 *   3. Writes an "import" ledger entry for each row it creates.
 *
 * It NEVER deletes anything and never lowers stock. Re-running only fills gaps.
 */
require("dotenv").config();
const mongoose = require("mongoose");
// Use the SAME normalized connection the server uses (forces the DB name to
// "stitchmart"), so the migration writes to the database the app reads from.
const env = require("../src/config/env");

const Product = require("../src/models/Product");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const { InventoryLedger } = require("../src/models/InventoryLedger");

async function main() {
  const uri = env.mongoUri || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  console.log("Using database URI (normalized to app DB):", uri.replace(/\/\/[^@]*@/, "//<redacted>@"));
  await mongoose.connect(uri);
  console.log("Connected. Starting inventory migration...");

  // 1. DEFAULT warehouse
  let wh = await Warehouse.findOne({ code: "DEFAULT" });
  if (!wh) {
    wh = await Warehouse.create({
      code: "DEFAULT",
      name: "Primary Warehouse",
      isActive: true,
      priority: 0,
    });
    console.log("Created DEFAULT warehouse:", wh._id.toString());
  } else {
    console.log("DEFAULT warehouse already exists:", wh._id.toString());
  }

  const products = await Product.find({});
  console.log(`Scanning ${products.length} products...`);

  let rowsCreated = 0;
  let ledgersWritten = 0;

  for (const product of products) {
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const targets = hasVariants
      ? product.variants.map((v) => ({ sku: v.sku || "", stock: Number(v.stock) || 0, reorderPoint: Number(v.reorderPoint) || 0 }))
      : [{ sku: "", stock: Number(product.stock) || 0, reorderPoint: Number(product.reorderPoint) || 0 }];

    for (const t of targets) {
      const existing = await Inventory.findOne({ product: product._id, warehouse: wh._id, variantSku: t.sku });
      if (existing) continue;

      await Inventory.create({
        product: product._id,
        warehouse: wh._id,
        variantSku: t.sku,
        available: t.stock,
        reserved: 0,
        damaged: 0,
        returned: 0,
        incoming: 0,
        inTransit: 0,
        reorderPoint: t.reorderPoint,
      });
      rowsCreated += 1;

      await InventoryLedger.create({
        txnId: `migrate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        changeType: "import",
        product: product._id,
        productName: product.name,
        warehouse: wh._id,
        variantSku: t.sku,
        quantity: t.stock,
        moves: { available: t.stock },
        quantityBefore: 0,
        quantityAfter: t.stock,
        reason: "Initial migration from legacy flat stock",
        performedByRole: "system",
      });
      ledgersWritten += 1;
    }
  }

  console.log(`Migration complete. Inventory rows created: ${rowsCreated}, ledger entries: ${ledgersWritten}.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
