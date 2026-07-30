/**
 * One-time (idempotent) backfill: create a CustomerProfile for every customer
 * User that is missing one.
 *
 *   node scripts/backfill-customer-profiles.js
 *   npm run db:backfill-profiles
 *
 * Why: the superadmin portal counts customer *Users*, but some older users
 * never got a CustomerProfile (profile creation used to only run for brand-new
 * users and was fire-and-forget). This reconciles the two collections.
 *
 * Safe: never deletes or overwrites. Only inserts missing profiles. Re-running
 * is a no-op once every customer has a profile.
 *
 * Add DRY_RUN=1 to only report what WOULD be created without writing.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");

const User = require("../src/models/User");
const CustomerProfile = require("../src/models/CustomerProfile");
const { ensureCustomerProfile } = require("../src/services/customerProfile.service");

async function main() {
  const uri = env.mongoUri || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  console.log("Connecting:", uri.replace(/\/\/[^@]*@/, "//<redacted>@"));
  await mongoose.connect(uri);
  console.log(`Connected.${dryRun ? " [DRY RUN — no writes]" : ""}`);

  // All customer users.
  const customerUsers = await User.find({ role: "customer" }).select("_id email displayName photoURL");
  console.log(`Customer Users: ${customerUsers.length}`);

  // Existing profiles (by userId) for a fast lookup.
  const existingProfiles = await CustomerProfile.find({}).select("userId email");
  const haveUserIds = new Set(existingProfiles.map((p) => String(p.userId)));
  const haveEmails = new Set(existingProfiles.map((p) => String(p.email || "").toLowerCase()));
  console.log(`Existing CustomerProfiles: ${existingProfiles.length}`);

  const missing = customerUsers.filter(
    (u) => !haveUserIds.has(String(u._id)) && !haveEmails.has(String(u.email || "").toLowerCase())
  );
  console.log(`Missing profiles to create: ${missing.length}`);

  if (missing.length === 0) {
    console.log("Nothing to backfill — collections are already in sync. ✅");
    await mongoose.disconnect();
    process.exit(0);
  }

  let created = 0;
  let failed = 0;
  for (const user of missing) {
    console.log(`  ${dryRun ? "[would create]" : "[creating]"} ${user.email}`);
    if (dryRun) continue;
    const profile = await ensureCustomerProfile(user, { throwOnError: false });
    if (profile) created += 1;
    else failed += 1;
  }

  console.log(
    `\nDone. ${dryRun ? `${missing.length} would be created.` : `Created: ${created}, Failed: ${failed}.`}`
  );

  // Post-check reconciliation summary.
  if (!dryRun) {
    const [users, profiles] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      CustomerProfile.countDocuments({}),
    ]);
    console.log(`Reconciliation → customer Users: ${users}, CustomerProfiles: ${profiles}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
