const CustomerProfile = require("../models/CustomerProfile");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");

// GET /api/customer/profile
async function getCustomerProfile(req, res, next) {
  try {
    const userId = req.auth?.sub;

    let profile = await CustomerProfile.findOne({ userId });

    // Auto-create profile if it doesn't exist yet (lazy init)
    if (!profile) {
      // Look up the identity in both collections: regular shoppers live in
      // `User`, while admins and superadmins live in `AdminProfile`. Checking
      // both means the profile panel works for every role.
      const account =
        (await User.findById(userId).lean()) ||
        (await AdminProfile.findById(userId).lean());

      if (!account) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      profile = await CustomerProfile.create({
        userId: account._id,
        email: account.email,
        displayName: account.displayName || "",
        photoURL: account.photoURL || null,
      });
    }

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    return next(error);
  }
}

// PUT /api/customer/profile
async function updateCustomerProfile(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const { displayName, phone, gender, dateOfBirth, preferences } = req.body;

    const update = {};
    if (displayName !== undefined) update.displayName = String(displayName).trim();
    if (phone !== undefined) update.phone = String(phone).trim() || null;
    if (gender !== undefined) update.gender = gender || null;
    if (dateOfBirth !== undefined) update.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (preferences !== undefined) {
      if (Array.isArray(preferences.categories)) update["preferences.categories"] = preferences.categories;
      if (typeof preferences.newsletter === "boolean") update["preferences.newsletter"] = preferences.newsletter;
      if (typeof preferences.smsAlerts === "boolean") update["preferences.smsAlerts"] = preferences.smsAlerts;
    }

    const profile = await CustomerProfile.findOneAndUpdate(
      { userId },
      { $set: update },
      { new: true, upsert: false, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ success: false, message: "Customer profile not found. Fetch profile first to initialise it." });
    }

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    return next(error);
  }
}

// POST /api/customer/profile/address
async function addAddress(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const { label, line1, line2, city, state, pincode, isDefault } = req.body;

    if (!line1 || !city || !pincode) {
      return res.status(400).json({ success: false, message: "line1, city, and pincode are required." });
    }

    const profile = await CustomerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Customer profile not found." });
    }

    // If new address is default, unset all others
    if (isDefault) {
      profile.addresses.forEach((addr) => { addr.isDefault = false; });
    }

    profile.addresses.push({ label: label || "Home", line1, line2: line2 || "", city, state: state || "", pincode, isDefault: Boolean(isDefault) });
    await profile.save();

    return res.status(201).json({ success: true, addresses: profile.addresses });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/customer/profile/address/:addressId
async function removeAddress(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const { addressId } = req.params;

    const profile = await CustomerProfile.findOneAndUpdate(
      { userId },
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ success: false, message: "Customer profile not found." });
    }

    return res.status(200).json({ success: true, addresses: profile.addresses });
  } catch (error) {
    return next(error);
  }
}

// POST /api/customer/profile/complete
// One-shot onboarding submission: personal info + default shipping address +
// delivery preferences + notification opt-ins. Validates server-side, creates
// the first default address, and lets the pre-save hook set profileComplete.
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;

function normalizePhone(value) {
  // Accept formats like +91 98765 43210, 09876543210, 9876543210 -> 10 digits.
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

async function completeProfile(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const {
      fullName,
      email,
      phone,
      dateOfBirth,
      gender,
      address = {},
      useSamePhone,
      alternatePhone,
      addressType,
      deliveryInstructions,
      whatsappOptIn,
      promotionalEmails,
    } = req.body || {};

    // --- Validation -------------------------------------------------------
    const errors = {};
    const trimmedName = String(fullName || "").trim();
    if (!trimmedName) errors.fullName = "Full name is required.";

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) errors.phone = "Mobile number is required.";
    else if (!INDIAN_PHONE_RE.test(normalizedPhone)) errors.phone = "Enter a valid 10-digit Indian mobile number.";

    const line1 = String(address.line1 || "").trim();
    if (!line1) errors["address.line1"] = "Address line 1 is required.";

    const state = String(address.state || "").trim();
    if (!state) errors["address.state"] = "State is required.";

    const city = String(address.city || "").trim();
    if (!city) errors["address.city"] = "City is required.";

    const country = String(address.country || "India").trim() || "India";

    const pincode = String(address.pincode || "").trim();
    if (!pincode) errors["address.pincode"] = "PIN code is required.";
    else if (!PINCODE_RE.test(pincode)) errors["address.pincode"] = "PIN code must be exactly 6 digits.";

    let altPhone = "";
    if (!useSamePhone && alternatePhone) {
      altPhone = normalizePhone(alternatePhone);
      if (altPhone && !INDIAN_PHONE_RE.test(altPhone)) {
        errors.alternatePhone = "Enter a valid 10-digit Indian mobile number.";
      }
    }

    const normalizedType = ["Home", "Office", "Other"].includes(addressType) ? addressType : "Home";
    const normalizedGender = ["male", "female", "other"].includes(gender) ? gender : null;

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
    }

    // --- Load or lazily create the profile --------------------------------
    let profile = await CustomerProfile.findOne({ userId });
    if (!profile) {
      const account =
        (await User.findById(userId).lean()) ||
        (await AdminProfile.findById(userId).lean());
      if (!account) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
      profile = await CustomerProfile.create({
        userId: account._id,
        email: account.email,
        displayName: account.displayName || "",
        photoURL: account.photoURL || null,
      });
    }

    // --- Apply personal info ---------------------------------------------
    profile.displayName = trimmedName;
    profile.phone = normalizedPhone;
    if (dateOfBirth) profile.dateOfBirth = new Date(dateOfBirth);
    profile.gender = normalizedGender;
    // Email is verified at the account level; allow an editable override.
    if (email && String(email).trim()) profile.email = String(email).trim().toLowerCase();

    // --- Preferences ------------------------------------------------------
    profile.preferences.whatsappOptIn = Boolean(whatsappOptIn);
    profile.preferences.newsletter = Boolean(promotionalEmails);

    // --- Default shipping address ----------------------------------------
    // Mark all existing addresses non-default, then push this as the default.
    profile.addresses.forEach((addr) => { addr.isDefault = false; });
    profile.addresses.push({
      label: normalizedType,
      addressType: normalizedType,
      line1,
      line2: String(address.line2 || "").trim(),
      landmark: String(address.landmark || "").trim(),
      city,
      state,
      country,
      pincode,
      alternatePhone: useSamePhone ? "" : altPhone,
      deliveryInstructions: String(deliveryInstructions || "").trim(),
      isDefault: true,
    });

    // profileComplete is auto-set by the pre-save hook (name + phone + address).
    await profile.save();

    return res.status(200).json({ success: true, message: "Profile completed successfully!", profile });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getCustomerProfile, updateCustomerProfile, addAddress, removeAddress, completeProfile };
