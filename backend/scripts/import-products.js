/* eslint-disable no-console */
const fs = require("fs/promises");
const path = require("path");
const env = require("../src/config/env");
const { connectDb } = require("../src/config/db");
const Product = require("../src/models/Product");

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    filePath: path.resolve(process.cwd(), "data/products.import.json"),
    replace: false,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--file" && args[index + 1]) {
      options.filePath = path.resolve(process.cwd(), args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--replace") {
      options.replace = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];
}

function normalizeProductInput(product) {
  const imageList = normalizeArray(product.images);
  const galleryList = normalizeArray(product.galleryImages);
  const fallbackImage = normalizeString(product.image);
  const mergedImages = [...new Set([...imageList, ...galleryList, fallbackImage].filter(Boolean))];

  return {
    name: normalizeString(product.name),
    description: normalizeString(product.description),
    price: Number(product.price || 0),
    category: normalizeString(product.category),
    dealerId: normalizeString(product.dealerId),
    dealerName: normalizeString(product.dealerName),
    dealerEmail: normalizeEmail(product.dealerEmail),
    image: mergedImages[0] || "",
    images: mergedImages,
    galleryImages: mergedImages,
    stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
    fileDownloadLink: product.fileDownloadLink ? normalizeString(product.fileDownloadLink) : null,
    rating: Number.isFinite(Number(product.rating)) ? Number(product.rating) : 0,
    customizable: Boolean(product.customizable),
  };
}

function validateProduct(product, index) {
  const requiredFields = ["name", "description", "category", "dealerId", "dealerName", "dealerEmail", "image"];
  const missing = requiredFields.filter((field) => !product[field]);

  if (missing.length > 0) {
    throw new Error(`Product at index ${index} is missing required fields: ${missing.join(", ")}`);
  }

  if (!Number.isFinite(product.price) || product.price < 0) {
    throw new Error(`Product at index ${index} has an invalid price`);
  }

  if (!Number.isFinite(product.stock) || product.stock < 0) {
    throw new Error(`Product at index ${index} has an invalid stock value`);
  }

  if (!Number.isFinite(product.rating) || product.rating < 0 || product.rating > 5) {
    throw new Error(`Product at index ${index} has an invalid rating`);
  }
}

async function loadProducts(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error("Import file must contain an array of product objects");
  }

  return data.map(normalizeProductInput);
}

async function importProducts({ filePath, replace, dryRun }) {
  const products = await loadProducts(filePath);
  products.forEach(validateProduct);

  if (dryRun) {
    console.log(`Dry run: ${products.length} products ready to import from ${filePath}`);
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (${product.dealerEmail})`);
    });
    return;
  }

  await connectDb(env.mongoUri);

  const operations = products.map((product) => {
    const filter = {
      name: product.name,
      dealerEmail: product.dealerEmail,
    };

    const update = replace
      ? { $set: product }
      : {
          $setOnInsert: product,
        };

    return {
      updateOne: {
        filter,
        update,
        upsert: true,
      },
    };
  });

  const result = await Product.bulkWrite(operations, { ordered: false });

  console.log(
    `Import complete: ${result.upsertedCount || 0} inserted, ${result.matchedCount || 0} matched, ${result.modifiedCount || 0} modified.`
  );
}

async function main() {
  const options = parseArgs(process.argv);

  try {
    await importProducts(options);
  } catch (error) {
    console.error("Failed to import products:", error.message);
    process.exitCode = 1;
  } finally {
    if (Product?.db) {
      await Product.db.close().catch(() => null);
    }
  }
}

main();