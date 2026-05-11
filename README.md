# 🏆 Sport2u — Live Sports Management

PWA moden untuk pengurusan sukan sekolah — Live scoreboard, multi-tenant, realtime.

![Sport2u](https://img.shields.io/badge/PWA-ready-00d4ff) ![Firebase](https://img.shields.io/badge/Firebase-realtime-orange) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Ciri-ciri

- 🔐 **Login Google** — Authentication mudah dengan Firebase
- 🏫 **Multi-Tenant** — Setiap sekolah ada data berasingan
- ⚡ **Realtime** — Update live tanpa refresh
- 📱 **PWA** — Boleh install di telefon
- 🏆 **Live Scoreboard** — Markah rumah sukan realtime
- 👥 **Atlet & Rumah Sukan** — Pengurusan lengkap
- 📊 **Auto Kira Mata** — 10/5/3 untuk emas/perak/gangsa
- 🎨 **Modern UI** — Glassmorphism + dark theme

---

## 🚀 Setup (5 langkah mudah)

### 1. Fork & Clone Repo Ini

Klik **"Use this template"** atau fork ke akaun GitHub anda.

### 2. Buat Firebase Project

1. Pergi ke [Firebase Console](https://console.firebase.google.com/)
2. Klik **"Add project"** → namakan `sport2u-yourschool`
3. Disable Google Analytics (optional)
4. Klik **Create project**

### 3. Enable Authentication

1. Di Firebase Console, pergi ke **Authentication** → **Get started**
2. Klik tab **Sign-in method**
3. Pilih **Google** → **Enable** → pilih support email → **Save**

### 4. Setup Firestore

1. Pergi ke **Firestore Database** → **Create database**
2. Pilih **Start in production mode** → pilih location terdekat (asia-southeast1)
3. Pergi ke tab **Rules**, paste rules ni:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users boleh baca/tulis data sendiri
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // School data - hanya owner (schoolId == uid) yang boleh akses
    match /schools/{schoolId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == schoolId;
    }
  }
}
```

Klik **Publish**.

### 5. Dapatkan Firebase Config

1. Di Firebase Console, klik ⚙️ **Project Settings**
2. Scroll ke **Your apps** → klik **Web** icon `</>`
3. Daftar app: `Sport2u Web`
4. Copy `firebaseConfig` object

### 6. Update Config dalam Kod

Buka fail `js/firebase-config.js`, ganti:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Commit & push ke GitHub.

### 7. Deploy ke GitHub Pages

1. Di repo GitHub anda, pergi ke **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` → folder `/ (root)`
4. **Save**

Tunggu 1-2 minit, app anda akan live di:
```
https://YOUR_USERNAME.github.io/REPO_NAME/
```

### 8. Tambah Domain ke Firebase Auth

1. Di Firebase Console → **Authentication** → **Settings** → tab **Authorized domains**
2. Klik **Add domain**, masukkan: `YOUR_USERNAME.github.io`

Selesai! 🎉

---

## 📂 Struktur Project

```
sport2u/
├── index.html              # Landing page + entry point
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline)
├── css/
│   └── style.css           # Styles + animations
├── js/
│   ├── firebase-config.js  # 👈 GANTI dengan config anda
│   ├── auth.js             # Google auth handler
│   └── app.js              # Main app + semua module
└── assets/
    ├── icon.svg
    ├── icon-192.png
    └── icon-512.png
```

---

## 🗄 Struktur Firestore

```
users/
  {uid}/
    nama, email, photoURL, schoolId, schoolName, role

schools/
  {schoolId}/
    events/
      {eventId}/
        name, type, date, location, status
        acara/
          {acaraId}/ name, category, completed
    houses/
      {houseId}/ name, color, points, gold, silver, bronze
    athletes/
      {athleteId}/ name, class, houseId
    results/
      {resultId}/ eventId, acaraId, gold, silver, bronze
```

---

## 🎯 Cara Guna

1. **Login** dengan Google
2. **Tambah Rumah Sukan** (cth: Merah, Biru, Kuning, Hijau)
3. **Daftar Atlet** dan tetapkan rumah masing-masing
4. **Cipta Event Sukan** (cth: Sukan Tahunan 2026)
5. **Tambah Acara** dalam event (cth: 100m, Lompat Jauh)
6. **Rekod Keputusan** — pilih emas/perak/gangsa
7. **Live Scoreboard** auto update untuk semua orang!

---

## 🛠 Tech Stack

- **Frontend**: HTML5 + TailwindCSS (CDN) + Vanilla JS (ES6 modules)
- **Backend**: Firebase Authentication + Firestore (realtime)
- **PWA**: Service Worker + Web Manifest
- **Hosting**: GitHub Pages (percuma)

Tiada build step — terus run! 🚀

---

## ⚠️ Troubleshooting

**Login tak berfungsi?**
- Pastikan Google sign-in enabled di Firebase Authentication
- Tambah `*.github.io` ke authorized domains
- Periksa config dalam `firebase-config.js` betul

**Data tak muncul?**
- Buka Firestore Rules — pastikan dah publish
- Buka browser console (F12) untuk lihat error

**PWA tak boleh install?**
- Pastikan akses guna **HTTPS** (GitHub Pages auto HTTPS)
- Buka di Chrome/Edge mobile untuk dapat install prompt

---

## 📄 License

MIT — Free untuk guna dan ubah suai untuk sekolah anda.

---

**Made with ⚡ for Malaysian schools**
