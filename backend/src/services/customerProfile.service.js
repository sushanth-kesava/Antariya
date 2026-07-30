const CustomerProfile = require("../models/CustomerProfile");

/**
 * Ensure a CustomerProfile exists for a given customer User.
 *
 * Idempotent upsert keyed on userId — safe to call on every login/signup.
 * `$setOnInsert` means an existing profile is never overwritten; only a
 * missing one is created. Returns the profile document (or null on failure).
 *
 * This is the single source of truth for profile creation so the User and
 * CustomerProfile collections stay in sync (fixes the count drift where some
 * customer Users had no CustomerProfile).
 *
 * @param {Object} user - a User mongoose doc (or plain object) with _id/email.
 * @param {Object} [opts]
 * @param {boolean} [opts.throwOnError=false] - rethrow instead of swallowing.
 */
async function ensureCustomerProfile(user, { throwOnError = false } = {}) {
  if (!user || !user._id || !user.email) {
    return null;
  }

  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $setOnInsert: {
          userId: user._id,
          email: String(user.email).trim().toLowerCase(),
          displayName: user.displayName || "",
          photoURL: user.photoURL || null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return profile;
  } catch (error) {
    // Duplicate-key (11000) means a profile already exists for this email/
    // userId — that's fine, treat as success.
    if (error && error.code === 11000) {
      return CustomerProfile.findOne({ userId: user._id }).catch(() => null);
    }
    console.error("[CustomerProfile] ensureCustomerProfile failed:", error.message || error);
    if (throwOnError) throw error;
    return null;
  }
}

module.exports = { ensureCustomerProfile };
