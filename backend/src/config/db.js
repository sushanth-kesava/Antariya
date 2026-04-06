const mongoose = require("mongoose");

let adminProfileIndexCleanupDone = false;

async function cleanupStaleAdminProfileIndexes() {
  if (adminProfileIndexCleanupDone) {
    return;
  }

  adminProfileIndexCleanupDone = true;

  try {
    const collection = mongoose.connection.collection("admin_profiles");
    const indexes = await collection.indexes();
    const staleIndexes = indexes.filter((index) => {
      if (index.name === "_id_") {
        return false;
      }

      const keyEntries = Object.entries(index.key || {});
      return keyEntries.some(([field]) => field === "userId");
    });

    for (const index of staleIndexes) {
      await collection.dropIndex(index.name);
      console.log(`Dropped stale admin_profiles index: ${index.name}`);
    }
  } catch (error) {
    if (error?.codeName !== "IndexNotFound") {
      console.warn("Admin profile index cleanup skipped:", error.message);
    }
  }
}

async function connectDb(mongoUri) {
  await mongoose.connect(mongoUri, {
    autoIndex: true,
  });

  await cleanupStaleAdminProfileIndexes();
}

module.exports = { connectDb };
