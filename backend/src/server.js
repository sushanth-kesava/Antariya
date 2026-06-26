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
const wishlistRoutes = require("./routes/wishlist.routes");
const waitlistRoutes = require("./routes/waitlist.routes");
const statsRoutes = require("./routes/stats.routes");
const paymentRoutes = require("./routes/payment.routes");
const odooRoutes = require("./routes/odoo.routes");
const odooProductRoutes = require("./routes/odoo-product.routes");
const odooInventoryRoutes = require("./routes/odoo-inventory.routes");
const odooCustomerRoutes = require("./routes/odoo-customer.routes");
const odooSalesRoutes = require("./routes/odoo-sales.routes");
const odooPurchaseRoutes = require("./routes/odoo-purchase.routes");
const odooAccountingRoutes = require("./routes/odoo-accounting.routes");
const odooShippingRoutes = require("./routes/odoo-shipping.routes");
const odooDashboardRoutes = require("./routes/odoo-dashboard.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

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
app.use(express.json({ limit: "1mb" }));
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
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api", paymentRoutes);
app.use("/api/odoo", odooRoutes);
app.use("/api/odoo/products", odooProductRoutes);
app.use("/api/odoo/customer", odooCustomerRoutes);
app.use("/api/odoo/sales", odooSalesRoutes);
app.use("/api/purchase", odooPurchaseRoutes);
app.use("/api/inventory", odooInventoryRoutes);
app.use("/api/accounting", odooAccountingRoutes);
app.use("/api/shipping", odooShippingRoutes);
app.use("/api/dashboard", odooDashboardRoutes);
app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await connectDb(env.mongoUri);

    app.listen(env.port, () => {
      console.log(`Server Started on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
}

startServer();
