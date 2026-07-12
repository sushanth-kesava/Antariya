const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const {
  listWarehouses,
  createWarehouse,
  getInventory,
  getLedger,
  processReturn,
  transferStock,
  checkStockAvailability,
  runVerification,
} = require("../controllers/inventory.controller");

const router = express.Router();

const staff = [requireAuth, requireRole("admin", "superadmin")];
const customer = [requireAuth];

router.get("/warehouses", ...staff, listWarehouses);
router.post("/warehouses", ...staff, createWarehouse);
router.get("/", ...staff, getInventory);
router.get("/ledger", ...staff, getLedger);
router.post("/returns", ...staff, processReturn);
router.post("/check-stock", ...customer, checkStockAvailability);
router.post("/transfer", ...staff, transferStock);
router.post("/verify", ...staff, runVerification);

module.exports = router;
