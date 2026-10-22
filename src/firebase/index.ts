import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Helper to normalize env values (trim and strip surrounding quotes)
const norm = (v: string | undefined): string | undefined => {
  if (!v) return undefined;
  const trimmed = String(v).trim();
  // Strip matching quotes "value" or 'value'
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const projectId = norm(process.env.FIREBASE_PROJECT_ID);
const configuredBucket = norm(process.env.FIREBASE_STORAGE_BUCKET);
const storageBucket = configuredBucket || (projectId ? `${projectId}.appspot.com` : undefined);

if (!storageBucket) {
  // Log once at startup; getStorage() will error without a default bucket
  // Using console.warn avoids throwing during import which could break tests
  console.warn('[firebase] No storageBucket configured. Set FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID.');
}

// Initialize Firebase (Web SDK) using environment variables
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: norm(process.env.FIREBASE_API_KEY),
  authDomain: norm(process.env.FIREBASE_AUTH_DOMAIN),
  projectId,
  storageBucket,
  messagingSenderId: norm(process.env.FIREBASE_MESSAGING_SENDER_ID),
  appId: norm(process.env.FIREBASE_APP_ID),
  measurementId: norm(process.env.FIREBASE_MEASUREMENT_ID),
};

const firebaseApp: FirebaseApp = initializeApp(firebaseConfig as any);
const storage: FirebaseStorage = getStorage(firebaseApp);

export { firebaseApp, storage };
export default { firebaseApp, storage };