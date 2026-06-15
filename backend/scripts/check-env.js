/* eslint-disable no-console */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const required = ['MONGODB_URI', 'JWT_SECRET'];
const optional = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
];

function missing(keys) {
  return keys.filter((k) => !process.env[k]);
}

const missingRequired = missing(required);
const missingOptional = missing(optional);

if (missingRequired.length > 0) {
  console.error('Missing required environment variables:');
  missingRequired.forEach((k) => console.error(' -', k));
  process.exitCode = 2;
} else {
  console.log('All required environment variables are present.');
}

if (missingOptional.length > 0) {
  console.warn('Missing optional environment variables (some features may be disabled):');
  missingOptional.forEach((k) => console.warn(' -', k));
} else {
  console.log('All commonly-used optional variables present.');
}

console.log('\nTo provide variables for local development, copy backend/.env.example to backend/.env and update values.');
