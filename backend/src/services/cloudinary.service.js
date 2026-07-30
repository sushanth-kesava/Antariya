const { v2: cloudinary } = require("cloudinary");
const env = require("../config/env");

const hasCloudinaryCredentials =
  Boolean(env.cloudinaryCloudName) && Boolean(env.cloudinaryApiKey) && Boolean(env.cloudinaryApiSecret);

if (hasCloudinaryCredentials) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

function uploadProductImageBuffer(buffer, options = {}) {
  if (!hasCloudinaryCredentials) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "antariya/products",
        resource_type: "image",
        overwrite: false,
        ...options,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Destroy (permanently delete) an asset from Cloudinary by its public_id.
 * Best-effort: resolves to null when Cloudinary isn't configured so callers
 * (e.g. product/barcode deletion) never fail just because storage cleanup
 * couldn't run. Returns the Cloudinary API result on success.
 */
async function destroyAsset(publicId, options = {}) {
  if (!hasCloudinaryCredentials || !publicId) {
    return null;
  }

  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      ...options,
    });
  } catch (error) {
    console.warn("[Cloudinary] Failed to destroy asset:", publicId, error.message);
    return null;
  }
}

module.exports = {
  hasCloudinaryCredentials,
  uploadProductImageBuffer,
  destroyAsset,
};
