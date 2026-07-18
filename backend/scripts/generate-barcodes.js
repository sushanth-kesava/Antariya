/**
 * Script: Auto-generate barcodes for all existing products
 * 
 * Run: node scripts/generate-barcodes.js
 * 
 * This will:
 * 1. Find all products that don't have barcodes yet
 * 2. Auto-assign SKU if missing
 * 3. Generate Code-128 barcode + QR code for each product
 * 4. Assign to the default warehouse
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDb } = require('../src/config/db');
const env = require('../src/config/env');
const Product = require('../src/models/Product');
const Barcode = require('../src/models/Barcode');
const Warehouse = require('../src/models/Warehouse');
const BarcodeService = require('../src/services/barcode.service');
const AdminProfile = require('../src/models/AdminProfile');

async function generateBarcodesForExistingProducts() {
  try {
    await connectDb(env.mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get default warehouse
    // The system creates a warehouse with code:"DEFAULT" (not isDefault:true)
    const defaultWarehouse = await Warehouse.findOne({ code: "DEFAULT" }) || await Warehouse.findOne({ isDefault: true }) || await Warehouse.findOne({});
    if (!defaultWarehouse) {
      console.error('❌ No default warehouse found. Please create one first.');
      process.exit(1);
    }
    console.log(`📦 Using warehouse: ${defaultWarehouse.name} (${defaultWarehouse._id})\n`);

    // Get a superadmin/admin profile to use as createdBy
    const systemUser = await AdminProfile.findOne({ role: { $in: ['superadmin', 'admin'] } }).select('_id');
    if (!systemUser) {
      console.error('❌ No admin/superadmin user found. Please create one first.');
      process.exit(1);
    }
    console.log(`👤 Using system user: ${systemUser._id}\n`);

    // Get all active products
    const allProducts = await Product.find({}).select('_id name sku');
    console.log(`📋 Total products in database: ${allProducts.length}`);

    // Find products that already have barcodes
    const productsWithBarcodes = await Barcode.distinct('productId');
    const productsWithBarcodesSet = new Set(productsWithBarcodes.map(id => id.toString()));

    // Filter to products without barcodes
    const productsNeedingBarcodes = allProducts.filter(
      p => !productsWithBarcodesSet.has(p._id.toString())
    );

    console.log(`🔍 Products already having barcodes: ${productsWithBarcodes.length}`);
    console.log(`⚡ Products needing barcodes: ${productsNeedingBarcodes.length}\n`);

    if (productsNeedingBarcodes.length === 0) {
      console.log('✅ All products already have barcodes! Nothing to do.');
      process.exit(0);
    }

    let success = 0;
    let errors = 0;
    const errorDetails = [];

    for (const product of productsNeedingBarcodes) {
      try {
        await BarcodeService.generateBarcode({
          productId: product._id,
          warehouseId: defaultWarehouse._id,
          variantId: null,
          userId: systemUser._id
        });

        success++;
        if (success % 10 === 0) {
          process.stdout.write(`\r  Generated: ${success}/${productsNeedingBarcodes.length}`);
        }
      } catch (err) {
        errors++;
        errorDetails.push({ productId: product._id, name: product.name, error: err.message });
      }
    }

    console.log(`\n\n${'═'.repeat(50)}`);
    console.log(`✅ COMPLETE`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`  Barcodes generated: ${success}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Total barcodes now: ${productsWithBarcodes.length + success * 2} (Code128 + QR per product)`);

    if (errorDetails.length > 0) {
      console.log(`\n⚠️  Failed products:`);
      errorDetails.slice(0, 10).forEach(e => {
        console.log(`  - ${e.name || e.productId}: ${e.error}`);
      });
      if (errorDetails.length > 10) {
        console.log(`  ... and ${errorDetails.length - 10} more`);
      }
    }

    console.log('\nDone! Barcodes are ready to print from the Superadmin → Barcode & QR module.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

generateBarcodesForExistingProducts();
