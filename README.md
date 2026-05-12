# 🏆 Skor2u Pro v3.1

**Sistem Pengurusan Sukan Profesional untuk Sekolah Malaysia**

Branding penuh dengan logo Skor2u — kombinasi navy dalam ke biru terang.

---

## 🎨 Brand Identity

- **Logo**: `assets/logo.png` (dark text - untuk light mode) & `assets/logo-light.png` (white text - untuk dark mode)
- **Brand Colors**:
  - Deep Navy: `#0a1a3d`
  - Bright Blue: `#1e90ff`
  - Sky Blue: `#4ba8ff`
- **Gradient**: `linear-gradient(135deg, #0a1a3d 0%, #1e90ff 100%)`

Logo akan auto-swap berdasarkan tema (dark/light mode).

---

## ✨ Semua Ciri

### 1. 🏃 Tetapkan Atlet Mewakili Acara
- Setiap acara ada senarai peserta dari setiap rumah sukan
- Set max peserta per rumah (cth: max 2 atlet/rumah untuk 100m)
- UI auto-block bila exceed kuota

### 2. ⏱️ Catatan Masa & Ukuran Olahraga
4 jenis acara disokong:
- **🏃 Balapan**: 100m, 200m, 400m, 800m, 1500m, 5000m, 4x100m, lari berpagar — format `mm:ss.SS`
- **🥏 Padang**: Lompat Jauh/Tinggi/Bergalah, Lontar Peluru, Lempar Cakera/Lembing — unit meter
- **⚽ Berpasukan**: Bola Sepak, Bola Jaring, Hoki, Sepak Takraw
- **🏸 Individu**: Badminton, Tenis, Pingpong, Catur

### 3. 📋 Sistem Pusingan
- Saringan 🏁 → Suku Akhir ⚡ → Separuh Akhir 🔥 → Akhir/Final 🏆

### 4. 📄 Jana Jadual PDF Profesional
- Jadual Perlawanan PDF (header brand navy + footer page numbers)
- Keputusan Penuh PDF
- Leaderboard PDF

### 5. 🎨 Light & Dark Mode
- Toggle dari sidebar
- Logo auto-swap berdasarkan tema
- Persisted dalam localStorage

### 6. 🔒 Role-Based Access Control
- **Admin** (sekolah owner) — semua akses
- **Urusetia** — uruskan event/acara/score
- **Ketua Rumah** — uruskan atlet rumah sendiri sahaja
- **Viewer** — tengok scoreboard sahaja

---

## 🚀 Deploy ke GitHub Pages

1. **Update Firestore Rules**:
   - Firebase Console → Firestore → Rules → paste `firestore.rules` → **Publish**

2. **Push ke GitHub**:
   ```bash
   # Backup folder lama dulu
   git checkout -b v3-rebrand
   
   # Replace files dalam repo Sport2u dengan files dari skor2u-pro/
   git add .
   git commit -m "v3.1 Rebrand to Skor2u with logo"
   git push
   ```

3. **Bila user existing buka app**:
   - PWA cache auto-update sebab `sw.js` version baru (`skor2u-pro-v3.1.0`)
   - Tunggu 5-10 saat → refresh

---

## 🐛 Kalau Ada Error `auth/api-key-not-valid`

Sebab paling biasa: **API Key restrictions di Google Cloud Console**.

### Quick Fix:

1. Pergi ke https://console.cloud.google.com/apis/credentials?project=skor2u
2. Klik API key yang ada
3. **Application restrictions** → pilih **None** (untuk testing)
   - ATAU pilih "HTTP referrers" dan tambah:
     - `https://juscinta89-lab.github.io/*`
     - `http://localhost/*`
4. **Save** → tunggu 5 minit

### Authorized Domains:

Firebase Console → Authentication → Settings → Authorized domains. Mesti ada:
- `localhost`
- `juscinta89-lab.github.io`
- `skor2u.firebaseapp.com`

---

## 📂 File Structure

```
skor2u-pro/
├── index.html              # Landing dengan logo + theme system
├── manifest.json           # PWA manifest (background #050a1f, theme #1e90ff)
├── sw.js                   # Service worker v3.1
├── firestore.rules         # Rules dengan participants subcollection
├── README.md
├── css/
│   └── style.css           # Brand colors + light/dark themes
├── js/
│   ├── firebase-config.js  # Skor2u Firebase config
│   ├── auth.js             # Login (email lowercase + skip own school)
│   └── app.js              # 2160 lines — all modules
└── assets/
    ├── logo.png            # Original (dark text)
    ├── logo-light.png      # Brightened (untuk dark mode)
    ├── icon-192.png        # PWA icon (gradient bg + logo)
    ├── icon-512.png        # PWA icon large
    ├── favicon.png         # Browser tab icon
    └── icon.svg            # Vector fallback
```

---

## 🎮 Cara Guna (Quick Start)

### Setup Awal
1. Login Google → Auto jadi Admin sekolah sendiri
2. **Rumah Sukan** → Tambah rumah (cth: Merah/Biru/Kuning/Hijau)
3. **Atlet** → Daftar atlet untuk setiap rumah

### Cipta Event
1. **Events** → "Cipta Event" → nama/jenis/tarikh
2. Klik event → tab "Acara" → "+ Tambah"
3. Pilih: jenis acara (Balapan/Padang/Team/Individu), kategori, pusingan, max peserta/rumah

### Daftar Peserta untuk Acara
1. Pilih acara → "+ Tambah Peserta"
2. Pilih atlet dari setiap rumah (auto-block bila exceed max)

### Rekod Catatan (Balapan/Padang)
1. Scroll ke "⏱️ Rekod Catatan"
2. Isi masa/ukuran untuk setiap peserta
3. Klik "Simpan Catatan & Kira Ranking"
4. Auto-rank → klik "✅ Sahkan" untuk award mata

### Jana PDF
- Tab "Jadual Perlawanan" → "📄 Jana PDF"
- Tab "Keputusan" → "📄 PDF Keputusan"
- Leaderboard → "📄 PDF"

### Invite Ahli
- **Ahli** → "+ Jemput Ahli" → email + role
- Ahli login dengan email Google sama → auto-dapat akses

---

## 🔧 Technical Stack

- **Frontend**: HTML5, Tailwind CSS (CDN), Vanilla JS (ES6 modules)
- **Backend**: Firebase Auth + Firestore
- **PDF**: jsPDF + jspdf-autotable
- **PWA**: Service Worker (network-first untuk app code)
- **Theming**: CSS Variables + localStorage

---

**Skor2u Pro v3.1 — Rebrand Edition (2026)**
