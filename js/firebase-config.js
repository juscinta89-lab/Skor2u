// Sport2u - Firebase Configuration
// IMPORTANT: Ganti config di bawah dengan Firebase project anda sendiri
// Pergi ke: https://console.firebase.google.com/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Firebase config - GANTI dengan config anda sendiri
const firebaseConfig = {
  apiKey: "AIzaSyDEMO-GANTI-DENGAN-API-KEY-ANDA",
  authDomain: "sport2u-demo.firebaseapp.com",
  projectId: "sport2u-demo",
  storageBucket: "sport2u-demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
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
