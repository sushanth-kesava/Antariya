const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { createRazorpayOrder, verifyPaymentSignature } = require("../controllers/payment.controller");

const router = express.Router();

router.post("/create-order", requireAuth, createRazorpayOrder);
router.post("/verify-payment", requireAuth, verifyPaymentSignature);

module.exports = router;
