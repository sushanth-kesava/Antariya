
/**
 * Firebase client-side configuration.
 * These values are loaded from environment variables.
 * NEXT_PUBLIC_ prefix is required for client-side access in Next.js.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Simple check to help debug missing environment variables
if (typeof window !== 'undefined' && !firebaseConfig.apiKey) {
  console.warn(
    'Firebase API key is missing. Please ensure NEXT_PUBLIC_FIREBASE_API_KEY is set in your .env file.'
  );
}
