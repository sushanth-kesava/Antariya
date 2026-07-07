const CustomerProfile = require("../models/CustomerProfile");
const User = require("../models/User");

// GET /api/customer/profile
async function getCustomerProfile(req, res, next) {
  try {
    const userId = req.auth?.sub;

    let profile = await CustomerProfile.findOne({ userId });

    // Auto-create profile if it doesn't exist yet (lazy init)
    if (!profile) {
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      profile = await CustomerProfile.create({
        userId: user._id,
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL || null,
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

module.exports = { getCustomerProfile, updateCustomerProfile, addAddress, removeAddress };
