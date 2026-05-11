const Product = require("../models/Product");

const SAMPLE_PRODUCTS = [
  {
    name: "Royal Lotus Embroidery Pack",
    description: "A premium digital motif bundle with ornate lotus artwork for festive garments and home decor.",
    price: 1299,
    category: "Embroidery Designs",
    dealerId: "demo-dealer-studio",
    dealerName: "Antariya Studio",
    dealerEmail: "studio@antariyaofficial.com",
    image: "https://picsum.photos/seed/antariya-lotus/1200/1200",
    images: ["https://picsum.photos/seed/antariya-lotus/1200/1200"],
    galleryImages: ["https://picsum.photos/seed/antariya-lotus/1200/1200"],
    stock: 0,
    rating: 4.8,
    customizable: true,
    fileDownloadLink: null,
  },
  {
    name: "Gold Shine Machine Thread",
    description: "High-tensile thread built for smooth stitching and a rich metallic finish.",
    price: 249,
    category: "Machine Threads",
    dealerId: "demo-dealer-ops",
    dealerName: "Workshop Supply Co.",
    dealerEmail: "ops@antariyaofficial.com",
    image: "https://picsum.photos/seed/antariya-thread/1200/1200",
    images: ["https://picsum.photos/seed/antariya-thread/1200/1200"],
    galleryImages: ["https://picsum.photos/seed/antariya-thread/1200/1200"],
    stock: 58,
    rating: 4.6,
    customizable: false,
    fileDownloadLink: null,
  },
  {
    name: "Premium Cotton Hoodie",
    description: "Heavyweight hoodie with clean panels for embroidery and long-lasting wear.",
    price: 1899,
    category: "Hoodies",
    dealerId: "demo-dealer-apparel",
    dealerName: "Seasonal Wear House",
    dealerEmail: "apparel@antariyaofficial.com",
    image: "https://picsum.photos/seed/antariya-hoodie/1200/1200",
    images: ["https://picsum.photos/seed/antariya-hoodie/1200/1200"],
    galleryImages: ["https://picsum.photos/seed/antariya-hoodie/1200/1200"],
    stock: 24,
    rating: 4.9,
    customizable: true,
    fileDownloadLink: null,
  },
  {
    name: "Silk Blend Blouse Piece",
    description: "Elegant blouse fabric with a soft drape that works well for festive custom embroidery.",
    price: 1499,
    category: "Blouses",
    dealerId: "demo-dealer-apparel",
    dealerName: "Seasonal Wear House",
    dealerEmail: "apparel@antariyaofficial.com",
    image: "https://picsum.photos/seed/antariya-blouse/1200/1200",
    images: ["https://picsum.photos/seed/antariya-blouse/1200/1200"],
    galleryImages: ["https://picsum.photos/seed/antariya-blouse/1200/1200"],
    stock: 16,
    rating: 4.7,
    customizable: true,
    fileDownloadLink: null,
  },
  {
    name: "Precision Embroidery Needles",
    description: "Fine-point needles for crisp detailing on dense and delicate fabrics.",
    price: 199,
    category: "Needles",
    dealerId: "demo-dealer-ops",
    dealerName: "Workshop Supply Co.",
    dealerEmail: "ops@antariyaofficial.com",
    image: "https://picsum.photos/seed/antariya-needles/1200/1200",
    images: ["https://picsum.photos/seed/antariya-needles/1200/1200"],
    galleryImages: ["https://picsum.photos/seed/antariya-needles/1200/1200"],
    stock: 120,
    rating: 4.5,
    customizable: false,
    fileDownloadLink: null,
  },
  {
    name: "Textured Linen Fabric Roll",
    description: "Breathable linen base with a refined texture for embroidery and tailoring projects.",
    price: 899,
    category: "Fabrics",
    dealerId: "demo-dealer-loom",
    dealerName: "Loom & Layer",
    dealerEmail: "loom@antariyaofficial.com",
    image: "https://picsum.photos/seed/antariya-fabric/1200/1200",
    images: ["https://picsum.photos/seed/antariya-fabric/1200/1200"],
    galleryImages: ["https://picsum.photos/seed/antariya-fabric/1200/1200"],
    stock: 42,
    rating: 4.4,
    customizable: false,
    fileDownloadLink: null,
  },
  {
    name: "Embroidery Hoop Set",
    description: "A workshop essential set for keeping fabric taut and embroidery lines clean.",
    price: 699,
    category: "Accessories",
    dealerId: "demo-dealer-ops",
    dealerName: "Workshop Supply Co.",
    dealerEmail: "ops@antariyaofficial.com",
    image: "https://picsum.photos/seed/antariya-accessories/1200/1200",
    images: ["https://picsum.photos/seed/antariya-accessories/1200/1200"],
    galleryImages: ["https://picsum.photos/seed/antariya-accessories/1200/1200"],
    stock: 33,
    rating: 4.3,
    customizable: false,
    fileDownloadLink: null,
  },
];

async function seedSampleProductsIfEmpty() {
  const productCount = await Product.countDocuments();

  if (productCount > 0) {
    return { seeded: false, count: productCount };
  }

  await Product.insertMany(SAMPLE_PRODUCTS, { ordered: true });

  return { seeded: true, count: SAMPLE_PRODUCTS.length };
}

module.exports = {
  SAMPLE_PRODUCTS,
  seedSampleProductsIfEmpty,
};