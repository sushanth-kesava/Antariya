const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:9002",
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
};

const requiredVars = ["MONGODB_URI", "JWT_SECRET"];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = env;
