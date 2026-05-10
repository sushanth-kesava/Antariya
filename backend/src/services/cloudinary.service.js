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

module.exports = {
  hasCloudinaryCredentials,
  uploadProductImageBuffer,
};
