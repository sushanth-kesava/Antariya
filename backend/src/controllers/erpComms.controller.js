/* eslint-disable no-unused-vars */
const crypto = require("crypto");
const EmailTemplate = require("../models/EmailTemplate");
const EmailCampaign = require("../models/EmailCampaign");
const NewsletterSubscriber = require("../models/NewsletterSubscriber");
const WaitlistSubscriber = require("../models/WaitlistSubscriber");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const EmailLog = require("../models/EmailLog");
const env = require("../config/env");
const { recordAudit } = require("../services/rbac.service");
const { sendBrandedEmail, hasMailConfig } = require("../services/mail.service");
const { enqueue } = require("../services/mail.queue");

function auditContext(req) {
  return {
    actorId: req.actor?.id || req.auth?.sub || null,
    actorEmail: req.actor?.email || req.auth?.email || null,
    actorRole: req.actor?.role || req.auth?.role || null,
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/* ────────────────────────── Templates ────────────────────────── */

function serializeTemplate(t) {
  return {
    id: t._id.toString(),
    key: t.key,
    name: t.name,
    subject: t.subject,
    html: t.html,
    description: t.description || "",
    placeholders: t.placeholders || [],
    system: Boolean(t.system),
    updatedAt: t.updatedAt,
  };
}

async function listTemplates(req, res, next) {
  try {
    const templates = await EmailTemplate.find({}).sort({ system: -1, name: 1 });
    return res.status(200).json({ success: true, templates: templates.map(serializeTemplate) });
  } catch (error) {
    return next(error);
  }
}

async function createTemplate(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const subject = String(req.body.subject || "").trim();
    const html = String(req.body.html || "");
    if (!name || !subject || !html) {
      return res.status(400).json({ success: false, message: "Name, subject, and body are required." });
    }
    const key =
      String(req.body.key || name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "") || `tpl_${Date.now()}`;

    const existing = await EmailTemplate.findOne({ key });
    if (existing) {
      return res.status(409).json({ success: false, message: `A template with key "${key}" already exists.` });
    }

    const template = await EmailTemplate.create({
      key,
      name,
      subject,
      html,
      description: String(req.body.description || "").trim(),
      placeholders: Array.isArray(req.body.placeholders) ? req.body.placeholders.map(String) : [],
      system: false,
      createdBy: req.actor?.email || null,
      updatedBy: req.actor?.email || null,
    });

    await recordAudit({
      ...auditContext(req),
      action: "email.template.create",
      module: "comms",
      permissionUsed: "comms.templates.manage",
      targetType: "email_template",
      targetId: template._id.toString(),
      targetLabel: template.name,
      summary: `Created email template "${template.name}".`,
    });

    return res.status(201).json({ success: true, template: serializeTemplate(template) });
  } catch (error) {
    return next(error);
  }
}

async function updateTemplate(req, res, next) {
  try {
    const template = await EmailTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found." });
    }
    if (typeof req.body.name === "string" && req.body.name.trim()) template.name = req.body.name.trim();
    if (typeof req.body.subject === "string" && req.body.subject.trim()) template.subject = req.body.subject.trim();
    if (typeof req.body.html === "string" && req.body.html) template.html = req.body.html;
    if (typeof req.body.description === "string") template.description = req.body.description.trim();
    if (Array.isArray(req.body.placeholders)) template.placeholders = req.body.placeholders.map(String);
    template.updatedBy = req.actor?.email || null;
    await template.save();

    await recordAudit({
      ...auditContext(req),
      action: "email.template.update",
      module: "comms",
      permissionUsed: "comms.templates.manage",
      targetType: "email_template",
      targetId: template._id.toString(),
      targetLabel: template.name,
      summary: `Updated email template "${template.name}".`,
    });

    return res.status(200).json({ success: true, template: serializeTemplate(template) });
  } catch (error) {
    return next(error);
  }
}

