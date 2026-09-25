/**
 * Quick lookup: find a user by email and print their _id
 * for use in manual order recovery.
 *
 *   EMAIL=jasmithaa16@gmail.com node scripts/lookup-user-for-recovery.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");
const User = require("../src/models/User");

async function main() {
  const email = (process.env.EMAIL || "").trim().toLowerCase();
  if (!email) { console.error("Set EMAIL=... env var"); process.exit(1); }

  await mongoose.connect(env.mongoUri);
  const user = await User.findOne({ email }).lean();

  if (!user) {
    console.log(`No user found for: ${email}`);
    console.log("She may not have a registered account — check if she checked out as guest.");
  } else {
    console.log(`\nUser found:`);
    console.log(`  _id       : ${user._id}`);
    console.log(`  email     : ${user.email}`);
    console.log(`  name      : ${user.displayName || "(none)"}`);
    console.log(`  role      : ${user.role}`);
    console.log(`  createdAt : ${user.createdAt}`);
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
