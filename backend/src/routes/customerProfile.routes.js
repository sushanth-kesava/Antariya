const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getCustomerProfile,
  updateCustomerProfile,
  addAddress,
  removeAddress,
  completeProfile,
} = require("../controllers/customerProfile.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/profile", getCustomerProfile);
router.put("/profile", updateCustomerProfile);
router.post("/profile/complete", completeProfile);
router.post("/profile/address", addAddress);
router.delete("/profile/address/:addressId", removeAddress);

module.exports = router;
