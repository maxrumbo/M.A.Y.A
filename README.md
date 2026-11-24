# M.A.Y.A.
### Private AI Assistant and Multi-Device Ecosystem

[![.NET](https://img.shields.io/badge/.NET-9.0%20%7C%2011.0-512BD4?style=flat-square&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.0-119EFF?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Firebase](https://img.shields.io/badge/Firebase-FCM-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)

---

M.A.Y.A. adalah asisten kecerdasan buatan personal yang dibangun untuk mendampingi aktivitas harian Maxwell. Sistem ini menjembatani HP Android dan laptop ke dalam satu ekosistem pribadi yang saling terhubung secara aman, memungkinkan kendali jarak jauh, percakapan cerdas yang mengingat konteks, serta automasi tugas secara langsung.

---

## Alur Kerja Ekosistem M.A.Y.A.

Diagram berikut menggambarkan bagaimana setiap perangkat dan layanan saling bertukar data secara langsung:

```mermaid
flowchart TD
    subgraph Klien["Perangkat Maxwell"]
        HP["HP Android (Aplikasi Mobile)"]
        Laptop["Laptop Asus (Daemon Latar Belakang)"]
    end

    subgraph Gerbang["Koneksi Aman"]
        Tunnel["Cloudflare Tunnel / Jaringan Lokal"]
    end

    subgraph Inti["Server Pusat (M.A.Y.A. Core)"]
        Hub["SignalR Hub & Web API"]
        Otak["Google Gemini AI"]
        Brankas["Vault Terenkripsi AES-256"]
        Database[("Database PostgreSQL 16")]
    end

    subgraph Eksternal["Layanan Cloud"]
        FCM["Firebase Cloud Messaging"]
        GoogleSync["Google Workspace (Gmail & Calendar)"]
    end

    HP <-->|Akses Kontrol & Chat| Tunnel
    Tunnel <-->|Komunikasi Enkripsi| Hub
    Hub <-->|Analisis Bahasa Alami| Otak
    Hub <-->|Simpan Memori & Data| Database
    Hub <-->|Akses Data Rahasia| Brankas
    Hub -->|Push Notifikasi Darurat| FCM -->|Bangunkan HP Otomatis| HP
    Hub <-->|Sinkronisasi Agenda & Email| GoogleSync
    Hub <-->|Perintah Kontrol & Telemetri| Laptop
```

---

## Pusat Rilis APK Android (Tanpa Cutover)

Setiap proses build aplikasi Android menghasilkan file APK yang diarsipkan secara rapi di dalam direktori **[`releases/`](releases/)**. Sistem menggunakan penomoran versi berurutan sehingga hasil kompilasi sebelumnya tidak akan tertimpa atau hilang.

```mermaid
flowchart LR
    Kompilasi["1. Jalankan Build APK"] --> Versi["2. Cek Versi & Nomor Build"]
    Versi --> Arsip["3. Simpan ke releases/maya-vX.X-bX.apk"]
    Arsip --> Pointer["4. Salin ke maya-latest-debug.apk"]
    Pointer --> HP["5. Siap Dipasang di HP"]
```

### Daftar File Rilis

| File APK | Keterangan | Lokasi File |
| :--- | :--- | :--- |
| **`maya-latest-debug.apk`** | Rujukan build paling baru (disarankan untuk instalasi) | [`releases/maya-latest-debug.apk`](releases/maya-latest-debug.apk) |
| **`maya-v1.0.0-b1-debug.apk`** | Arsip build versi 1.0.0 nomor rilis 1 | [`releases/maya-v1.0.0-b1-debug.apk`](releases/maya-v1.0.0-b1-debug.apk) |

### Cara Membangun APK Versi Baru

Cukup jalankan satu perintah berikut dari terminal:

```powershell
.\scripts\build-apk.ps1
```

*Atau dari folder `maya-client`:*

```powershell
cd maya-client
npm run build:apk
```

Script akan memproses build web, sinkronisasi native Android, kompilasi Gradle, lalu mengarsipkan file dengan nomor build berikutnya secara otomatis.

---

## Skenario dan Kemampuan Utama

### 1. Kendali Laptop Jarak Jauh
Maxwell dapat mengontrol pemutaran musik, volume, dan memantau status perangkat langsung dari layar HP tanpa harus menyentuh laptop.

```mermaid
sequenceDiagram
    autonumber
    actor Max as Maxwell (HP Android)
    participant Hub as M.A.Y.A. Server
    participant AI as Gemini AI Engine
    participant Lap as Laptop Asus

    Max->>Hub: Tekan tombol Play/Pause atau kirim pesan suara
    Hub->>AI: Identifikasi maksud perintah pengguna
    AI-->>Hub: Eksekusi tool kontrol media laptop
    Hub->>Lap: Teruskan sinyal via SignalR WSS
    Lap->>Lap: Simulasikan tombol media Windows
    Lap-->>Hub: Konfirmasi eksekusi berhasil
    Hub-->>Max: Tampilkan status sukses di layar HP
```

* **Kontrol Multimedia**: Play, pause, jeda lagu, lagu berikutnya, dan pengaturan tingkat volume suara.
* **Telemetri Perangkat**: Pemantauan beban CPU, penggunaan memori RAM, dan status persentase baterai laptop.
* **Peluncur Aplikasi**: Membuka aplikasi kerja harian seperti VS Code, Spotify, Browser, dan Terminal.

---

### 2. Fitur Temukan HP (Find My Phone)
Saat HP terselip atau lupa meletakkan, laptop dapat mengirimkan sinyal darurat untuk membunyikan alarm di HP secara instan.

```mermaid
sequenceDiagram
    autonumber
    actor Max as Maxwell (Laptop / Web)
    participant Hub as M.A.Y.A. Server
    participant FCM as Firebase FCM
    participant HP as HP Android

    Max->>Hub: Klik tombol Temukan HP Saya
    Hub->>FCM: Kirim data message prioritas tinggi
    FCM->>HP: Kirim push notification ke sistem Android
    Note over HP: Layanan latar belakang aktif seketika
    HP->>HP: Naikkan volume alarm ke 100%
    HP->>HP: Mainkan ringtone alarm + getar + suara panduan
    Max->>HP: Ketuk tombol Berhenti di layar HP untuk mematikan
```

* **Tembus Mode Hening**: Volume dinaikkan ke level maksimal secara otomatis.
* **Tetap Aktif Saat Aplikasi Ditutup**: Berkat integrasi Firebase Cloud Messaging, alarm tetap berbunyi walaupun aplikasi HP dalam kondisi mati total.

---

### 3. Otak Cerdas dan Memori Jangka Panjang
Percakapan dengan M.A.Y.A. berlangsung adaptif dan memahami preferensi pribadi Maxwell melalui memori jangka panjang yang terus diperbarui.

```mermaid
flowchart TD
    Pesan["Pesan Baru dari Maxwell"] --> Analisis["Analisis Pesan & Riwayat Obrolan"]
    Memori[("Bank Memori Jangka Panjang")] -->|Ambil Konteks Relevan| Analisis
    Status["Telemetri Laptop & Jam Lokal"] -->|Sertakan Kondisi Nyata| Analisis
    Analisis --> Gemini["Google Gemini 2.5 Flash"]
    Gemini --> Keputusan{"Perlu Tindakan Khusus?"}
    Keputusan -->|Ya, Simpan Memori| Simpan["Catat Kebiasaan/Fakta Baru ke Database"]
    Keputusan -->|Ya, Kendalikan Laptop| Aksi["Kirim Sinyal Perintah ke Laptop"]
    Keputusan -->|Tidak, Cukup Menjawab| Balas["Kirimkan Jawaban Alami & Solutif"]
    Simpan --> Selesai["Tampilkan Respons ke Maxwell"]
    Aksi --> Selesai
    Balas --> Selesai
```

* **Memori Adaptif**: Mengingat preferensi kerja, proyek yang sedang dikerjakan, dan catatan penting.
* **Integrasi Google Workspace**: Mampu merangkum email belum dibaca dari Gmail dan mengingatkan jadwal acara di Google Calendar.

---

### 4. Brankas Terenkripsi (Password Vault)
Penyimpanan akun, token, dan catatan rahasia yang dilindungi enkripsi standar industri AES-256-GCM.

```mermaid
flowchart LR
    Akses["Permintaan Akses Brankas"] --> Verifikasi{"Verifikasi Keamanan"}
    Verifikasi -->|Master PIN / Sidik Jari Sah| Dekripsi["Dekripsi Kunci AES-256-GCM"]
    Verifikasi -->|Gagal| Tolak["Akses Ditolak & Kunci Terkunci"]
    Dekripsi --> Tampil["Tampilkan Data Rahasia Sementara"]
```

---

## Panduan Menjalankan Sistem

```mermaid
flowchart TD
    Step1["Langkah 1: Jalankan Database PostgreSQL (Docker)"] --> Step2["Langkah 2: Jalankan Launcher run-all.ps1"]
    Step2 --> Step3["Langkah 3: Buka Dashboard di Browser atau Pasang APK di HP"]
```

### Langkah 1: Siapkan Database Lokal
Jalankan perintah ini di PowerShell untuk menyalakan container PostgreSQL:
```powershell
docker run -d --name maya-postgres -e POSTGRES_DB=maya -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 --restart unless-stopped postgres:16-alpine
```

### Langkah 2: Jalankan Seluruh Sistem
Gunakan launcher otomatis dari root project:
```powershell
.\run-all.ps1
```

### Langkah 3: Akses Layanan
* Dashboard Web: [http://localhost:5000](http://localhost:5000)
* Dokumentasi API Swagger: [http://localhost:5000/swagger](http://localhost:5000/swagger)
* Status Kesehatan Layanan: [http://localhost:5000/health](http://localhost:5000/health)

---

## Struktur Direktori Repositori

```text
M.A.Y.A/
├── releases/                # Direktori arsip file kompilasi APK Android
├── scripts/                 # Kumpulan script automasi build dan pengujian
├── maya-client/             # Frontend antarmuka pengguna (React 19, Vite, TailwindCSS)
│   ├── android/             # Proyek aplikasi native Android Studio
│   └── src/                 # Komponen antarmuka, SignalR client, audio input/output
├── Maya.Server/             # Layanan backend ASP.NET Core dan SignalR Hub
│   ├── Controllers/         # Endpoint API (Chat, Vault, Memory, Integrasi)
│   ├── Services/            # Logika bisnis Gemini AI, FCM Push, Kriptografi Vault
│   └── Hubs/                # MayaHub untuk pertukaran data real-time
├── Maya.Agent/              # Daemon latar belakang Windows untuk kendali laptop
├── Maya.Shared/             # Model data dan DTO yang dipakai bersama
├── run-all.ps1              # Script launcher satu pintu untuk seluruh layanan
└── PRD.md                   # Dokumen spesifikasi fungsional dan teknis lengkap
```
