const SiteContent = require("../models/SiteContent");

async function getAboutPageContent(req, res, next) {
  try {
    const content = await SiteContent.findOne({ key: "about" }).lean();

    if (!content) {
      const created = await SiteContent.create({ key: "about" });
      return res.status(200).json({ success: true, content: created });
    }

    return res.status(200).json({ success: true, content });
  } catch (error) {
    return next(error);
  }
}

async function updateAboutPageContent(req, res, next) {
  try {
    if (req.auth?.role !== "admin" && req.auth?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { heroTitle, heroSubtitle, storyTitle, storyBody, teamMembers, contactEmail, contactPhone, whatsapp } = req.body || {};

    const updatePayload = {};
    if (typeof heroTitle === "string") updatePayload.heroTitle = heroTitle;
    if (typeof heroSubtitle === "string") updatePayload.heroSubtitle = heroSubtitle;
    if (typeof storyTitle === "string") updatePayload.storyTitle = storyTitle;
    if (Array.isArray(storyBody)) updatePayload.storyBody = storyBody.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
    if (Array.isArray(teamMembers)) updatePayload.teamMembers = teamMembers.slice(0, 12).map((member) => ({
      name: String(member?.name || "").trim(),
      role: String(member?.role || "").trim(),
      email: String(member?.email || "").trim(),
      phone: String(member?.phone || "").trim(),
      bio: String(member?.bio || "").trim(),
      imageUrl: String(member?.imageUrl || "").trim(),
    }));
    if (typeof contactEmail === "string") updatePayload.contactEmail = contactEmail;
    if (typeof contactPhone === "string") updatePayload.contactPhone = contactPhone;
    if (typeof whatsapp === "string") updatePayload.whatsapp = whatsapp;

    updatePayload.updatedBy = req.auth?.email || req.auth?.sub || "admin";

    const content = await SiteContent.findOneAndUpdate(
      { key: "about" },
      { $set: updatePayload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, content });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAboutPageContent,
  updateAboutPageContent,
};
