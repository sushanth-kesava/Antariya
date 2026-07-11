const CustomerProfile = require("../models/CustomerProfile");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const AccessRequest = require("../models/AccessRequest");

// Max saved addresses per user, and the cooldown between edits to core
// identity details (name / gender / date of birth).
const MAX_ADDRESSES = 5;
const EDIT_COOLDOWN_DAYS = 15;
const EDIT_COOLDOWN_MS = EDIT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function daysRemaining(lastEditAt) {
  if (!lastEditAt) return 0;
  const elapsed = Date.now() - new Date(lastEditAt).getTime();
  const remaining = EDIT_COOLDOWN_MS - elapsed;
  return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

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
// Edits to core identity details (name / gender / date of birth) are subject
// to a 15-day cooldown. Phone and email are NOT editable here. Notification
// preferences can be changed anytime (not cooldown-gated).
async function updateCustomerProfile(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const { displayName, gender, dateOfBirth, preferences } = req.body;

    const profile = await CustomerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Customer profile not found. Fetch profile first to initialise it." });
    }

    // Determine whether any cooldown-gated identity field is actually changing.
    const nextName = displayName !== undefined ? String(displayName).trim() : profile.displayName;
    const nextGender = gender !== undefined ? (gender || null) : profile.gender;
    const nextDob = dateOfBirth !== undefined ? (dateOfBirth ? new Date(dateOfBirth) : null) : profile.dateOfBirth;

    const currentDobIso = profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString() : null;
    const nextDobIso = nextDob ? new Date(nextDob).toISOString() : null;

    const identityChanged =
      nextName !== profile.displayName ||
      nextGender !== profile.gender ||
      nextDobIso !== currentDobIso;

    if (identityChanged) {
      if (!nextName) {
        return res.status(400).json({ success: false, message: "Full name cannot be empty." });
      }
      const remaining = daysRemaining(profile.lastProfileEditAt);
      if (remaining > 0) {
        return res.status(429).json({
          success: false,
          code: "EDIT_COOLDOWN",
          message: `You can edit your profile details again in ${remaining} day${remaining === 1 ? "" : "s"}.`,
          daysRemaining: remaining,
          nextEditAllowedAt: new Date(new Date(profile.lastProfileEditAt).getTime() + EDIT_COOLDOWN_MS),
        });
      }
      profile.displayName = nextName;
      profile.gender = nextGender;
      profile.dateOfBirth = nextDob;
      profile.lastProfileEditAt = new Date();
    }

    // Preferences are always editable (no cooldown).
    if (preferences !== undefined) {
      if (Array.isArray(preferences.categories)) profile.preferences.categories = preferences.categories;
      if (typeof preferences.newsletter === "boolean") profile.preferences.newsletter = preferences.newsletter;
      if (typeof preferences.smsAlerts === "boolean") profile.preferences.smsAlerts = preferences.smsAlerts;
      if (typeof preferences.whatsappOptIn === "boolean") profile.preferences.whatsappOptIn = preferences.whatsappOptIn;
    }

    await profile.save();
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    return next(error);
  }
}

// Validate and normalize an address payload. Returns { value } or { error }.
function buildAddressPayload(body) {
  const line1 = String(body.line1 || "").trim();
  const city = String(body.city || "").trim();
  const state = String(body.state || "").trim();
  const pincode = String(body.pincode || "").trim();

  if (!line1) return { error: "Address line 1 is required." };
  if (!city) return { error: "City is required." };
  if (!state) return { error: "State is required." };
  if (!pincode) return { error: "PIN code is required." };
  if (!PINCODE_RE.test(pincode)) return { error: "PIN code must be exactly 6 digits." };

  const addressType = ["Home", "Office", "Other"].includes(body.addressType) ? body.addressType : "Home";
  let altPhone = "";
  if (body.alternatePhone) {
    altPhone = normalizePhone(body.alternatePhone);
    if (altPhone && !INDIAN_PHONE_RE.test(altPhone)) {
      return { error: "Enter a valid 10-digit Indian alternate mobile number." };
    }
  }

  return {
    value: {
      label: addressType,
      addressType,
      line1,
      line2: String(body.line2 || "").trim(),
      landmark: String(body.landmark || "").trim(),
      city,
      state,
      country: String(body.country || "India").trim() || "India",
      pincode,
      alternatePhone: altPhone,
      deliveryInstructions: String(body.deliveryInstructions || "").trim(),
    },
  };
}

