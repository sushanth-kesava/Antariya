const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home" },
    // "Home" | "Office" | "Other" — the delivery address type.
    addressType: { type: String, enum: ["Home", "Office", "Other"], default: "Home" },
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    landmark: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "India" },
    pincode: { type: String, default: "" },
    // Optional per-address delivery preferences / contact.
    alternatePhone: { type: String, default: "" },
    deliveryInstructions: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const customerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    displayName: { type: String, trim: true, default: "" },
    photoURL: { type: String, default: null },
    phone: { type: String, default: null, trim: true },
    gender: { type: String, enum: ["male", "female", "other", null], default: null },
    dateOfBirth: { type: Date, default: null },
    addresses: { type: [addressSchema], default: [] },
    preferences: {
      categories: { type: [String], default: [] },
      newsletter: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: false },
      whatsappOptIn: { type: Boolean, default: false },
    },
    membershipTier: {
      type: String,
      enum: ["new", "silver", "gold", "platinum"],
      default: "new",
    },
    totalOrders: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    lastOrderAt: { type: Date, default: null },
    profileComplete: { type: Boolean, default: false },
    // Timestamp of the last edit to core identity details (name/gender/DOB).
    // Used to enforce a 15-day cooldown between such edits. Null = never edited
    // via the profile page, so the first edit is always allowed.
    lastProfileEditAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "customer_profiles",
  }
);

// Auto-compute membershipTier based on totalSpend before save
customerProfileSchema.pre("save", function (next) {
  if (this.totalSpend >= 50000) {
    this.membershipTier = "platinum";
  } else if (this.totalSpend >= 15000) {
    this.membershipTier = "gold";
  } else if (this.totalSpend >= 3000) {
    this.membershipTier = "silver";
  } else {
    this.membershipTier = "new";
  }

  this.profileComplete = Boolean(
    this.displayName && this.phone && this.addresses.length > 0
  );

  next();
});

module.exports =
  mongoose.models.CustomerProfile ||
  mongoose.model("CustomerProfile", customerProfileSchema);
