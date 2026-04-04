
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Initializes Firebase services if they haven't been initialized already.
 * Returns the app, firestore, and auth instances.
 */
export function initializeFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } {
  // Check if we have a valid config before initializing to prevent crash
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your-api-key-here') {
    // If we're on the server, we might want to log this specifically
    if (typeof window === 'undefined') {
      console.error('CRITICAL: Firebase configuration is missing or invalid in server-side context.');
    }
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  let auth: any = null;
  try {
    auth = getAuth(app);
  } catch (e) {
    console.warn("Firebase Auth bypassed or invalid key");
  }

  return { app, db, auth: auth as Auth };
}

export * from './provider';
export * from './client-provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';
