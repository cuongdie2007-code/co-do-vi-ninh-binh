import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

export const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'co-do-vi-ninh-binh',
  appId: env.VITE_FIREBASE_APP_ID || '1:711046773430:web:d0bb9aeb5b7defd1fbc417',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'co-do-vi-ninh-binh.firebasestorage.app',
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBDrUl5nvSpiiIVFJxR4fSPziPJdpVEcMU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'co-do-vi-ninh-binh.firebaseapp.com',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '711046773430',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-KQP34H1HJC',
};

// Named Enterprise database ID in asia-southeast1 (Singapore).
export const FIRESTORE_DATABASE_ID: string | undefined =
  env.VITE_FIRESTORE_DATABASE_ID || 'codovi-db';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = FIRESTORE_DATABASE_ID
  ? getFirestore(app, FIRESTORE_DATABASE_ID)
  : getFirestore(app);
