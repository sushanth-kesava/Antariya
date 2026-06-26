const express = require("express");
const router = express.Router();
const controller = require("../controllers/odoo.controller");

router.get("/health", controller.health);

module.exports = router;
