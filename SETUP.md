# 🚀 SETUP RINGKAS Sport2u

## Langkah 1: Firebase

1. Buka https://console.firebase.google.com/
2. **Add project** → namakan apa saja
3. **Authentication** → **Get started** → enable **Google** sign-in
4. **Firestore Database** → **Create** → production mode → asia-southeast1
5. Tab **Rules**, paste & publish:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /schools/{schoolId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == schoolId;
    }
  }
}
```

## Langkah 2: Copy Config

1. **Project Settings** ⚙️ → scroll bawah → klik `</>` Web icon
2. Daftar app → copy `firebaseConfig`
3. Buka `js/firebase-config.js` → ganti config

## Langkah 3: Deploy

1. Push semua ke GitHub
2. **Settings** → **Pages** → Branch `main` → `/root` → Save
3. Live di `https://username.github.io/repo-name/`

## Langkah 4: Authorize Domain

Firebase → **Authentication** → **Settings** → **Authorized domains** → tambah `username.github.io`

## SIAP! 🎉

Login dengan Google → mula tambah rumah sukan & event.
