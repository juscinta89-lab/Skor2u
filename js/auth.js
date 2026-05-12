// Skor2u Pro - Authentication
import { auth, db, googleProvider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc, getDoc, getDocs, query, collection, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

window.signInWithGoogle = async function() {
  try {
    document.getElementById('loading-screen').classList.remove('hidden');
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid, nama: user.displayName, email: user.email,
        photoURL: user.photoURL, schoolId: user.uid,
        schoolName: user.displayName + "'s School",
        role: 'admin', createdAt: serverTimestamp(), lastLogin: serverTimestamp()
      });
    } else {
      await setDoc(userRef, { lastLogin: serverTimestamp(), nama: user.displayName, photoURL: user.photoURL }, { merge: true });
    }
    
    showToast('Berjaya log masuk!', 'success');
  } catch (error) {
    console.error('Login error:', error);
    document.getElementById('loading-screen').classList.add('hidden');
    if (error.code === 'auth/popup-closed-by-user') showToast('Login dibatalkan', 'info');
    else if (error.code === 'auth/configuration-not-found' || error.code === 'auth/invalid-api-key') showToast('Firebase config tidak betul', 'error');
    else showToast('Error: ' + error.message, 'error');
  }
};

window.signOutUser = async function() {
  try {
    await signOut(auth);
    showToast('Berjaya log keluar', 'success');
    setTimeout(() => window.location.reload(), 500);
  } catch (error) { console.error('Logout error:', error); }
};

onAuthStateChanged(auth, async (user) => {
  const landingPage = document.getElementById('landing-page');
  const appContainer = document.getElementById('app-container');
  const loadingScreen = document.getElementById('loading-screen');
  
  if (user) {
    landingPage.classList.add('hidden');
    appContainer.classList.remove('hidden');
    loadingScreen.classList.add('hidden');
    
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    let userData = userSnap.exists() ? userSnap.data() : {
      uid: user.uid, nama: user.displayName, email: user.email,
      photoURL: user.photoURL, schoolId: user.uid,
      schoolName: 'My School', role: 'admin'
    };
    
    // BUG FIX: Check membership only for OTHER schools (not own school)
    // Prevents admin from being demoted by invited-self
    try {
      const memberCheck = await checkMembership(user.email, user.uid);
      if (memberCheck) {
        userData = {
          ...userData,
          schoolId: memberCheck.schoolId,
          schoolName: memberCheck.schoolName,
          role: memberCheck.role,
          houseId: memberCheck.houseId || null,
          houseName: memberCheck.houseName || null,
          isOwnSchool: false
        };
      } else {
        userData.isOwnSchool = true;
        if (userData.schoolId === user.uid) userData.role = 'admin';
      }
    } catch (err) {
      console.log('No membership found, using own school');
      userData.isOwnSchool = true;
      if (userData.schoolId === user.uid) userData.role = 'admin';
    }
    
    window.currentUser = userData;
    if (window.initApp) window.initApp(userData);
  } else {
    landingPage.classList.remove('hidden');
    appContainer.classList.add('hidden');
    loadingScreen.classList.add('hidden');
  }
});

// FIX: Case-insensitive email matching + exclude own school
async function checkMembership(email, ownUid) {
  try {
    const emailLower = email.toLowerCase();
    const q = query(
      collection(db, 'memberships'),
      where('email', '==', emailLower),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      // BUG FIX: Skip membership for own school (admin shouldn't be demoted)
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        if (data.schoolId !== ownUid) {
          return data;
        }
      }
    }
    return null;
  } catch (err) {
    console.error('Membership check failed:', err);
    return null;
  }
}

window.showToast = function(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  const colors = {
    success: 'border-green-500 text-green-400',
    error: 'border-red-500 text-red-400',
    info: 'border-neon-blue text-neon-blue',
    warning: 'border-yellow-500 text-yellow-400'
  };
  toast.classList.add(...colors[type].split(' '));
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
};
