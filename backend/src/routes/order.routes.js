const express = require("express");
const { createOrder, getMyOrders, getAdminDashboard, updateAdminOrderStatus } = require("../controllers/order.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { createOrderSchema } = require("../schemas/order.schemas");

const router = express.Router();

router.get("/my", requireAuth, getMyOrders);
router.get("/admin/dashboard", requireAuth, requireRole("admin", "superadmin"), getAdminDashboard);
router.patch("/admin/:orderId/status", requireAuth, requireRole("admin", "superadmin"), updateAdminOrderStatus);
router.post("/", requireAuth, validate(createOrderSchema), createOrder);

module.exports = router;
