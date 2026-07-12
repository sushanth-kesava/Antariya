const express = require("express");
const { subscribe, unsubscribe } = require("../controllers/newsletter.controller");

const router = express.Router();

// Public newsletter endpoints (no auth).
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);
router.get("/unsubscribe", unsubscribe);

module.exports = router;
