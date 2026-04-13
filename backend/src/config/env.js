const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function normalizeOrigin(value) {
  const candidate = String(value || "").trim().replace(/\/+$/, "");

  if (!candidate) {
    return "";
  }

  try {
    const parsed = new URL(candidate);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return candidate;
  }
}

const configuredFrontendUrls = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:9002")
  .split(",")
  .map((value) => normalizeOrigin(value))
  .filter(Boolean);

const frontendUrls = Array.from(new Set(configuredFrontendUrls));

const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  frontendUrl: frontendUrls[0] || "http://localhost:9002",
  frontendUrls,
  appName: process.env.APP_NAME || "StitchMart",
  adminAllowedEmails: String(process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  superAdminAllowedEmails: (process.env.SUPERADMIN_ALLOWED_EMAILS
    ? String(process.env.SUPERADMIN_ALLOWED_EMAILS)
    : [
        "2300030795cseird@gmail.com",
        "sushanthkesava@gmail.com",
        "annabathulasarath@gmail.com",
        "abhijnavinjamuri@gmail.com",
        "lakshmisnehitha52@gmail.com",
      ].join(","))
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  googleUserInfoUrl: process.env.GOOGLE_USERINFO_URL || "https://www.googleapis.com/oauth2/v3/userinfo",
  delhiveryApiKey: process.env.DELHIVERY_API_KEY,
  delhiveryBaseUrl: process.env.DELHIVERY_BASE_URL || "https://track.delhivery.com",
  emailHost: process.env.EMAIL_HOST || "smtp.gmail.com",
  emailPort: Number(process.env.EMAIL_PORT || 587),
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailFrom: process.env.EMAIL_FROM,
  smtpHost: process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
  smtpSecure:
    String(process.env.SMTP_SECURE || "").trim() !== ""
      ? String(process.env.SMTP_SECURE).toLowerCase() === "true"
      : Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587) === 465,
  smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER,
  smtpPass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
  mailFromEmail: process.env.MAIL_FROM_EMAIL || process.env.EMAIL_USER,
  mailFromName: process.env.MAIL_FROM_NAME || process.env.APP_NAME || "StitchMart",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
};

const requiredVars = ["MONGODB_URI", "JWT_SECRET"];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = env;
