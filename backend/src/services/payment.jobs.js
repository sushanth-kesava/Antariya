const Razorpay = require("razorpay");
const Order = require("../models/Order");
const PendingOrder = require("../models/PendingOrder");
const env = require("../config/env");
const { fulfillPaidOrder } = require("./fulfillment.service");

// ---------------------------------------------------------------------------
// Payment reconciliation background job.
//
// Started from server.js (startPaymentJobs) once the DB is connected.
//
// What it does every hour:
//   1. Fetches all Razorpay payments with status=captured in the last 2h.
//   2. Finds any that don't have a matching Order in MongoDB.
//   3. For those that have a PendingOrder snapshot: auto-fulfills via
//      fulfillPaidOrder() (idempotent, same path as browser + webhook).
//   4. For those without a snapshot: logs loudly with the full payment detail
//      so the admin can manually create or refund them.
//
// This is the THIRD safety net — after the browser handler and the Razorpay
// webhook — and covers edge cases like:
//   - The webhook secret not yet configured.
//   - Razorpay's webhook delivery failed or was retried too late.
//   - The server was mid-deploy when payment.captured fired.
//
// The 2-hour lookback deliberately overlaps with the previous run so no payment
// can slip through a restart or a delayed Razorpay delivery.
// ---------------------------------------------------------------------------

// Scan the last LOOKBACK_HOURS hours of captured payments.
const LOOKBACK_HOURS = 2;
// Run every RUN_INTERVAL_MS (default 1 hour).
const RUN_INTERVAL_MS = 60 * 60 * 1000;

let reconcileTimer = null;

function getRazorpayClient() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) return null;
  return new Razorpay({ key_id: env.razorpayKeyId, key_secret=[REDACTED_PASSWORD] });
}

async function fetchCapturedPayments(client) {
  const toTs = Math.floor(Date.now() / 1000);
  const fromTs = toTs - LOOKBACK_HOURS * 3600;
  const all = [];
  let skip = 0;
  const count = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await client.payments.all({ from: fromTs, to: toTs, count, skip });
    const items = (page.items || []).filter((p) => p.status === "captured");
    all.push(...items);
    if ((page.items || []).length < count) break;
    skip += count;
    if (skip > 5000) break; // hard safety
  }
  return all;
}

async function runReconciliation() {
  const client = getRazorpayClient();
  if (!client) {
    // Razorpay not configured — skip silently (dev / staging env without keys).
    return;
  }

  let payments;
  try {
    payments = await fetchCapturedPayments(client);
  } catch (err) {
    console.error("[PaymentJobs] Razorpay API error during reconciliation:", err.message);
    return;
  }

  if (payments.length === 0) return;

  let fulfilled = 0;
  let alreadyOk = 0;
  let needsManual = 0;
  let errors = 0;

  for (const p of payments) {
    const razorpayOrderId = p.order_id;
    const razorpayPaymentId = p.id;
    if (!razorpayOrderId) continue;

    try {
      const existing = await Order.findOne({ razorpayOrderId }).select("_id").lean();
      if (existing) { alreadyOk += 1; continue; }

      const pending = await PendingOrder.findOne({ razorpayOrderId });
      if (!pending) {
        needsManual += 1;
        console.error(
          `[PaymentJobs] ⚠  Captured payment ${razorpayPaymentId} (${p.currency} ${(p.amount || 0) / 100})` +
          ` for order ${razorpayOrderId} has NO snapshot — needs manual recovery.` +
          ` Customer email: ${p.email || "(none)"}  Contact: ${p.contact || "(none)"}`
        );
        continue;
      }

      const { order, created } = await fulfillPaidOrder({
        auth: pending.auth,
        items: pending.items,
        couponCode: pending.couponCode,
        razorpayOrderId,
        razorpayPaymentId,
        source: "cron",
      });

      if (created) {
        fulfilled += 1;
        console.log(`[PaymentJobs] ✔ Auto-fulfilled order ${order.id} for ${razorpayOrderId} (${pending.auth.email})`);
      } else {
        alreadyOk += 1;
      }
    } catch (err) {
      errors += 1;
      console.error(`[PaymentJobs] ✗ Failed to reconcile ${razorpayOrderId}: ${err.message}`);
      PendingOrder.updateOne({ razorpayOrderId }, { $set: { lastError: err.message } }).catch(() => {});
    }
  }

  if (fulfilled > 0 || errors > 0 || needsManual > 0) {
    console.log(
      `[PaymentJobs] Reconciliation: ${payments.length} captured | ` +
      `${alreadyOk} ok | ${fulfilled} auto-fulfilled | ${needsManual} need manual | ${errors} errors`
    );
  }
}

/**
 * Start the payment reconciliation job. Call once from server.js after the
 * DB connection is established.
 */
function startPaymentJobs() {
  if (reconcileTimer) return; // already started

  // Run once immediately on startup to catch anything that fell through during
  // a deploy or restart, then on a regular interval.
  runReconciliation().catch((err) =>
    console.error("[PaymentJobs] Startup reconciliation failed:", err.message)
  );

  reconcileTimer = setInterval(() => {
    runReconciliation().catch((err) =>
      console.error("[PaymentJobs] Reconciliation cycle failed:", err.message)
    );
  }, RUN_INTERVAL_MS);

  console.log(`[PaymentJobs] Reconciliation job started (every ${RUN_INTERVAL_MS / 60000} min).`);
}

module.exports = { startPaymentJobs };
