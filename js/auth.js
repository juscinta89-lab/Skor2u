// Sport2u - Authentication Module
import { auth, db, googleProvider } from './firebase-config.js';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Login dengan Google
window.signInWithGoogle = async function() {
  try {
    document.getElementById('loading-screen').classList.remove('hidden');
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Simpan/update data user dalam Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // User baru - daftar
      await setDoc(userRef, {
        uid: user.uid,
        nama: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        schoolId: user.uid, // Default: sekolah sendiri = uid
        schoolName: user.displayName + "'s School",
        role: 'admin',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
    } else {
      // User existing - update last login
      await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
    }
    
    showToast('Berjaya log masuk!', 'success');
  } catch (error) {
    console.error('Login error:', error);
    document.getElementById('loading-screen').classList.add('hidden');
    
    if (error.code === 'auth/popup-closed-by-user') {
      showToast('Login dibatalkan', 'info');
    } else if (error.code === 'auth/configuration-not-found' || error.code === 'auth/invalid-api-key') {
      showToast('Sila setup Firebase config dahulu (rujuk SETUP.md)', 'error');
    } else {
      showToast('Error: ' + error.message, 'error');
    }
  }
};

// Logout
window.signOutUser = async function() {
  try {
    await signOut(auth);
    showToast('Berjaya log keluar', 'success');
    window.location.reload();
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  const landingPage = document.getElementById('landing-page');
  const appContainer = document.getElementById('app-container');
  const loadingScreen = document.getElementById('loading-screen');
  
  if (user) {
    // User logged in
    landingPage.classList.add('hidden');
    appContainer.classList.remove('hidden');
    loadingScreen.classList.add('hidden');
    
    // Load user data
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {
      uid: user.uid,
      nama: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      schoolId: user.uid,
      schoolName: 'My School',
      role: 'admin'
    };
    
    window.currentUser = userData;
    
    // Initialize main app
    if (window.initApp) {
      window.initApp(userData);
    }
  } else {
    // User logged out
    landingPage.classList.remove('hidden');
    appContainer.classList.add('hidden');
    loadingScreen.classList.add('hidden');
  }
});

// Toast helper
window.showToast = function(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const colors = {
    success: 'border-green-500 text-green-400',
    error: 'border-red-500 text-red-400',
    info: 'border-neon-blue text-neon-blue'
  };
  
  toast.classList.add(...colors[type].split(' '));
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};
