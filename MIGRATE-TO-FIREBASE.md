# 🚀 Panduan Migrasi: GitHub Pages → Firebase Hosting

Migrate Skor2u Pro dari `juscinta89-lab.github.io/Sport2u/` ke `skor2u.web.app` (Firebase Hosting).

---

## 🎯 Kenapa Firebase Hosting Lebih Baik?

| Kriteria | GitHub Pages | Firebase Hosting |
|----------|--------------|------------------|
| URL | `juscinta89-lab.github.io/Sport2u/` | `skor2u.web.app` (pendek!) |
| SSL/HTTPS | ✅ | ✅ Auto |
| CDN Global | ⚠️ Slow di Asia | ✅ Pantas di Malaysia |
| Auto authorize untuk Firebase Auth | ❌ Manual | ✅ Auto |
| PWA cache control | ⚠️ Limited | ✅ Full control (`firebase.json`) |
| Same project dengan Firestore | ❌ Berasingan | ✅ Satu tempat |
| Custom domain (cth: skor2u.my) | ✅ | ✅ |
| Cost | Free | Free (Spark plan) |
| Deploy speed | 1-2 minit | ~30 saat |

---

## 📋 Pre-requisite

1. **Node.js** dipasang pada PC anda (versi 18 atau lebih)
   - Download: https://nodejs.org/
   - Pilih "LTS" version
2. **Google account** yang sama dengan Firebase project `skor2u`

---

## 🚀 Langkah-langkah Migrate

### Step 1: Install Firebase CLI

Buka **Terminal** (Mac) atau **Command Prompt** (Windows):

```bash
npm install -g firebase-tools
```

Test installation:
```bash
firebase --version
```
Patut tunjuk versi seperti `13.x.x` atau lebih.

---

### Step 2: Login ke Firebase

```bash
firebase login
```

Browser akan buka — sign-in dengan **Google account yang sama** dengan projek `skor2u`.

Test login:
```bash
firebase projects:list
```
Patut nampak `skor2u` dalam senarai.

---

### Step 3: Setup Local Folder

1. **Extract** zip `skor2u-pro.zip` ke folder local anda
2. Buka Terminal, cd ke folder tersebut:
   ```bash
   cd /path/to/skor2u-pro
   ```
   
   Contoh Mac:
   ```bash
   cd ~/Desktop/skor2u-pro
   ```
   
   Contoh Windows:
   ```bash
   cd C:\Users\YourName\Desktop\skor2u-pro
   ```

3. Verify files ada:
   ```bash
   ls
   # Patut nampak: index.html, css/, js/, assets/, firebase.json, .firebaserc, dll
   ```

---

### Step 4: Setup Hosting (sekali sahaja)

Files `firebase.json` dan `.firebaserc` dah ada dalam zip — jadi anda **tak perlu** run `firebase init`.

Test config:
```bash
firebase use skor2u
```
Patut tunjuk: `Now using project skor2u`.

---

### Step 5: Enable Hosting di Firebase Console

1. Pergi ke [Firebase Console](https://console.firebase.google.com/)
2. Pilih projek **skor2u**
3. Sidebar kiri → **Hosting** → klik **Get Started**
4. Skip langkah CLI (anda dah ada)
5. Klik **Continue** sampai habis setup

---

### Step 6: Deploy Pertama Kali

Dari folder skor2u-pro:

```bash
firebase deploy --only hosting
```

Tunggu ~30 saat. Output akan tunjuk:
```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/skor2u/overview
Hosting URL: https://skor2u.web.app
```

🎉 **Done!** App anda sekarang live di **https://skor2u.web.app**

---

### Step 7: Update Authorized Domains (Penting!)

Firebase Auth perlu authorize domain baru:

1. Firebase Console → **Authentication** → tab **Settings** → **Authorized domains**
2. Klik **Add domain**
3. Tambah:
   - `skor2u.web.app`
   - `skor2u.firebaseapp.com`
4. **Save**

(Note: Selalunya Firebase auto-add domain hosting sendiri. Verify sahaja.)

---

### Step 8: Update Firestore Rules (kalau ada perubahan)

Kalau anda nak update rules sekali:

```bash
firebase deploy --only firestore:rules
```

---

### Step 9: Disable GitHub Pages (Optional)

Selepas confirm `skor2u.web.app` berfungsi:

1. GitHub repo `Sport2u` → **Settings** → **Pages**
2. **Source** → tukar ke **None**
3. Save

Atau tinggalkan GitHub Pages aktif untuk backup.

---

## 🔄 Workflow Selepas Setup

Setiap kali ada update code:

```bash
# 1. Edit files (atau extract zip baru ganti dengan files lama)
# 2. Deploy:
firebase deploy --only hosting
```

That's it! ~30 saat dan dah update di production.

---

## 🌐 Custom Domain (Optional)

Kalau anda nak domain sendiri (cth: `skor2u.my`):

1. Beli domain dari Exabytes / Shinjiru / GoDaddy
2. Firebase Console → **Hosting** → **Add custom domain**
3. Ikut instruction untuk verify ownership (TXT record)
4. Update DNS A records ke Firebase IP yang dibagi
5. Tunggu 24-48 jam untuk DNS propagate
6. SSL auto-provisioned (HTTPS)

---

## 🐛 Troubleshooting

### Error: `firebase: command not found`
→ Node.js tak dipasang dengan betul, atau npm path tak set. Cuba:
```bash
npm install -g firebase-tools
# Atau kalau Mac/Linux:
sudo npm install -g firebase-tools
```

### Error: `HTTP 403: Permission Denied`
→ Login dengan Google account yang **bukan** owner project skor2u. Logout & login balik:
```bash
firebase logout
firebase login
```

### Error: `Error: No project active`
→ Run dalam folder yang takda `.firebaserc`. Cd ke folder skor2u-pro dulu.

### App kosong / blank page
→ Check `firebase.json` — `public` setting kena `"."` (current folder).

### PWA tak update di telefon
→ Service worker cache. User kena uninstall PWA & install balik dari URL baru.

---

## 📊 Monitor Usage

Firebase Console → **Hosting** → tab **Usage**:
- Bandwidth used / month
- Storage size
- Request count

**Free tier (Spark plan)**:
- 10 GB storage
- 360 MB/day bandwidth
- Lebih dari cukup untuk sekolah!

---

## ✅ Checklist

- [ ] Install Node.js + Firebase CLI
- [ ] `firebase login` berjaya
- [ ] Files extracted ke folder local
- [ ] `firebase use skor2u` works
- [ ] Hosting enabled di Firebase Console
- [ ] `firebase deploy --only hosting` berjaya
- [ ] Visit https://skor2u.web.app — app loading
- [ ] Login Google works
- [ ] Add `skor2u.web.app` ke Authorized Domains
- [ ] Test semua features: create event, score, leaderboard
- [ ] Update existing users dengan URL baru
- [ ] (Optional) Disable GitHub Pages

---

## 💡 Tips Tambahan

**Preview before deploy** (untuk test changes):
```bash
firebase hosting:channel:deploy preview
```
Akan dapat URL temporary untuk test sebelum production deploy.

**Rollback** (kalau deploy bermasalah):
```bash
firebase hosting:rollback
```

**Local emulator** (test offline):
```bash
firebase emulators:start --only hosting
# Buka http://localhost:5000
```

---

**Selepas migrate, share URL baharu dengan guru/admin**: https://skor2u.web.app

Selamat deploy! 🚀
