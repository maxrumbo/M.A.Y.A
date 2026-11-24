# M.A.Y.A. Android APK Releases

Direktori ini adalah pusat arsip hasil kompilasi Android APK M.A.Y.A. yang siap dipasang ke perangkat Android.

---

### Struktur Penamaan File (Non-Cutover / Versioned)
Setiap kali build dijalankan, file build sebelumnya tidak ditimpa:

```text
releases/
├── maya-latest-debug.apk          <- Merujuk ke build paling baru (siap install cepat)
├── maya-v1.0.0-b1-debug.apk       <- Arsip build #1
├── maya-v1.0.0-b2-debug.apk       <- Arsip build #2
└── ...
```

---

### Cara Membangun APK Versi Baru

Jalankan perintah berikut:

```powershell
# Dari root project:
.\scripts\build-apk.ps1

# Atau dari folder maya-client:
cd maya-client
npm run build:apk
```

Tahapan build otomatis:
1. Mem-build bundle web frontend (`npm run build`)
2. Sinkronisasi aset ke Android (`npx cap sync android`)
3. Kompilasi APK via Gradle (`gradlew assembleDebug`)
4. Penomoran otomatis build berikutnya (`b2`, `b3`, dst.)
5. Menyalin file ke folder `releases/` dan memperbarui pointer `maya-latest-debug.apk`

---

### Cara Pasang ke Perangkat Android
1. Kirim file `maya-latest-debug.apk` ke HP via USB atau media transfer file.
2. Di HP, buka file APK lalu pilih Install atau Update.
3. Buka aplikasi M.A.Y.A., masukkan Master PIN, dan aplikasi siap digunakan.