// POST /api/customer/profile/address
async function addAddress(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const { isDefault } = req.body;

    const profile = await CustomerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Customer profile not found." });
    }

    if (profile.addresses.length >= MAX_ADDRESSES) {
      return res.status(409).json({
        success: false,
        code: "ADDRESS_LIMIT",
        message: `You can save up to ${MAX_ADDRESSES} addresses. Please remove one before adding another.`,
      });
    }

    const { value, error } = buildAddressPayload(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    // First address is always default; otherwise honor the flag.
    const makeDefault = profile.addresses.length === 0 || Boolean(isDefault);
    if (makeDefault) {
      profile.addresses.forEach((addr) => { addr.isDefault = false; });
    }

    profile.addresses.push({ ...value, isDefault: makeDefault });
    await profile.save();

    return res.status(201).json({ success: true, addresses: profile.addresses });
  } catch (error) {
    return next(error);
  }
}

// PUT /api/customer/profile/address/:addressId
async function updateAddress(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const { addressId } = req.params;
    const { isDefault } = req.body;

    const profile = await CustomerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Customer profile not found." });
    }

    const addr = profile.addresses.id(addressId);
    if (!addr) {
      return res.status(404).json({ success: false, message: "Address not found." });
    }

    const { value, error } = buildAddressPayload(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    Object.assign(addr, value);

    if (isDefault) {
      profile.addresses.forEach((a) => { a.isDefault = false; });
      addr.isDefault = true;
    }
    // Guarantee at least one default remains.
    if (!profile.addresses.some((a) => a.isDefault) && profile.addresses.length > 0) {
      profile.addresses[0].isDefault = true;
    }

    await profile.save();
    return res.status(200).json({ success: true, addresses: profile.addresses });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/customer/profile/address/:addressId/default
async function setDefaultAddress(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const { addressId } = req.params;

    const profile = await CustomerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Customer profile not found." });
    }
    const addr = profile.addresses.id(addressId);
    if (!addr) {
      return res.status(404).json({ success: false, message: "Address not found." });
    }

    profile.addresses.forEach((a) => { a.isDefault = false; });
    addr.isDefault = true;
    await profile.save();

    return res.status(200).json({ success: true, addresses: profile.addresses });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/customer/profile/address/:addressId
async function removeAddress(req, res, next) {
  try {
    const userId = req.auth?.sub;
    const { addressId } = req.params;

    const profile = await CustomerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Customer profile not found." });
    }

    const addr = profile.addresses.id(addressId);
    if (!addr) {
      return res.status(404).json({ success: false, message: "Address not found." });
    }

    const wasDefault = addr.isDefault;
    addr.deleteOne();

    // If we removed the default, promote the first remaining address.
    if (wasDefault && profile.addresses.length > 0 && !profile.addresses.some((a) => a.isDefault)) {
      profile.addresses[0].isDefault = true;
    }

    await profile.save();
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

// GET /api/customer/profile/business
// Returns the business/application details an admin submitted during admin
// approval. Matched by the authenticated user's email against the approved
// admin_approval AccessRequest. Returns null for non-admins or if no
// application is found (the frontend simply hides the section then).
async function getBusinessDetails(req, res, next) {
  try {
    const role = String(req.auth?.role || "").toLowerCase();
    if (role !== "admin" && role !== "superadmin") {
      return res.status(200).json({ success: true, business: null });
    }

    const email = String(req.auth?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(200).json({ success: true, business: null });
    }

    // Prefer an approved application; fall back to the most recent one so the
    // admin can still see what they submitted even if status bookkeeping lags.
    const request =
      (await AccessRequest.findOne({
        requestType: "admin_approval",
        status: "approved",
        $or: [{ targetEmail: email }, { requestedByEmail: email }],
      }).sort({ reviewedAt: -1, updatedAt: -1 })) ||
      (await AccessRequest.findOne({
        requestType: "admin_approval",
        $or: [{ targetEmail: email }, { requestedByEmail: email }],
      }).sort({ createdAt: -1 }));

    if (!request || !request.applicationDetails) {
      return res.status(200).json({ success: true, business: null });
    }

    return res.status(200).json({
      success: true,
      business: {
        ...(request.applicationDetails.toObject ? request.applicationDetails.toObject() : request.applicationDetails),
        status: request.status,
        submittedAt: request.createdAt,
        reviewedAt: request.reviewedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// PUT /api/customer/profile/business
// Lets an admin fill in business/application fields they left BLANK during
// admin approval. Fields that were already submitted (non-empty) are locked
// and never overwritten here — only empty/null fields are updated. Values are
// written back to the same AccessRequest.applicationDetails document.
const EDITABLE_BUSINESS_FIELDS = [
  "businessName",
  "businessType",
  "businessAddress",
  "website",
  "panNumber",
  "aadharNumber",
  "gstNumber",
  "notes",
];

async function updateBusinessDetails(req, res, next) {
  try {
    const role = String(req.auth?.role || "").toLowerCase();
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Admin access required." });
    }

    const email = String(req.auth?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Account email missing." });
    }

    const request =
      (await AccessRequest.findOne({
        requestType: "admin_approval",
        status: "approved",
        $or: [{ targetEmail: email }, { requestedByEmail: email }],
      }).sort({ reviewedAt: -1, updatedAt: -1 })) ||
      (await AccessRequest.findOne({
        requestType: "admin_approval",
        $or: [{ targetEmail: email }, { requestedByEmail: email }],
      }).sort({ createdAt: -1 }));

    if (!request) {
      return res.status(404).json({ success: false, message: "No admin application found for your account." });
    }

    if (!request.applicationDetails) {
      request.applicationDetails = {};
    }

    // Only fill fields that are currently empty; never overwrite submitted data.
    const filled = [];
    const locked = [];
    for (const field of EDITABLE_BUSINESS_FIELDS) {
      const incoming = req.body?.[field];
      if (incoming === undefined) continue;
      const current = request.applicationDetails[field];
      const currentEmpty = current === null || current === undefined || String(current).trim() === "";
      const incomingValue = String(incoming).trim();
      if (!incomingValue) continue;
      if (currentEmpty) {
        request.applicationDetails[field] = incomingValue;
        filled.push(field);
      } else {
        locked.push(field);
      }
    }

    if (filled.length === 0) {
      return res.status(200).json({
        success: true,
        message: locked.length > 0 ? "Those fields were already submitted and cannot be changed here." : "No changes to save.",
        business: {
          ...(request.applicationDetails.toObject ? request.applicationDetails.toObject() : request.applicationDetails),
          status: request.status,
          submittedAt: request.createdAt,
          reviewedAt: request.reviewedAt,
        },
      });
    }

    request.markModified("applicationDetails");
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Business details updated.",
      business: {
        ...(request.applicationDetails.toObject ? request.applicationDetails.toObject() : request.applicationDetails),
        status: request.status,
        submittedAt: request.createdAt,
        reviewedAt: request.reviewedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getCustomerProfile, updateCustomerProfile, addAddress, updateAddress, setDefaultAddress, removeAddress, completeProfile, getBusinessDetails, updateBusinessDetails };
