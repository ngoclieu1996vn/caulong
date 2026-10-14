import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getFirestore,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAeRAT7H7K5YZYeqYdDQP1tpTurJ1SrCso",
  authDomain: "cau-long-aecdc.firebaseapp.com",
  projectId: "cau-long-aecdc",
  storageBucket: "cau-long-aecdc.firebasestorage.app",
  messagingSenderId: "89807478272",
  appId: "1:89807478272:web:ca650309b87cd72eea42e5",
  measurementId: "G-B7NKF1BXCX",
};

// Explicit local-only testing. A deployed site can never enable this mode.
export const isEmulator =
  ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) &&
  new URLSearchParams(location.search).get("emulator") === "1";
const app = initializeApp(
  isEmulator
    ? { ...firebaseConfig, projectId: "demo-calendar-checkin" }
    : firebaseConfig,
);
export const db = getFirestore(app);
if (isEmulator) connectFirestoreEmulator(db, "127.0.0.1", 8080);
