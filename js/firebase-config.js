// Sport2u - Firebase Configuration
// IMPORTANT: Ganti config di bawah dengan Firebase project anda sendiri
// Pergi ke: https://console.firebase.google.com/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Firebase config - GANTI dengan config anda sendiri
const firebaseConfig = {
  apiKey: "AIzaSyA2y1MjAhiSsab08pH8DaPYO462nloAoPk",
  authDomain: "skor2u.firebaseapp.com",
  projectId: "skor2u",
  storageBucket: "skor2u.firebasestorage.app",
  messagingSenderId: "824115935883",
  appId: "1:824115935883:web:fb645f22649ae5d07f328e",
  measurementId: "G-T0VHKGVH6D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export untuk digunakan di file lain
export { app, auth, db, googleProvider };
window.firebaseAuth = auth;
window.firebaseDb = db;
window.googleProvider = googleProvider;
