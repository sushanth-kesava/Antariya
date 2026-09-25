/**
 * Reconcile captured Razorpay payments against orders in MongoDB.
 *
 *   node scripts/reconcile-razorpay-orders.js               # apply fixes (last 48h)
 *   DRY_RUN=1 node scripts/reconcile-razorpay-orders.js     # report only, no writes
 *   HOURS=168 node scripts/reconcile-razorpay-orders.js     # widen the lookback window
 *   npm run db:reconcile-razorpay
 *
 * Why: the ONLY moment an Order is written used to be the browser's Razorpay
 * success handler. If the customer's browser died right after paying (very
 * common on UPI app-switching, tab closes, dead network), Razorpay captured
 * the money but no Order was ever created — invisible to admin, superadmin
 * and the customer.
 *
 * This is the third safety net (after the browser handler and the webhook):
 * it walks every captured Razorpay payment in the lookback window and, for any
 * that has no matching Order, rebuilds the order from its PendingOrder
 * snapshot via the shared, idempotent fulfilment service.
 *
 *   - Payments WITH a PendingOrder snapshot  -> auto-fulfilled.
 *   - Payments WITHOUT a snapshot (created before this fix, e.g. the order
 *     that was already lost) -> reported in detail for MANUAL recovery,
 *     never guessed. The script prints everything Razorpay knows (amount,
 *     email, contact, notes) so you can create/refund it by hand.
 *
 * Idempotent & safe to re-run: fulfillPaidOrder keys off razorpayOrderId, so
 * an order that already exists is never duplicated.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const env = require("../src/config/env");

const Order = require("../src/models/Order");
const PendingOrder = require("../src/models/PendingOrder");
const { fulfillPaidOrder } = require("../src/services/fulfillment.service");

function rzp() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    console.error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
    process.exit(1);
  }
  return new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
}

// Page through payments captured within [from, to] (unix seconds).
async function fetchCapturedPayments(client, fromTs, toTs) {
  const all = [];
  const count = 100;
  let skip = 0;
  // Razorpay caps count at 100; loop until a short page.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await client.payments.all({ from: fromTs, to: toTs, count, skip });
    const items = page.items || [];
    all.push(...items);
    if (items.length < count) break;
    skip += count;
    if (skip > 10000) break; // hard safety stop
  }
  return all.filter((p) => p.status === "captured");
}

async function main() {
  const uri = env.mongoUri || process.env.MONGODB_URI;
  if (!uri) { console.error("MONGODB_URI is not set."); process.exit(1); }

  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const hours = Number(process.env.HOURS || 48);
  const toTs = Math.floor(Date.now() / 1000);
  const fromTs = toTs - hours * 3600;

  console.log("Connecting:", uri.replace(/\/\/[^@]*@/, "//<redacted>@"));
  await mongoose.connect(uri);
  console.log(`Connected.${dryRun ? " [DRY RUN — no writes]" : ""}`);
  console.log(`Scanning captured Razorpay payments from the last ${hours}h...`);

  const client = rzp();
  const payments = await fetchCapturedPayments(client, fromTs, toTs);
  console.log(`Found ${payments.length} captured payment(s) in window.`);

  const summary = { alreadyOk: 0, fulfilled: 0, needsManual: 0, errors: 0 };
  const manual = [];

  for (const p of payments) {
    const razorpayOrderId = p.order_id;
    const razorpayPaymentId = p.id;
    if (!razorpayOrderId) continue;

    const existing = await Order.findOne({ razorpayOrderId });
    if (existing) { summary.alreadyOk += 1; continue; }

    const pending = await PendingOrder.findOne({ razorpayOrderId });
    if (!pending) {
      summary.needsManual += 1;
      manual.push({
        razorpayOrderId,
        razorpayPaymentId,
        amount: (p.amount || 0) / 100,
        currency: p.currency,
        email: p.email || "",
        contact: p.contact || "",
        method: p.method || "",
        capturedAt: new Date((p.created_at || 0) * 1000).toISOString(),
        notes: p.notes || {},
      });
      continue;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would fulfil ${razorpayOrderId} (payment ${razorpayPaymentId}) for ${pending.auth.email}`);
      summary.fulfilled += 1;
      continue;
    }

    try {
      const { order, created } = await fulfillPaidOrder({
        auth: pending.auth,
        items: pending.items,
        couponCode: pending.couponCode,
        razorpayOrderId,
        razorpayPaymentId,
        source: "reconcile",
      });
      console.log(`✔ ${created ? "CREATED" : "already existed"} order ${order.id} for ${razorpayOrderId} (${pending.auth.email})`);
      summary.fulfilled += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(`✗ Failed to fulfil ${razorpayOrderId}: ${err.message}`);
      await PendingOrder.updateOne({ razorpayOrderId }, { $set: { lastError: err.message } }).catch(() => {});
    }
  }

  console.log("\n──────── Reconciliation summary ────────");
  console.log(`  Already had an order   : ${summary.alreadyOk}`);
  console.log(`  Auto-fulfilled${dryRun ? " (would)" : ""} : ${summary.fulfilled}`);
  console.log(`  Need MANUAL recovery   : ${summary.needsManual}`);
  console.log(`  Errors                 : ${summary.errors}`);

  if (manual.length > 0) {
    console.log("\n⚠  Captured payments with NO snapshot — recover these by hand:");
    for (const m of manual) {
      console.log("  ------------------------------------------------");
      console.log(`   Razorpay order   : ${m.razorpayOrderId}`);
      console.log(`   Razorpay payment : ${m.razorpayPaymentId}`);
      console.log(`   Amount           : ${m.currency} ${m.amount}`);
      console.log(`   Customer email   : ${m.email || "(none)"} `);
      console.log(`   Customer contact : ${m.contact || "(none)"} `);
      console.log(`   Method / captd   : ${m.method} @ ${m.capturedAt}`);
      console.log(`   Notes            : ${JSON.stringify(m.notes)}`);
    }
    console.log("\n  These predate the snapshot fix (or the snapshot write failed).");
    console.log("  Create the order manually in the admin panel, or refund from the");
    console.log("  Razorpay dashboard if it should not be fulfilled.");
  }

  await mongoose.disconnect();
  console.log("\nDone.");
  process.exit(summary.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
