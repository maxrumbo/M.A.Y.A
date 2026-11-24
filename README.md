<div align="center">

# 🌌 M.A.Y.A.
### *Maxwell Admires, Yet Awaits*
**Private AI Executive Secretary & Multi-Device Control Ecosystem**

[![.NET](https://img.shields.io/badge/.NET-9.0%20%7C%2011.0-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.0-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Firebase](https://img.shields.io/badge/Firebase-FCM-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)

---

*M.A.Y.A. adalah asisten kecerdasan buatan personal yang dirancang khusus untuk mendampingi keseharian Maxwell — menghubungkan HP Android, Laptop Asus, dan Cloud menjadi satu kesatuan sistem cerdas yang aman, cepat, dan terenkripsi.*

</div>

---

## 📱 Unduh & Temukan APK Mobile Android

Hasil render build APK disimpan di direktori **[`releases/`](file:///releases/)** di root project. Setiap build diberi nomor versi otomatis tanpa menimpa (*non-cutover*):

| File | Keterangan | Lokasi |
| :--- | :--- | :--- |
| **`maya-latest-debug.apk`** | ⚡ **Build Paling Baru** (Siap install langsung ke HP) | [`releases/maya-latest-debug.apk`](file:///releases/maya-latest-debug.apk) |
| **`maya-v1.0.0-b1-debug.apk`** | 📦 Arsip build versi 1.0.0 (#1) | [`releases/maya-v1.0.0-b1-debug.apk`](file:///releases/maya-v1.0.0-b1-debug.apk) |

> 💡 **Cara Build APK Versi Baru (1 Perintah):**
> ```powershell
> .\scripts\build-apk.ps1
> # atau dari folder maya-client:
> npm run build:apk
> ```
> *Script akan otomatis mem-build web, sinkronisasi Capacitor, kompilasi Gradle, mengarsipkan file dengan nomor build berikutnya (`b2`, `b3`, dst.), dan memperbarui `maya-latest-debug.apk`.*

---

## 🏗️ Arsitektur Sistem

```
 ┌──────────────────────────────────────────────────────────┐
 │               HP Android (Maxwell Phone)                 │
 │   - Capacitor 7 Hybrid Mobile App (React 19 + Vite)      │
 │   - Biometric Keystore (Fingerprint / Face Unlock / PIN) │
 │   - Firebase Cloud Messaging (FCM Background Receiver)   │
 └────────────────────────────┬─────────────────────────────┘
                              │
                    HTTPS / WSS (Secure)
               [ Cloudflare Tunnel / Local LAN ]
                              │
                              ▼
 ┌──────────────────────────────────────────────────────────┐
 │            Maya.Server (Core Web API & Hub)              │
 │   - ASP.NET Core Web API (Port 5000)                     │
 │   - Real-time SignalR Hub (/hubs/maya)                   │
 │   - Google Gemini 2.5 Flash (Adaptive LLM Brain)         │
 │   - AES-256-GCM Encrypted Password Vault                 │
 │   - Google Workspace APIs (Gmail & Calendar)             │
 │   - Firebase Admin SDK (High-Priority Push Data)         │
 └─────────────┬──────────────────────────────┬─────────────┘
               │                              │
         EF Core / TCP                  SignalR WSS
               │                              │
               ▼                              ▼
 ┌───────────────────────────┐  ┌───────────────────────────┐
 │   PostgreSQL 16 (DB)      │  │ Maya.Agent (Laptop Daemon)│
 │ - Docker Container / Cloud│  │ - Telemetri Hardware      │
 │ - Long-Term Memories      │  │ - Media & Volume Control  │
 │ - Chat Conversations      │  │ - Find My Laptop Audio    │
 │ - Encrypted Vault Secrets │  │ - Infinite Auto-Reconnect │
 └───────────────────────────┘  └───────────────────────────┘
```

---

## ✨ Fitur-Fitur Utama

| Modul | Ikon | Deskripsi Kemampuan |
| :--- | :---: | :--- |
| **Adaptive Brain & Persona** | 🧠 | Menggunakan model Gemini 2.5 Flash dengan memori jangka panjang dinamis. Persona suportif, cerdas, berempati, dan adaptif terhadap nada bicara Maxwell. |
| **Laptop Remote Control** | 💻 | Mengatur audio & media (Play/Pause, Next, Prev, Volume), membuka aplikasi kerja (VS Code, Spotify, Terminal), serta memantau CPU, RAM, & Baterai. |
| **Find My Phone & Laptop** | 📍 | Membunyikan alarm darurat dua arah dengan volume maksimal dan getar berpola. HP tetap bisa berbunyi kencang **meskipun aplikasi sedang ditutup total** melalui Firebase FCM. |
| **Encrypted Vault** | 🔐 | Brankas penyimpanan kredensial & kata sandi rahasia terenkripsi **AES-256-GCM** dengan perlindungan Step-Up Authentication (PIN / Biometrik). |
| **Google Workspace Sync** | 📬 | Integrasi OAuth 2.0 untuk membaca ringkasan email belum dibaca di Gmail serta jadwal agenda terdekat di Google Calendar. |
| **Battery & Thermal Guard** | ❄️ | Telemetri SignalR efisien dan fallback polling santai untuk menjaga modem 4G/LTE dan prosesor HP tetap adem dan hemat baterai. |

---

## 🚀 Panduan Menjalankan Sistem

### 1. Prasyarat
* [.NET 9.0 SDK](https://dotnet.microsoft.com/) atau .NET 11.0
* [Node.js 20+](https://nodejs.org/) & npm
* [Docker Desktop](https://www.docker.com/) (untuk PostgreSQL lokal)
* [Android SDK](https://developer.android.com/studio) (jika ingin build APK)

### 2. Jalankan Database Lokal (Docker)
```powershell
docker run -d --name maya-postgres -e POSTGRES_DB=maya -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 --restart unless-stopped postgres:16-alpine
```

### 3. Jalankan Seluruh Sistem (1 Klik)
Gunakan launcher all-in-one di root project:
```powershell
.\run-all.ps1
```
*Script ini akan otomatis melakukan build solution, menyalakan `Maya.Server` (port 5000), menjalankan background daemon `Maya.Agent`, dan membuka frontend Vite.*

* Akses Web Dashboard : **[http://localhost:5000](http://localhost:5000)**
* Swagger API Docs   : **[http://localhost:5000/swagger](http://localhost:5000/swagger)**
* Health Check Status: **[http://localhost:5000/health](http://localhost:5000/health)**

---

## 📂 Struktur Direktori

```text
M.A.Y.A/
├── releases/                # 📱 Pusat arsip APK Android berversi (maya-latest-debug.apk)
├── scripts/                 # 🛠️ Script otomatisasi & verifikasi (build-apk.ps1, verifikasi)
├── maya-client/             # 🌐 Frontend React 19 + Capacitor 7 (Web & Mobile Android)
│   ├── android/             # Project native Android Studio (Java & Gradle)
│   └── src/                 # Komponen UI, layanan SignalR, Audio STT/TTS
├── Maya.Server/             # ⚙️ Backend Web API ASP.NET Core & SignalR Hub
│   ├── Controllers/         # Endpoint Chat, Vault, Memory, Integrasi (Google, FCM)
│   ├── Services/            # Gemini AI, FCM Notification, Vault Cryptography
│   └── Hubs/                # MayaHub (komunikasi dua arah real-time)
├── Maya.Agent/              # 🖥️ Windows Daemon latar belakang laptop Maxwell
├── Maya.Shared/             # 📦 DTO & Data Models bersama
├── run-all.ps1              # 🚀 Launcher all-in-one sistem lokal
└── PRD.md                   # 📋 Dokumen Spesifikasi Produk & Roadmap Lengkap
```

---

<div align="center">

**Dikembangkan dengan dedikasi penuh untuk Maxwell Avinda Rumahorbo.**  
*M.A.Y.A. System v1.0.0 — 2026*

</div>
