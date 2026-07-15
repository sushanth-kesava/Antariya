const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function normalizeOrigin(origin) {
  return String(origin || "")
    .trim()
    .replace(/\/$/, "");
}

function normalizeMongoUri(mongoUri, databaseName = "stitchmart") {
  const value = String(mongoUri || "").trim();

  if (!value) {
    return value;
  }

  try {
    const parsed = new URL(value);

    if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname === "/test") {
      parsed.pathname = `/${databaseName}`;
    }

    return parsed.toString();
  } catch {
    return value;
  }
}

const frontendOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map((value) => normalizeOrigin(value))
  .filter(Boolean);

const defaultFrontendOrigins = [
  "https://antariyaofficial.com",
  "https://www.antariyaofficial.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:9002",
  "http://127.0.0.1:9002",
];

const resolvedFrontendOrigins = frontendOrigins.length > 0 ? frontendOrigins : defaultFrontendOrigins;

const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: normalizeMongoUri(process.env.MONGODB_URI),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendUrl: resolvedFrontendOrigins[0],
  frontendUrls: resolvedFrontendOrigins,
  appName: process.env.APP_NAME || "Antariya",
  adminAllowedEmails: String(process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  superAdminAllowedEmails: String(process.env.SUPERADMIN_ALLOWED_EMAILS || "")
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
  mailFromName: process.env.MAIL_FROM_NAME || process.env.APP_NAME || "Antariya",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
};

const requiredVars = ["MONGODB_URI", "JWT_SECRET", "SUPERADMIN_ALLOWED_EMAILS"];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = env;
