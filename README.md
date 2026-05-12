# 🏆 Sport2u Pro v3.0

**Sistem Pengurusan Sukan Profesional untuk Sekolah Malaysia**

Versi Pro dengan semua keperluan sukan moden — sama seperti app official Sukan Olympic.

---

## ✨ Fungsi Baharu v3

### 1. 🏃 Tetapkan Atlet Mewakili Acara
- Tambah atlet sebagai **peserta** untuk setiap acara
- **Had peserta per rumah** (cth: max 2 atlet/rumah untuk 100m)
- Auto-validate: tak boleh exceed had setiap rumah
- Group dengan rumah sukan untuk pemilihan mudah

### 2. ⏱️ Catatan Masa & Ukuran Profesional
4 jenis acara olahraga disokong:
- **🏃 Balapan (Track)**: 100m, 200m, 400m, 800m, 1500m, 5000m, 4x100m relay, lari berpagar
  - Format masa: `mm:ss.SS` (cth: `12.34` atau `1:23.45`)
  - Lower = better (auto rank)
- **🥏 Padang (Field)**: Lompat Jauh/Tinggi/Bergalah, Lontar Peluru, Lempar Cakera/Lembing, Rejam Tukul Besi
  - Unit: meter (cth: `5.42m`)
  - Higher = better (auto rank)
- **⚽ Berpasukan**: Bola Sepak, Bola Jaring, Bola Tampar, Hoki, Sepak Takraw
  - Score-based (manual pingat)
- **🏸 Individu**: Badminton, Tenis, Pingpong, Catur
  - Set/game-based

### 3. 📋 Sistem Pusingan (Saringan → Final)
- **Saringan** 🏁 — Pusingan kelayakan
- **Suku Akhir** ⚡ — Top 8
- **Separuh Akhir** 🔥 — Top 4
- **Akhir/Final** 🏆 — Pemenang
- Setiap acara tag dengan pusingan tertentu

### 4. 📄 Jana Jadual PDF Profesional
- **PDF Jadual Perlawanan**: Header sekolah, grouped by pusingan, dengan masa/acara/kategori
- **PDF Keputusan Penuh**: Semua pingat + catatan terbaik
- **PDF Leaderboard**: Kedudukan rumah dengan stats lengkap
- Header gradient + footer page numbers

### 5. 🎨 Light & Dark Mode
- Toggle dari sidebar atau halaman tetapan
- CSS variables — semua komponen auto-update
- Persisted dalam localStorage
- Dual UI: dark untuk indoor, light untuk siang/cetak

### 6. 🏆 Auto-Ranking System
Untuk acara balapan/padang dengan catatan:
- Click "Sahkan Keputusan" → automatik ranking berdasarkan masa/ukuran
- Lower time (balapan) atau higher distance (padang)
- Auto-award emas 🥇 (10 mata), perak 🥈 (5 mata), gangsa 🥉 (3 mata)

---

## 🔒 Bug Fixes dari v2

1. ✅ **Admin tak demoted** bila invite diri sendiri (membership check skip own school)
2. ✅ **Email case-insensitive** matching untuk membership
3. ✅ **Points revert** bila padam acara/event/result (writeBatch atomic)
4. ✅ **No double points** bila update result (revert then re-apply)
5. ✅ **Manual result validation** — tak boleh rumah sama untuk 3 pingat
6. ✅ **Service worker** versioning — cache invalidate auto bila update
7. ✅ **Button disable** semasa submit — no double-submit
8. ✅ **ESC key** tutup modal
9. ✅ **Listener cleanup** semasa navigate untuk elak memory leak

---

## 📂 Struktur Fail

```
sport2u-pro/
├── index.html              # Landing + theme system + jsPDF
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker v3 (network-first)
├── firestore.rules         # Rules dengan participants subcollection
├── css/
│   └── style.css           # CSS variables, light/dark themes
├── js/
│   ├── firebase-config.js  # Firebase init
│   ├── auth.js             # Login + membership (case-insensitive)
│   └── app.js              # 2160 lines — semua modul
├── assets/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon.svg
└── README.md (file ini)
```

