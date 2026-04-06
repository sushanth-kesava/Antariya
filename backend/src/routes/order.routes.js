const express = require("express");
const { createOrder, getMyOrders, getAdminDashboard, updateAdminOrderStatus } = require("../controllers/order.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/my", requireAuth, getMyOrders);
router.get("/admin/dashboard", requireAuth, getAdminDashboard);
router.patch("/admin/:orderId/status", requireAuth, updateAdminOrderStatus);
router.post("/", requireAuth, createOrder);

module.exports = router;
