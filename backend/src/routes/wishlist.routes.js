const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getWishlist, setWishlistState } = require("../controllers/wishlist.controller");

const router = express.Router();

router.get("/", requireAuth, getWishlist);
router.put("/:productId", requireAuth, setWishlistState);

module.exports = router;
