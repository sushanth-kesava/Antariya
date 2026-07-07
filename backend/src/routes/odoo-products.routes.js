const express = require("express");
const odooService = require("../services/odoo.service");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const search = String(req.query.search || "").trim();
    const products = await odooService.getProducts({ limit, offset, search });
    res.json({ success: true, products, count: products.length });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const product = await odooService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
