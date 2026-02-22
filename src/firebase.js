import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBbhCOmzzfhMITVXdJpmR4nj6-ORJXRv68",
  authDomain: "appvault-64896.firebaseapp.com",
  projectId: "appvault-64896",
  storageBucket: "appvault-64896.firebasestorage.app",
  messagingSenderId: "135333381045",
  appId: "1:135333381045:web:e32dbab8c5e804ba0d4ffc",
  measurementId: "G-2R9V17YLHY",
};

const envValue = (key, fallback) => {
  const value = process.env[key];
  return value && String(value).trim() ? value : fallback;
};

const firebaseConfig = {
  apiKey:            envValue("REACT_APP_FIREBASE_API_KEY", DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain:        envValue("REACT_APP_FIREBASE_AUTH_DOMAIN", DEFAULT_FIREBASE_CONFIG.authDomain),
  projectId:         envValue("REACT_APP_FIREBASE_PROJECT_ID", DEFAULT_FIREBASE_CONFIG.projectId),
  storageBucket:     envValue("REACT_APP_FIREBASE_STORAGE_BUCKET", DEFAULT_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: envValue("REACT_APP_FIREBASE_MESSAGING_SENDER_ID", DEFAULT_FIREBASE_CONFIG.messagingSenderId),
  appId:             envValue("REACT_APP_FIREBASE_APP_ID", DEFAULT_FIREBASE_CONFIG.appId),
  measurementId:     envValue("REACT_APP_FIREBASE_MEASUREMENT_ID", DEFAULT_FIREBASE_CONFIG.measurementId),
};

const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const storage = firebaseConfig.storageBucket ? getStorage(app) : null;

// Load analytics after initial render so startup is not blocked.
const initializeAnalytics = async () => {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    // Ignore analytics initialization errors.
  }
};

if (typeof window !== "undefined") {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => { void initializeAnalytics(); });
  } else {
    window.setTimeout(() => { void initializeAnalytics(); }, 1200);
  }
}

export default app;
