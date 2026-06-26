const authService = require("../services/odoo/auth.service");

async function health(req, res, next) {
  try {
    const info = await authService.getSessionInfo();
    res.status(200).json({
      connected: true,
      database: info.database,
      uid: info.uid,
      user: info.user || null,
    });
  } catch (err) {
    // Log internal error server-side but do not expose credentials
    console.error("Odoo health check failed:", err && err.stack ? err.stack : err);
    res.status(502).json({ connected: false, error: "Odoo connection failed" });
  }
}

module.exports = {
  health,
};
