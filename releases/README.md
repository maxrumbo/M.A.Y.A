# M.A.Y.A. Android APK Releases

Direktori ini adalah pusat arsip hasil kompilasi Android APK M.A.Y.A. yang siap dipasang ke perangkat Android.

---

### Struktur Penamaan File (Seragam & Non-Cutover)
Setiap kali build dijalankan, file diberi penomoran versi berurutan (`v1`, `v2`, `v3`, dst.) tanpa menimpa build sebelumnya:

```text
releases/
├── maya-v1.apk                    <- Build versi 1
├── maya-v2.apk                    <- Build versi 2
├── maya-v3.apk                    <- Build versi 3 (terbaru)
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
4. Menghitung nomor versi berikutnya secara otomatis (`v4`, `v5`, dst.)
5. Menyimpan hasil build sebagai `releases/maya-v{N}.apk`

---

### Cara Pasang ke Perangkat Android
1. Kirim file versi terbaru (misal `maya-v3.apk`) ke HP via USB atau transfer file.
2. Di HP, buka file APK tersebut lalu pilih Install atau Update.
3. Buka aplikasi M.A.Y.A., masukkan Master PIN, dan aplikasi siap digunakan.
