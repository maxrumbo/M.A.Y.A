# 📱 M.A.Y.A. Android APK Releases

Direktori ini adalah pusat arsip hasil kompilasi **Android APK M.A.Y.A.** yang siap diinstal ke HP Android kamu.

---

### 📂 Struktur Penamaan File (Non-Cutover / Versioned)
Setiap kali build dijalankan, APK tidak akan menimpa file lama (*no cutover*). File disimpan dengan skema:

```text
releases/
├── maya-latest-debug.apk          <- Selalu merujuk ke build paling baru (siap install cepat)
├── maya-v1.0.0-b1-debug.apk       <- Arsip build #1
├── maya-v1.0.0-b2-debug.apk       <- Arsip build #2
└── ...
```

---

### 🔨 Cara Membangun APK Versi Baru

Cukup jalankan satu perintah berikut dari terminal:

```powershell
# Menggunakan script PowerShell langsung dari root repo:
.\scripts\build-apk.ps1

# ATAU dari folder maya-client:
cd maya-client
npm run build:apk
```

Script akan otomatis:
1. Mem-build bundle web frontend (`npm run build`)
2. Sinkronisasi aset ke Android (`npx cap sync android`)
3. Kompilasi APK via Gradle (`gradlew assembleDebug`)
4. Memberikan nomor build berikutnya secara otomatis (misal `b2`, `b3`, dst.)
5. Menyalin file ke folder `releases/` ini dan memperbarui `maya-latest-debug.apk`.

---

### 📲 Cara Install ke HP Maxwell
1. Hubungkan HP ke laptop via kabel USB (atau kirim file `maya-latest-debug.apk` lewat WhatsApp / Google Drive).
2. Di HP, buka file APK dan ketuk **Install** / **Update**.
3. Buka M.A.Y.A., masukkan Master PIN, dan aplikasi siap digunakan!
