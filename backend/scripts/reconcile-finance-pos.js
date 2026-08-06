/**
 * Reconcile finance transactions against live POS invoices.
 *
 *   node scripts/reconcile-finance-pos.js            # apply fixes
 *   DRY_RUN=1 node scripts/reconcile-finance-pos.js  # report only, no writes
 *   npm run db:reconcile-finance
 *
 * Why: historically, when a POS sale was cancelled or fully returned, its
 * POS invoice status changed (so it dropped off the Dashboard) but the linked
 * FinanceTransaction (type 'payment_received') was NOT voided — so the Finance
 * page kept counting it, inflating revenue.
 *
 * This script voids (soft-deletes, status='cancelled') any POS-linked
 * 'payment_received' transaction whose invoice is:
 *   - cancelled, OR
 *   - missing (invoice deleted), OR
 *   - fully returned.
 * It NEVER hard-deletes. Idempotent & safe to re-run.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");

const FinanceTransaction = require("../src/models/FinanceTransaction");
const POSInvoice = require("../src/models/POSInvoice");

async function main() {
  const uri = env.mongoUri || process.env.MONGODB_URI;
  if (!uri) { console.error("MONGODB_URI is not set."); process.exit(1); }
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  console.log("Connecting:", uri.replace(/\/\/[^@]*@/, "//<redacted>@"));
  await mongoose.connect(uri);
  console.log(`Connected.${dryRun ? " [DRY RUN — no writes]" : ""}`);

  // All POS-linked revenue transactions that are still "live" (not already voided).
  const txns = await FinanceTransaction.find({
    type: "payment_received",
    referenceType: "order",
    status: { $nin: ["cancelled", "rejected"] },
  });
  console.log(`Live POS-linked payment transactions: ${txns.length}`);

  let voided = 0;
  let kept = 0;
  const toVoid = [];

  for (const txn of txns) {
    const invoice = txn.referenceId ? await POSInvoice.findById(txn.referenceId) : null;
    let reason = null;

    if (!invoice) {
      reason = "linked POS invoice no longer exists";
    } else if (invoice.status === "cancelled") {
      reason = "POS invoice cancelled";
    } else if (invoice.status === "returned") {
      reason = "POS invoice fully returned";
    }

    if (reason) {
      toVoid.push({ txn, reason, invoiceNumber: invoice?.invoiceNumber || txn.referenceNumber });
    } else {
      kept++;
    }
  }

  console.log(`\nOrphan/void-worthy transactions: ${toVoid.length}, healthy: ${kept}\n`);
  for (const { txn, reason, invoiceNumber } of toVoid) {
    console.log(`  ${dryRun ? "[would void]" : "[voiding]"} ${txn.transactionNumber} ` +
      `(${invoiceNumber || "?"}) ₹${txn.netAmount} — ${reason}`);
    if (!dryRun) {
      txn.status = "cancelled";
      txn.paymentStatus = "cancelled";
      txn.notes = txn.notes ? `${txn.notes}\n[Reconciled] ${reason}` : `[Reconciled] ${reason}`;
      await txn.save();
      voided++;
    }
  }

  // Report the reconciled revenue figure.
  const activeAgg = await FinanceTransaction.aggregate([
    { $match: { type: { $in: ["invoice", "payment_received"] }, status: { $nin: ["cancelled", "rejected"] } } },
    { $group: { _id: null, net: { $sum: "$netAmount" }, paid: { $sum: "$paidAmount" } } },
  ]);
  const posAgg = await POSInvoice.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
  ]);

  console.log(`\n── Reconciliation summary ─────────────────────────`);
  console.log(`  ${dryRun ? "Would void" : "Voided"}: ${dryRun ? toVoid.length : voided}`);
  console.log(`  Finance active revenue (net):  ₹${activeAgg[0]?.net || 0}`);
  console.log(`  Finance active revenue (paid): ₹${activeAgg[0]?.paid || 0}`);
  console.log(`  Live POS invoices: ${posAgg[0]?.count || 0} = ₹${posAgg[0]?.total || 0}`);
  console.log(`───────────────────────────────────────────────────`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => { console.error("Reconciliation failed:", err); process.exit(1); });