async function deleteTemplate(req, res, next) {
  try {
    const template = await EmailTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found." });
    }
    if (template.system) {
      return res.status(403).json({ success: false, message: "System templates cannot be deleted." });
    }
    const snapshot = { name: template.name, key: template.key };
    await template.deleteOne();

    await recordAudit({
      ...auditContext(req),
      action: "email.template.delete",
      module: "comms",
      permissionUsed: "comms.templates.manage",
      targetType: "email_template",
      targetLabel: snapshot.name,
      summary: `Deleted email template "${snapshot.name}".`,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
}

/* ────────────────────────── Audience resolution ────────────────────────── */

async function resolveAudienceEmails(audience, customList) {
  const set = new Set();

  const add = (email) => {
    const e = normalizeEmail(email);
    if (e && /^\S+@\S+\.\S+$/.test(e)) set.add(e);
  };

  if (audience === "custom") {
    (Array.isArray(customList) ? customList : []).forEach(add);
    return [...set];
  }

  if (audience === "newsletter") {
    const subs = await NewsletterSubscriber.find({ status: "subscribed" }).select("email").lean();
    subs.forEach((s) => add(s.email));
  } else if (audience === "waitlist") {
    const subs = await WaitlistSubscriber.find({}).select("email").lean();
    subs.forEach((s) => add(s.email));
  } else if (audience === "admins") {
    const admins = await AdminProfile.find({ active: true }).select("email").lean();
    admins.forEach((a) => add(a.email));
  } else {
    // all_customers
    const users = await User.find({}).select("email").lean();
    users.forEach((u) => add(u.email));
  }

  return [...set];
}

/* ────────────────────────── Campaigns ────────────────────────── */

function serializeCampaign(c) {
  return {
    id: c._id.toString(),
    name: c.name,
    subject: c.subject,
    audience: c.audience,
    recipientCount: c.recipientCount,
    status: c.status,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    skippedCount: c.skippedCount,
    createdBy: c.createdBy,
    startedAt: c.startedAt,
    completedAt: c.completedAt,
    createdAt: c.createdAt,
  };
}

async function listCampaigns(req, res, next) {
  try {
    const campaigns = await EmailCampaign.find({}).sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ success: true, campaigns: campaigns.map(serializeCampaign) });
  } catch (error) {
    return next(error);
  }
}

/** GET /erp/comms/audiences — recipient counts per segment for the composer. */
async function getAudienceCounts(req, res, next) {
  try {
    const [newsletter, waitlist, admins, customers] = await Promise.all([
      NewsletterSubscriber.countDocuments({ status: "subscribed" }),
      WaitlistSubscriber.countDocuments({}),
      AdminProfile.countDocuments({ active: true }),
      User.countDocuments({}),
    ]);
    return res.status(200).json({
      success: true,
      audiences: {
        all_customers: customers,
        newsletter,
        waitlist,
        admins,
      },
      mailConfigured: hasMailConfig(),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /erp/comms/campaigns — compose & send a broadcast.
 * Body: { name, subject, html, audience, customList? }
 * Enqueues one job per recipient through the retry queue, then updates the
 * campaign counters as jobs settle.
 */
async function sendCampaign(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const subject = String(req.body.subject || "").trim();
    const html = String(req.body.html || "");
    const audience = String(req.body.audience || "newsletter");
    const validAudiences = ["all_customers", "newsletter", "waitlist", "admins", "custom"];

    if (!name || !subject || !html) {
      return res.status(400).json({ success: false, message: "Name, subject, and body are required." });
    }
    if (!validAudiences.includes(audience)) {
      return res.status(400).json({ success: false, message: "Invalid audience." });
    }
    if (!hasMailConfig()) {
      return res.status(500).json({ success: false, message: "Mail transport is not configured on the server." });
    }

    const recipients = await resolveAudienceEmails(audience, req.body.customList);
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: "The selected audience has no recipients." });
    }

    const campaign = await EmailCampaign.create({
      name,
      subject,
      html,
      audience,
      recipientCount: recipients.length,
      status: "sending",
      createdBy: req.actor?.email || null,
      startedAt: new Date(),
    });

    // Enqueue one email per recipient. The queue handles retries + EmailLog.
    // We track settle counts here via the queue's per-send callback pattern:
    // enqueue accepts a sendMailFn; we wrap sendBrandedEmail so each recipient
    // gets an unsubscribe link when appropriate.
    const frontendUrl = env.frontendUrl || "";

    for (const email of recipients) {
      const unsubscribeUrl =
        audience === "newsletter" && frontendUrl
          ? `${frontendUrl}/newsletter/unsubscribe?email=${encodeURIComponent(email)}`
          : undefined;

      enqueue(
        async (payload) => {
          const result = await sendBrandedEmail({
            to: payload.to,
            subject: payload.subject,
            bodyHtml: payload.bodyHtml,
            unsubscribeUrl: payload.unsubscribeUrl,
          });
          // Update campaign counters as each send settles.
          const inc = result.skipped
            ? { skippedCount: 1 }
            : { sentCount: 1 };
          await EmailCampaign.updateOne({ _id: campaign._id }, { $inc: inc }).catch(() => {});
          return result;
        },
        {
          type: `campaign:${campaign._id.toString()}`,
          payload: { to: email, subject, bodyHtml: html, unsubscribeUrl },
          metadata: { campaignId: campaign._id.toString(), audience },
        }
      );
    }

    // Mark completion optimistically after enqueueing; counters keep updating.
    // A lightweight finalizer flips status to "sent" shortly after.
    setTimeout(async () => {
      await EmailCampaign.updateOne(
        { _id: campaign._id },
        { $set: { status: "sent", completedAt: new Date() } }
      ).catch(() => {});
    }, 2000);

    await recordAudit({
      ...auditContext(req),
      action: "email.campaign.send",
      module: "comms",
      permissionUsed: "comms.campaigns.send",
      targetType: "email_campaign",
      targetId: campaign._id.toString(),
      targetLabel: campaign.name,
      summary: `Sent campaign "${campaign.name}" to ${recipients.length} ${audience} recipient(s).`,
      metadata: { audience, recipientCount: recipients.length },
    });

    return res.status(201).json({ success: true, campaign: serializeCampaign(campaign) });
  } catch (error) {
    return next(error);
  }
}

