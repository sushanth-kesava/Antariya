const express = require("express");
const { subscribeToWaitlist } = require("../controllers/waitlist.controller");

const router = express.Router();

router.post("/subscribe", subscribeToWaitlist);

module.exports = router;
