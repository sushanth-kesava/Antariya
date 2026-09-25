require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");
const Product = require("../src/models/Product");

async function main() {
  await mongoose.connect(env.mongoUri);
  const p = await Product.findById("6a6456ec88eee02a30d465ba").lean();
  if (!p) { console.log("NOT FOUND"); process.exit(0); }
  console.log(JSON.stringify({
    _id: p._id,
    name: p.name,
    price: p.price,
    image: p.image,
    dealerId: p.dealerId,
    dealerName: p.dealerName,
    dealerEmail: p.dealerEmail,
    variants: (p.variants || []).map(v => ({
      sku: v.sku, size: v.size, color: v.color,
      gender: v.gender, neckType: v.neckType, pattern: v.pattern, price: v.price
    }))
  }, null, 2));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
