/* eslint-disable no-console */
const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const folder = process.argv[2] || '';

if (!folder) {
  console.error('Usage: node list-cloudinary-assets.js <folder-prefix>');
  process.exit(1);
}

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Cloudinary credentials not found in .env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function listAll(prefix) {
  let resources = [];
  let nextCursor = undefined;

  do {
    const res = await cloudinary.api.resources({
      type: 'upload',
      prefix,
      max_results: 500,
      next_cursor: nextCursor,
    });

    resources = resources.concat(res.resources || []);
    nextCursor = res.next_cursor;
  } while (nextCursor);

  return resources;
}

(async () => {
  try {
    const prefix = folder.replace(/^\/+/, '');
    console.log(`Listing assets under prefix: "${prefix}"`);
    const resources = await listAll(prefix);

    if (resources.length === 0) {
      console.log('No assets found.');
      return;
    }

    const simplified = resources.map((r) => ({ public_id: r.public_id, url: r.secure_url, format: r.format, bytes: r.bytes }));
    console.log(JSON.stringify(simplified, null, 2));
  } catch (error) {
    console.error('Failed to list assets:', error.message || error);
    process.exit(1);
  }
})();
