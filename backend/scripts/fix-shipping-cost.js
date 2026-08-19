/**
 * Migration: Fix shipping cost on existing orders (99 → 49)
 * 
 * Run from the backend folder:
 *   node scripts/fix-shipping-cost.js
 * 
 * This updates all orders where shipping = 99:
 *   - Sets shipping to 49
 *   - Reduces total by 50
 *   - Adjusts amountDueOnDelivery if applicable
 */

require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");

const OLD_SHIPPING = 99;
const NEW_SHIPPING = 49;
const DIFF = OLD_SHIPPING - NEW_SHIPPING; // 50

async function run() {
  await mongoose.connect(env.mongoUri, { autoIndex: false });
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const ordersCollection = db.collection("orders");

  // Find all orders with shipping = 99
  const affectedOrders = await ordersCollection.find({ shipping: OLD_SHIPPING }).toArray();
  console.log(`Found ${affectedOrders.length} orders with shipping = ₹${OLD_SHIPPING}`);

  if (affectedOrders.length === 0) {
    console.log("Nothing to update.");
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const order of affectedOrders) {
    const newTotal = Math.round(Number(order.total || 0) - DIFF);
    const update = {
      $set: {
        shipping: NEW_SHIPPING,
        total: newTotal,
      },
    };

    // If COD order with amountDueOnDelivery, reduce that too
    if (Number(order.amountDueOnDelivery || 0) > 0) {
      update.$set.amountDueOnDelivery = Math.max(0, Number(order.amountDueOnDelivery) - DIFF);
    }

    await ordersCollection.updateOne({ _id: order._id }, update);
    updated++;
    console.log(`  ✓ Order ${order._id} — total: ₹${order.total} → ₹${newTotal}`);
  }

  console.log(`\n✅ Updated ${updated} orders (shipping: ₹${OLD_SHIPPING} → ₹${NEW_SHIPPING})`);

  // Also update FinanceTransactions that reference these orders
  const financeCollection = db.collection("financetransactions");
  const orderIds = affectedOrders.map((o) => o._id);
  
  const financeTxns = await financeCollection.find({
    referenceType: "order",
    referenceId: { $in: orderIds },
    subCategory: "marketplace_sale",
  }).toArray();

  if (financeTxns.length > 0) {
    for (const txn of financeTxns) {
      const newNet = Math.round(Number(txn.netAmount || 0) - DIFF);
      const newPaid = Math.round(Number(txn.paidAmount || 0) - DIFF);
      await financeCollection.updateOne({ _id: txn._id }, {
        $set: { netAmount: newNet, paidAmount: newPaid },
      });
    }
    console.log(`✅ Updated ${financeTxns.length} finance transactions`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