---

## 🚀 Deploy

### Step 1: Update Firebase Rules
1. Pergi ke [Firebase Console](https://console.firebase.google.com/) → projek `skor2u`
2. Firestore Database → Rules
3. Paste isi `firestore.rules` → **Publish**

### Step 2: Push ke GitHub
```bash
cd /your/local/Sport2u
# Replace files dengan files dari sport2u-pro.zip
git add .
git commit -m "v3 Pro: Track/Field timing, PDF, themes, rounds"
git push
```

### Step 3: Force Refresh untuk User Existing
PWA cache tau auto-update sebab `sw.js` versi baru. Tapi kalau user dah install PWA, mereka kena:
- Buka app → tunggu 10 saat → refresh
- Atau: Settings → Clear App Storage → reopen

---

## 🎮 Cara Guna v3

### Setup Awal (Admin)
1. Login Google
2. Tambah rumah sukan (Houses) — cth: Merah/Biru/Kuning/Hijau
3. Daftar atlet untuk setiap rumah
4. (Optional) Invite urusetia/ketua rumah dari menu Ahli

### Cipta Event Sukan
1. Events → "Cipta Event" → isi nama/jenis/tarikh/lokasi
2. Klik event → tab "Acara"
3. Tambah acara:
   - **Jenis**: Balapan / Padang / Berpasukan / Individu
   - **Nama**: cth "100m Lelaki Bawah 18"
   - **Kategori**: Lelaki/Perempuan/Campuran
   - **Pusingan**: Saringan / Suku / Separuh / Akhir
   - **Max peserta per rumah**: berapa atlet setiap rumah boleh sertai

### Tetapkan Peserta
1. Klik acara → "+ Tambah Peserta"
2. Pilih atlet (grouped by rumah)
3. UI auto-prevent exceed max per rumah
4. Submit

### Rekod Catatan (Balapan/Padang)
1. Selepas tambah peserta, scroll ke "⏱️ Rekod Catatan"
2. Isi masa/ukuran untuk setiap peserta
   - Balapan: `12.34` atau `1:23.45`
   - Padang: `5.42`
3. Klik "Simpan Catatan & Kira Ranking"
4. Scroll ke "🏆 Keputusan & Pingat" — lihat ranking automatik
5. Klik "✅ Sahkan Keputusan" untuk award mata

### Rekod Keputusan Manual (Berpasukan/Individu)
1. Tambah peserta (atau skip kalau team-based)
2. "Rekod Keputusan Manual" → pilih emas/perak/gangsa dari rumah
3. Validation: tak boleh rumah sama 3x

### Set Jadual & Jana PDF
1. Tab "Jadual Perlawanan"
2. Klik "Set Masa" untuk setiap acara (24-jam format)
3. Klik "📄 Jana PDF" → download jadual lengkap

### Tukar Tema
- Sidebar → "Tukar Tema" button
- Atau Settings → pilih Dark / Light Mode

---

## 🔧 Technical Stack

- **Frontend**: HTML5, Tailwind CSS (CDN), Vanilla JS (ES6 modules)
- **Backend**: Firebase Auth + Firestore
- **PDF**: jsPDF + jspdf-autotable (CDN)
- **PWA**: Service Worker network-first untuk app code, cache-first untuk assets
- **Theming**: CSS Variables + localStorage
- **Hosting**: GitHub Pages

## 📊 Firestore Schema v3

```
users/{uid}                          # Profile + ownership
memberships/{schoolId_email}         # Cross-school access
schools/{schoolId}/
  ├── events/{eventId}               # Event sukan
  │   └── acara/{acaraId}            # + acaraType, round, maxParticipants
  │       └── participants/{pId}     # Atlet → acara mapping
  ├── houses/{houseId}               # + points, gold, silver, bronze
  ├── athletes/{athleteId}
  └── results/{eventId_acaraId}      # + measurements (goldValue, etc)
```

---

## 📞 Support

- Repository: github.com/juscinta89-lab/Sport2u
- Live: juscinta89-lab.github.io/Sport2u

**v3.0.0 — 2026**
