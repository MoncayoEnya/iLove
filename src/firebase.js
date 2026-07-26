// Firebase project setup:
// 1. Go to https://console.firebase.google.com -> Create project
// 2. Add a Web App, copy the config values into a .env file (see .env.example)
// 3. Enable Authentication -> Email/Password sign-in method
// 4. Enable Firestore Database (start in production mode, then paste firestore.rules)
//
// Note: this project intentionally does NOT use Firebase Storage (Cloud Storage now
// requires the paid Blaze plan). Profile photos are stored as plain image URLs in
// Firestore instead, so everything here runs on the free Spark plan.

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)