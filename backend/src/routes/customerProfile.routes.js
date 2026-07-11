const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getCustomerProfile,
  updateCustomerProfile,
  addAddress,
  updateAddress,
  setDefaultAddress,
  removeAddress,
  completeProfile,
  getBusinessDetails,
  updateBusinessDetails,
} = require("../controllers/customerProfile.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/profile", getCustomerProfile);
router.get("/profile/business", getBusinessDetails);
router.put("/profile/business", updateBusinessDetails);
router.put("/profile", updateCustomerProfile);
router.post("/profile/complete", completeProfile);
router.post("/profile/address", addAddress);
router.put("/profile/address/:addressId", updateAddress);
router.patch("/profile/address/:addressId/default", setDefaultAddress);
router.delete("/profile/address/:addressId", removeAddress);

module.exports = router;
