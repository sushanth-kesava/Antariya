const express = require("express");
const { getPublicHomeStats } = require("../controllers/stats.controller");

const router = express.Router();

router.get("/home", getPublicHomeStats);

module.exports = router;
