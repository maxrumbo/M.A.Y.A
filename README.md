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

M.A.Y.A. adalah asisten kecerdasan buatan personal yang menghubungkan HP Android, Laptop, dan Cloud ke dalam satu ekosistem yang terintegrasi, aman, dan terenkripsi.

---

## Unduh dan Lokasi APK Mobile Android

Hasil build APK tersimpan di direktori **[`releases/`](releases/)** pada root project. Setiap build diberi nomor versi otomatis tanpa menimpa (*non-cutover*):

| File | Keterangan | Lokasi |
| :--- | :--- | :--- |
| **`maya-latest-debug.apk`** | Build paling baru (siap install langsung ke HP) | [`releases/maya-latest-debug.apk`](releases/maya-latest-debug.apk) |
| **`maya-v1.0.0-b1-debug.apk`** | Arsip build versi 1.0.0 (#1) | [`releases/maya-v1.0.0-b1-debug.apk`](releases/maya-v1.0.0-b1-debug.apk) |

> **Cara Build APK Versi Baru (1 Perintah):**
> ```powershell
> .\scripts\build-apk.ps1
> # atau dari folder maya-client:
> cd maya-client
> npm run build:apk
> ```
> *Script otomatis menjalankan build web frontend, sinkronisasi Capacitor, kompilasi Gradle Android, penomoran build berikutnya (`b2`, `b3`, dst.), serta memperbarui `maya-latest-debug.apk`.*

---

## Arsitektur Sistem

```
 ┌──────────────────────────────────────────────────────────┐
 │                       HP Android                         │
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
 │    PostgreSQL 16 (DB)     │  │ Maya.Agent (Laptop Daemon)│
 │ - Docker Container / Cloud│  │ - Telemetri Hardware      │
 │ - Long-Term Memories      │  │ - Media & Volume Control  │
 │ - Chat Conversations      │  │ - Find My Laptop Audio    │
 │ - Encrypted Vault Secrets │  │ - Infinite Auto-Reconnect │
 └───────────────────────────┘  └───────────────────────────┘
```

---

## Fitur Utama

| Modul | Deskripsi Kemampuan |
| :--- | :--- |
| **Adaptive Brain & Persona** | Menggunakan model Gemini 2.5 Flash dengan memori jangka panjang dinamis. Percakapan kontekstual, berorientasi solusi, dan adaptif terhadap nada interaksi. |
| **Laptop Remote Control** | Mengatur audio dan media (Play/Pause, Next, Prev, Volume), membuka aplikasi kerja (VS Code, Spotify, Terminal), serta memantau penggunaan CPU, RAM, dan sisa baterai laptop secara real-time. |
| **Find My Phone & Laptop** | Alarm darurat dua arah dengan volume maksimal dan getar berpola. HP tetap dapat berbunyi meskipun aplikasi sedang ditutup total via Firebase FCM. |
| **Encrypted Vault** | Brankas penyimpanan kredensial dan kata sandi rahasia terenkripsi AES-256-GCM dengan verifikasi Step-Up Authentication (PIN / Biometrik). |
| **Google Workspace Sync** | Integrasi OAuth 2.0 untuk membaca ringkasan email belum dibaca di Gmail serta jadwal agenda terdekat di Google Calendar. |
| **Battery & Thermal Guard** | Telemetri SignalR efisien dan fallback polling berkala (30s) untuk menjaga radio seluler 4G/LTE dan temperatur HP tetap stabil. |

---

## Panduan Menjalankan Sistem

### 1. Prasyarat
* .NET 9.0 SDK atau .NET 11.0
* Node.js 20+ dan npm
* Docker Desktop (untuk PostgreSQL lokal)
* Android SDK (untuk build APK)

### 2. Menjalankan Database Lokal (Docker)
```powershell
docker run -d --name maya-postgres -e POSTGRES_DB=maya -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 --restart unless-stopped postgres:16-alpine
```

### 3. Menjalankan Seluruh Layanan (1 Perintah)
```powershell
.\run-all.ps1
```
*Script ini otomatis mem-build solution, menjalankan `Maya.Server` (port 5000), mengaktifkan background daemon `Maya.Agent`, dan menjalankan frontend Vite.*

* Web Dashboard: [http://localhost:5000](http://localhost:5000)
* Swagger API Docs: [http://localhost:5000/swagger](http://localhost:5000/swagger)
* Health Check: [http://localhost:5000/health](http://localhost:5000/health)

---

## Struktur Direktori

```text
M.A.Y.A/
├── releases/                # Pusat arsip APK Android berversi (maya-latest-debug.apk)
├── scripts/                 # Script build APK dan pengujian otomatis
├── maya-client/             # Frontend React 19 + Capacitor 7 (Web dan Mobile Android)
│   ├── android/             # Project native Android Studio (Java dan Gradle)
│   └── src/                 # Komponen UI, layanan SignalR, Audio STT/TTS
├── Maya.Server/             # Backend Web API ASP.NET Core dan SignalR Hub
│   ├── Controllers/         # Endpoint Chat, Vault, Memory, Integrasi (Google, FCM)
│   ├── Services/            # Gemini AI, FCM Notification, Vault Cryptography
│   └── Hubs/                # MayaHub (komunikasi real-time dua arah)
├── Maya.Agent/              # Background daemon Windows untuk kontrol laptop
├── Maya.Shared/             # DTO dan model data bersama
├── run-all.ps1              # Launcher all-in-one sistem lokal
└── PRD.md                   # Dokumen Spesifikasi Produk Lengkap
```
