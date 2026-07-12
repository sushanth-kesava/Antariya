const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const { connectDb } = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");
const superAdminRoutes = require("./routes/superadmin.routes");
const deliveryRoutes = require("./routes/delivery.routes");
const erpRoutes = require("./routes/erp.routes");
const newsletterRoutes = require("./routes/newsletter.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const waitlistRoutes = require("./routes/waitlist.routes");
const statsRoutes = require("./routes/stats.routes");
const paymentRoutes = require("./routes/payment.routes");
const customerProfileRoutes = require("./routes/customerProfile.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");
const { attachRealtime } = require("./services/realtime.service");
const { startInventoryJobs } = require("./services/inventory.jobs");
const { ensureDefaultRoles } = require("./services/rbac.service");
const { ensureDefaultRateLimits } = require("./services/ratelimit.service");
const { ensureDefaultWarehouse } = require("./services/inventory.service");
const http = require("http");

const app = express();

const allowedOrigins = Array.isArray(env.frontendUrls)
  ? env.frontendUrls
  : [env.frontendUrl].filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "25mb" }));
app.use(morgan("tiny"));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Antariya backend is running",
    docs: {
      health: "/api/health",
      authGoogle: "/api/auth/google",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/erp", erpRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api", paymentRoutes);
app.use("/api/customer", customerProfileRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await connectDb(env.mongoUri);

    // Guarantee the DEFAULT warehouse exists before serving traffic, so the
    // inventory system never needs a manual migration to function.
    await ensureDefaultWarehouse();

    // Seed the default RBAC roles (superadmin, admin, hr_manager, etc.) so the
    // ERP permission engine is functional on first boot with no manual setup.
    await ensureDefaultRoles();

    // Seed the default rate-limit rules so Governance → Rate Limits is live.
    await ensureDefaultRateLimits();

    const httpServer = http.createServer(app);

    // Attach the real-time layer (no-op if socket.io isn't installed yet).
    attachRealtime(httpServer, { allowedOrigins });

    httpServer.listen(env.port, () => {
      console.log(`Server Started on port ${env.port}`);
    });

    // Start inventory background jobs (expiry sweeper, verification, low-stock).
    startInventoryJobs();
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
}

startServer();
