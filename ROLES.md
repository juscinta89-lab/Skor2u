# 👥 Sistem Role — Sport2u v2

Sekarang admin tak perlu buat semua kerja sendiri! Jemput guru, ketua rumah, dan urusetia untuk bantu uruskan event.

## 🎭 4 Jenis Role

| Role | Akses | Sesuai Untuk |
|------|-------|--------------|
| 👑 **Admin** | Akses penuh — semua module | Pengetua / Penyelaras sukan |
| 📝 **Urusetia** | Update markah, tambah acara, tambah atlet (semua rumah) | Guru penolong, AJK sukan |
| 🏠 **Ketua Rumah** | Tambah & uruskan atlet rumah **sendiri sahaja** | Ketua rumah pelajar |
| 👁 **Viewer** | Tengok live scoreboard & leaderboard sahaja | Ibu bapa, pelajar lain |

## 📊 Permission Matrix

| Fungsi | Admin | Urusetia | Ketua Rumah | Viewer |
|--------|:-----:|:--------:|:-----------:|:------:|
| Login dengan Google | ✅ | ✅ | ✅ | ✅ |
| Lihat Dashboard | ✅ | ✅ | ✅ | ❌ |
| Cipta/Edit Event | ✅ | ✅ | ❌ | ❌ |
| Padam Event | ✅ | ❌ | ❌ | ❌ |
| Tambah Acara | ✅ | ✅ | ❌ | ❌ |
| Update Markah | ✅ | ✅ | ❌ | ❌ |
| Tambah Atlet (semua rumah) | ✅ | ✅ | ❌ | ❌ |
| Tambah Atlet (rumah sendiri) | ✅ | ✅ | ✅ | ❌ |
| Lihat senarai atlet | ✅ | ✅ | ✅ (rumah sendiri) | ❌ |
| Cipta Rumah Sukan | ✅ | ❌ | ❌ | ❌ |
| Invite/Buang Ahli | ✅ | ❌ | ❌ | ❌ |
| Lihat Live Scoreboard | ✅ | ✅ | ✅ | ✅ |
| Lihat Leaderboard | ✅ | ✅ | ✅ | ✅ |

---

## 🎯 Use Case Sebenar

### Scenario: Sukan Tahunan Sekolah

**Admin (Pengetua / Ketua Penyelaras)**:
1. Daftar Sport2u → auto jadi admin
2. Cipta event "Sukan Tahunan 2026"
3. Tambah 4 rumah: Merah, Biru, Kuning, Hijau
4. **Invite 4 ketua rumah** (cikgu rumah masing-masing) sebagai **Ketua Rumah**
5. **Invite 2 urusetia** (guru PJ) sebagai **Urusetia**

**Ketua Rumah (4 orang)**:
- Login → terus nampak senarai atlet rumah dia sahaja
- Tambah nama atlet untuk rumah dia
- Tak boleh tengok atlet rumah lain ✅

**Urusetia (2 orang)**:
- Login → boleh tambah acara baru (cth: 100m, 4x100m, Tarik Tali)
- Boleh tambah atlet untuk **mana-mana rumah**
- Hari pertandingan → update markah live (emas/perak/gangsa)

**Viewer (ibu bapa)**:
- Login → terus nampak Live Scoreboard
- Refresh auto, tengok kedudukan terkini

### Hasil:
- ✅ Admin tak penat buat semua sendiri
- ✅ Setiap rumah ada **autonomi** untuk uruskan atlet sendiri
- ✅ Kerja **selari** — ramai orang boleh buat dalam masa sama
- ✅ Data tetap **selamat** (rules enforce role di server)

---

## 📋 Cara Invite Ahli

### Langkah 1: Buka Halaman "Ahli & Jemputan"

Sidebar → klik **"Ahli & Jemputan"** (hanya admin nampak menu ni)

### Langkah 2: Klik "+ Jemput Ahli"

Masukkan:
- **Email Google** ahli (cth: `cikgu.ali@gmail.com`)
- **Pilih role**:
  - Urusetia
  - Ketua Rumah → pilih rumah mana
  - Viewer

### Langkah 3: Selesai!

Beritahu ahli tu untuk login ke Sport2u dengan email Google mereka. Sebaik je login, mereka **terus dapat akses** ikut role yang anda set.

> 💡 **Tip**: Tak perlu hantar invitation email. Cukup beritahu mereka URL app + suruh login dengan email yang anda dah jemput.

---

## 🔐 Bagaimana Security Berfungsi

### Di Frontend (UI)
- Menu sidebar **filter** ikut role — viewer tak nampak menu admin
- Button "Edit/Delete" **disorok** ikut permission
- Navigation **block** kalau cuba akses page tak diizinkan

### Di Backend (Firestore Rules)
- Setiap query dicheck dengan `exists()` pada collection `memberships`
- Deterministic ID format: `{schoolId}_{email}` untuk lookup pantas
- Role validation di server — tak boleh bypass walaupun edit kod frontend!

### Contoh:
Kalau Ketua Rumah cuba (via hack frontend) tambah atlet untuk rumah lain → Firestore rules akan **tolak** sebab field `houseId` di-validate.

---

## 🆕 Apa yang baru dalam v2

✅ **Sistem Membership** — collection `memberships` (top-level)
✅ **4 jenis role** — admin/urusetia/ketua_rumah/viewer
✅ **Smart routing** — viewer auto-direct ke Live Scoreboard
✅ **Filter UI** — menu & button hide berdasarkan role
✅ **Filter data** — ketua rumah hanya nampak atlet rumah sendiri
✅ **Auto-assign house** — ketua rumah tambah atlet auto-masuk rumah dia
✅ **Permission audit** — `recordedBy` & `addedBy` direkod untuk track
✅ **Updated Firestore rules** — semua role enforced di server

---

## ⚠️ Penting!

### 1. Upload Firestore Rules Baru

Selepas update kod, **WAJIB** upload `firestore.rules` yang baru ke Firebase Console:

1. Firebase Console → **Firestore Database** → tab **Rules**
2. Padam semua → paste isi `firestore.rules` baru
3. **Publish**

Tanpa rules baru, sistem membership **tak akan berfungsi**.

### 2. Email Mesti Persis Sama

Email yang anda invite **mesti sama** dengan email Google yang ahli guna untuk login. Case-insensitive (auto-lowercase), tapi typo akan gagal.

### 3. Ahli Boleh Ada Multi-School

Seorang user boleh:
- Jadi **admin** untuk sekolah dia sendiri (auto)
- DAN jadi **urusetia/ketua rumah** untuk sekolah lain

Tapi setiap kali login, dia hanya akses **satu sekolah** pada satu masa (yang ada membership aktif).

---

## 🐛 Troubleshooting

**Ahli login tapi tak nampak data sekolah:**
- Pastikan email dalam membership **sama persis** dengan email Google login
- Pastikan `status: active` (bukan pending)
- Suruh logout & login balik

**"Missing or insufficient permissions"**:
- Upload `firestore.rules` baru (langkah 1 di atas)
- Tunggu 30 saat untuk rules apply

**Ketua rumah nampak semua atlet (bukan rumah sendiri):**
- Pastikan ada `houseId` dalam membership
- Pastikan `houseId` atlet match dengan `houseId` ketua rumah
