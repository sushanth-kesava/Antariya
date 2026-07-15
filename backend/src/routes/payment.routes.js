const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { createRazorpayOrderSchema, verifyPaymentSchema } = require("../schemas/payment.schemas");
const { createRazorpayOrder, verifyPaymentSignature } = require("../controllers/payment.controller");

const router = express.Router();

router.post("/create-order", requireAuth, validate(createRazorpayOrderSchema), createRazorpayOrder);
router.post("/verify-payment", requireAuth, validate(verifyPaymentSchema), verifyPaymentSignature);

module.exports = router;
