const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    role: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    heroTitle: { type: String, default: "Empowering India's Embroidery Industry", trim: true },
    heroSubtitle: {
      type: String,
      default: "Transforming how embroidery professionals access premium digital assets, physical supplies, and machine solutions for their growing businesses.",
      trim: true,
    },
    storyTitle: { type: String, default: "Every Thread Has a Story", trim: true },
    storyBody: { type: [String], default: [] },
    teamMembers: { type: [teamMemberSchema], default: [] },
    contactEmail: { type: String, default: "antariyaofficial@gmail.com", trim: true, lowercase: true },
    contactPhone: { type: String, default: "+91 70132 96469", trim: true },
    whatsapp: { type: String, default: "https://wa.me/917013296469", trim: true },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.SiteContent || mongoose.model("SiteContent", siteContentSchema);
