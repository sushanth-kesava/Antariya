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
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();
const allowedOrigins = new Set(env.frontendUrls || [env.frontendUrl].filter(Boolean));

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = String(origin).trim().replace(/\/+$/, "");
      return callback(null, allowedOrigins.has(normalizedOrigin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "StitchMart backend is running",
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