/* ────────────────────────── Subscribers ────────────────────────── */

async function listSubscribers(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.search) filter.email = { $regex: String(req.query.search).trim(), $options: "i" };

    const [rows, total, subscribed] = await Promise.all([
      NewsletterSubscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NewsletterSubscriber.countDocuments(filter),
      NewsletterSubscriber.countDocuments({ status: "subscribed" }),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      subscribed,
      subscribers: rows.map((s) => ({
        id: s._id.toString(),
        email: s.email,
        name: s.name || "",
        source: s.source || "website",
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function removeSubscriber(req, res, next) {
  try {
    const sub = await NewsletterSubscriber.findById(req.params.subscriberId);
    if (!sub) {
      return res.status(404).json({ success: false, message: "Subscriber not found." });
    }
    const email = sub.email;
    await sub.deleteOne();

    await recordAudit({
      ...auditContext(req),
      action: "email.subscriber.remove",
      module: "comms",
      permissionUsed: "comms.subscribers.manage",
      targetType: "newsletter_subscriber",
      targetLabel: email,
      summary: `Removed newsletter subscriber ${email}.`,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
}

/** GET /erp/comms/subscribers/export — CSV of subscribed emails. */
async function exportSubscribers(req, res, next) {
  try {
    const rows = await NewsletterSubscriber.find({ status: "subscribed" }).sort({ createdAt: -1 }).lean();
    const header = "email,name,source,subscribedAt\n";
    const body = rows
      .map((s) => `${s.email},${JSON.stringify(s.name || "")},${s.source || ""},${s.createdAt.toISOString()}`)
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="newsletter-subscribers.csv"');
    return res.status(200).send(header + body);
  } catch (error) {
    return next(error);
  }
}

/* ────────────────────────── Email logs ────────────────────────── */

async function listEmailLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.type) filter.type = { $regex: String(req.query.type).trim(), $options: "i" };
    if (req.query.to) filter.to = { $regex: String(req.query.to).trim(), $options: "i" };

    const [rows, total, failed] = await Promise.all([
      EmailLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      EmailLog.countDocuments(filter),
      EmailLog.countDocuments({ status: "failed" }),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      failed,
      logs: rows.map((l) => ({
        id: l._id.toString(),
        to: l.to,
        subject: l.subject,
        type: l.type,
        status: l.status,
        attempts: l.attempts,
        error: l.error || null,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCampaigns,
  getAudienceCounts,
  sendCampaign,
  listSubscribers,
  removeSubscriber,
  exportSubscribers,
  listEmailLogs,
};
