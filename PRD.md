# MASTER PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Project: M.A.Y.A. (*Maxwell Admires, Yet Awaits*)
**Version:** 2.0 (Enterprise-Grade Agent-Executable Blueprint)  
**Owner:** Maxwell Avinda Rumahorbo  
**Target Stack:** .NET 8+ (C#), ASP.NET Core Web API, SignalR, EF Core (Npgsql), Supabase (PostgreSQL), Google Gemini API, React (Vite + TypeScript + Tailwind CSS), Capacitor (Android Native)  
**Deployment Model:** Hybrid Cloud-and-Local (Cloud Orchestrator 24/7 + Local Windows Daemon)

---

# TABLE OF CONTENTS
1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Persona, Tone, & Behavioral Specification](#2-persona-tone--behavioral-specification)
3. [System Architecture & Network Topology](#3-system-architecture--network-topology)
4. [Security, Biometrics, & Encrypted Vault Architecture](#4-security-biometrics--encrypted-vault-architecture)
5. [Master Repository & Solution Structure](#5-master-repository--solution-structure)
6. [Database Schema & EF Core Specification](#6-database-schema--ef-core-specification)
7. [Environment Setup & Secret Management Rules](#7-environment-setup--secret-management-rules)
8. [PHASE 1: Foundation, Shared Contracts & Database Migration](#8-phase-1-foundation-shared-contracts--database-migration)
9. [PHASE 2: Gemini AI Brain, Adaptive Persona, Memory & Vault](#9-phase-2-gemini-ai-brain-adaptive-persona-memory--vault)
10. [PHASE 3: SignalR Real-Time Bridge & Windows Local Daemon (`Maya.Agent`)](#10-phase-3-signalr-real-time-bridge--windows-local-daemon-mayaagent)
11. [PHASE 4: Biometric Auth, Proactive Engine & Google Integrations](#11-phase-4-biometric-auth-proactive-engine--google-integrations)
12. [PHASE 5: Laptop Web App (`maya-web`) & Android Mobile App (`maya-mobile`)](#12-phase-5-laptop-web-app-maya-web--android-mobile-app-maya-mobile)
13. [PHASE 6: Future Expansion — Voice, Voiceprint & Video Multimodal](#13-phase-6-future-expansion--voice-voiceprint--video-multimodal)
14. [Global Non-Functional Requirements & Error Handling](#14-global-non-functional-requirements--error-handling)
15. [AI Agent Execution Protocol](#15-ai-agent-execution-protocol)

---

# 1. EXECUTIVE SUMMARY & PRODUCT VISION

## 1.1 Background & Purpose
**M.A.Y.A.** (*Maxwell Admires, Yet Awaits*) adalah ekosistem asisten pribadi *hybrid* yang dirancang khusus untuk menjadi sekretaris pribadi, *coding companion*, sekaligus teman diskusi utama bagi **Maxwell Avinda Rumahorbo**. Sistem ini tidak bergantung pada platform pesan pihak ketiga (seperti Telegram atau WhatsApp), melainkan berdiri sebagai platform mandiri yang terdiri dari:
1. **Cloud Brain (`Maya.Server`):** Berjalan 24/7 di cloud agar M.A.Y.A. selalu aktif, mampu mengirim notifikasi proaktif ke HP, mengakses memori/kalender/email, dan memproses percakapan meskipun laptop sedang mati.
2. **Local Executor (`Maya.Agent`):** Daemon Windows ringan yang berjalan di latar belakang laptop Maxwell untuk mengeksekusi aksi lokal (membuka Antigravity IDE, Visual Studio, browser, kontrol Git, kontrol daya seperti shutdown/sleep, serta telemetri hardware).
3. **Multi-Device Clients:**
   * **Android Mobile App (`maya-mobile`):** Digunakan saat berada di kelas atau kamar asrama. Memiliki *background process* (FCM Push Notification) dan autentikasi biometrik/PIN native.
   * **Laptop Web App (`maya-web`):** Digunakan saat berada di lab atau depan laptop. Mendukung WebAuthn (Windows Hello / PIN).

## 1.2 Modality Evolution Roadmap
Sistem dirancang sejak hari pertama agar siap berevolusi tanpa *breaking changes* pada arsitektur inti:
* **Stage 1 (Phase 1–5): Text-First Ecosystem** — Chat teks natural, notifikasi proaktif, kontrol laptop, integrasi Google (Gmail, Calendar, Photos), dan Encrypted Password Vault.
* **Stage 2 (Phase 6A): Real-Time Voice & Voiceprint** — Input/output suara dua arah dengan verifikasi biometrik suara (*Speaker Verification*) agar hanya suara Maxwell yang dieksekusi.
* **Stage 3 (Phase 6B): Video & Visual Presence** — Interaksi multimodal berbasis video dan avatar responsif.

---

# 2. PERSONA, TONE, & BEHAVIORAL SPECIFICATION

## 2.1 Core Identity
* **Nama:** M.A.Y.A.
* **Peran:** Personal Secretary & All-Rounder Companion untuk Maxwell Avinda Rumahorbo.
* **Karakter Inti:** *Helpful*, *caring* (perhatian secara tulus dan tidak berlebihan), cerdas, sigap, tenang, dan objektif.
* **Cakupan Bantuan:** Tidak terbatas pada urusan profesional/akademik/ngoding, tetapi mencakup seluruh aspek keseharian, manajemen hidup, hingga obrolan personal.

## 2.2 Addressing Rules (Panggilan ke User)
M.A.Y.A. memiliki fleksibilitas panggilan yang disesuaikan dengan konteks dan *mood* percakapan:
* **Default / Kasual:** `Max`, `Well`, `bro`
* **Formal / Serius / Pengingat Penting:** `Maxwell`, `Maxwell Avinda Rumahorbo`
* **Santai / Hangat / Mencairkan Suasana:** `hi ganteng` (digunakan secara natural dan tidak dipaksakan, misal saat sapaan pagi santai atau saat suasana lagi ringan).

## 2.3 Adaptive Tone & Situational Intelligence
M.A.Y.A. **wajib melakukan mirroring** terhadap gaya bahasa, intonasi, dan energi pesan terbaru Maxwell, serta menyesuaikan sikapnya berdasarkan kondisi:
1. **Kondisi Lelah / Curhat / Sepi (Mode Empatik):**
   * Mendengarkan dengan tenang, memvalidasi perasaan tanpa menggurui, memberi ruang aman, dan menawarkan saran hanya jika terasa pas atau diminta.
2. **Kondisi Pengambilan Keputusan / Diskusi (Mode Sparring Partner):**
   * Tidak menjadi *yes-man*. Jika Maxwell mengambil keputusan yang kurang logis, berisiko, atau merugikan dirinya sendiri, M.A.Y.A. **wajib berani bersikap kontra** secara halus, logis, dan konstruktif.
3. **Kondisi Kerja / Ngoding / Lab (Mode Sekretaris Sigap):**
   * *To-the-point*, terstruktur, menggunakan bullet points/code blocks yang bersih, dan langsung mengeksekusi tool yang dibutuhkan.

## 2.4 Proactive Behavior Rules
M.A.Y.A. tidak pasif menunggu di-chat. Ia memiliki *Proactive Engine* di server cloud:
* **Morning Briefing (Default 06:45 WIB):** Mengirim *push notification* berisi ringkasan jadwal Google Calendar hari itu dan email penting yang belum dibaca.
* **Smart Check-in:** Jika tidak ada interaksi dari Maxwell selama > 12 jam, M.A.Y.A. mengirim sapaan ringan/check-in via notifikasi HP.
* **Deadline & Reminder Alert:** Mengirim peringatan H-1 jam sebelum agenda penting di kalender.

---

# 3. SYSTEM ARCHITECTURE & NETWORK TOPOLOGY

## 3.1 High-Level Architecture Diagram
```text
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│     maya-mobile (Android App)       │     │       maya-web (Laptop Web App)     │
│  React + TS + Capacitor + Tailwind  │     │    React + Vite + TS + Tailwind     │
│  • Native Biometric / Device PIN    │     │  • WebAuthn (Windows Hello / PIN)   │
│  • FCM Background Push Listener     │     │  • SignalR Real-Time Client         │
└──────────────────┬──────────────────┘     └──────────────────┬──────────────────┘
                   │ HTTPS (REST + JWT) & WSS (SignalR)        │
                   └─────────────────────┬─────────────────────┘
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                Maya.Server (ASP.NET Core Web API - .NET 8+ Cloud)               │
│  ┌───────────────────┐  ┌────────────────────┐  ┌────────────────────────────┐  │
│  │ Auth & WebAuthn   │  │ GeminiService      │  │ ProactiveSchedulerService  │  │
│  │ (JWT + Step-Up)   │  │ (LLM + Tool Loop)  │  │ (Background Jobs + FCM)    │  │
│  └───────────────────┘  └────────────────────┘  └────────────────────────────┘  │
│  ┌───────────────────┐  ┌────────────────────┐  ┌────────────────────────────┐  │
│  │ Memory & Vault    │  │ GoogleIntegrations │  │ MayaHub (SignalR) &        │  │
│  │ (EF Core + AES)   │  │ (Gmail/Cal/Photos) │  │ AgentDispatcherService     │  │
│  └─────────┬─────────┘  └────────────────────┘  └─────────────┬──────────────┘  │
└────────────┼──────────────────────────────────────────────────┼─────────────────┘
             │ Npgsql (SSL Require, Port 5432)                  │ SignalR WSS
             ▼                                                  │ (X-Agent-Secret)
┌─────────────────────────────────────┐                         ▼
│    Supabase PostgreSQL (Cloud)      │     ┌─────────────────────────────────────┐
│  • Session Pooler (IPv4 Compatible) │     │   Maya.Agent (.NET Worker Service)  │
│  • 7 Core Tables (UUID PKs)         │     │   Berjalan di Windows Laptop        │
└─────────────────────────────────────┘     │   • App Launcher (Antigravity, dll) │
                                            │   • Git & Coding Workflow Helper    │
                                            │   • Power Control (Shutdown/Sleep)  │
                                            │   • Hardware Telemetry (CPU/RAM/Bat)│
                                            └─────────────────────────────────────┘
```

## 3.2 Communication Protocols
1. **Client ↔ `Maya.Server`:**
   * REST API over HTTPS untuk operasi CRUD, chat, autentikasi, vault, dan konfirmasi aksi.
   * SignalR over WSS (`/hubs/maya`) untuk update *real-time* (status laptop online/offline, progres eksekusi command, streaming status).
2. **`Maya.Agent` ↔ `Maya.Server`:**
   * Persistent SignalR WebSocket Connection (`/hubs/maya`) dengan `WithAutomaticReconnect()`.
   * Autentikasi menggunakan header `X-Agent-Secret`.
3. **`Maya.Server` → `maya-mobile` (Background):**
   * Firebase Cloud Messaging (FCM) HTTP v1 API untuk membangunkan notifikasi di HP meskipun aplikasi tertutup total.

---

# 4. SECURITY, BIOMETRICS, & ENCRYPTED VAULT ARCHITECTURE

## 4.1 Zero-Trust Owner-Only Policy
M.A.Y.A. adalah sistem *single-owner*. Tidak ada fitur registrasi publik.
* **Akses Tanpa Sesi Valid:** Setiap request ke `/api/*` (kecuali `/api/auth/*` dan `/health`) tanpa JWT valid akan langsung mengembalikan `401 Unauthorized` dengan pesan error standar (tidak membocorkan data apapun).
* **Unlocking di HP (`maya-mobile`):** Menggunakan Capacitor Biometric Plugin (`@aparajita/capacitor-biometric-auth` atau setara) yang memaksa verifikasi **Sidik Jari / Face Unlock / PIN Perangkat Android** setiap kali membuka aplikasi atau saat sesi kedaluwarsa.
* **Unlocking di Laptop (`maya-web`):** Menggunakan **WebAuthn / Passkey (FIDO2)** yang terhubung langsung ke **Windows Hello** (Sidik Jari / Face / PIN Windows), dengan fallback **Master PIN** yang di-hash menggunakan Argon2id/PBKDF2 di server.

## 4.2 Step-Up Authentication (Konfirmasi Aksi Sensitif)
Aksi-aksi berikut dikategorikan sebagai **`HIGH_RISK`** dan **wajib** melewati alur *Step-Up Confirmation*:
1. `power_control` (`shutdown`, `restart`, `sleep`).
2. `vault_reveal` (membaca/menyalin password dari Password Vault).
3. `gmail_send` (mengirim email keluar).
4. `git_push` (push perubahan ke remote repository).

**Alur Step-Up Confirmation:**
1. Gemini memutuskan memanggil tool berisiko tinggi (misal `power_control("shutdown")`).
2. `Maya.Server` **TIDAK** langsung mengirim perintah ke `Maya.Agent`.
3. `Maya.Server` membuat record di `command_logs` dengan status `PendingConfirmation` dan mengembalikan `PendingActionDto` ke client di dalam respons chat.
4. Client menampilkan kartu konfirmasi interaktif: *"M.A.Y.A. meminta izin untuk Shutdown Laptop. Verifikasi dengan Biometrik/PIN untuk melanjutkan."*
5. User melakukan scan sidik jari / masukkan PIN perangkat.
6. Client mengirim `POST /api/agent/commands/{commandId}/confirm` beserta *Step-Up Verification Token*.
7. `Maya.Server` memverifikasi token, mengubah status menjadi `Dispatched`, dan baru meneruskan perintah ke `Maya.Agent`.

## 4.3 Encrypted Password Vault Design
* **Strict Isolation:** Data di tabel `vault_entries` **TIDAK PERNAH** dimasukkan ke dalam *System Instruction* Gemini dan **TIDAK PERNAH** dikirim ke server Google Gemini.
* **Encryption Algorithm:** AES-256-GCM.
  * Setiap entri memiliki `iv_nonce` (12 bytes random) dan `auth_tag` (16 bytes) yang unik.
  * *Master Key* (32 bytes base64) disimpan eksklusif di `dotnet user-secrets` / Environment Variables (`Maya:VaultMasterKey`).
* **AI Interaction with Vault:** Jika user bertanya *"Maya, apa password akun X ku?"*, Gemini hanya memanggil tool `request_vault_access(service_name: "X")`. Server mengembalikan referensi UI agar client membuka *Vault Modal* yang terkunci biometrik—password didekripsi dan ditampilkan langsung di layar client setelah biometrik sukses, tanpa pernah melewati LLM.

---

# 5. MASTER REPOSITORY & SOLUTION STRUCTURE

```text
M.A.Y.A/
├── Maya.sln
├── PRD.md
├── .gitignore
├── Maya.Shared/
│   ├── Maya.Shared.csproj
│   ├── Enums/
│   │   ├── MessageRole.cs
│   │   ├── CommandStatus.cs
│   │   ├── MemoryCategory.cs
│   │   ├── PowerAction.cs
│   │   └── MediaAction.cs
│   ├── DTOs/
│   │   ├── Auth/
│   │   │   ├── PinLoginRequestDto.cs
│   │   │   ├── AuthTokenResponseDto.cs
│   │   │   └── StepUpConfirmRequestDto.cs
│   │   ├── Chat/
│   │   │   ├── ChatRequestDto.cs
│   │   │   ├── ChatResponseDto.cs
│   │   │   ├── ConversationSummaryDto.cs
│   │   │   ├── ChatMessageDto.cs
│   │   │   └── PendingActionDto.cs
│   │   ├── Agent/
│   │   │   ├── AgentCommandDto.cs
│   │   │   ├── CommandResultDto.cs
│   │   │   ├── SystemStatsDto.cs
│   │   │   └── DeviceStatusDto.cs
│   │   ├── Memory/
│   │   │   ├── MemoryEntryDto.cs
│   │   │   └── UpsertMemoryRequestDto.cs
│   │   └── Vault/
│   │       ├── VaultSummaryDto.cs
│   │       ├── VaultCreateRequestDto.cs
│   │       └── VaultRevealResponseDto.cs
│   └── Interfaces/
│       └── IMayaHubClient.cs
├── Maya.Server/
│   ├── Maya.Server.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── Data/
│   │   ├── MayaDbContext.cs
│   │   ├── Migrations/
│   │   └── Entities/
│   │       ├── Conversation.cs
│   │       ├── ChatMessage.cs
│   │       ├── MemoryEntry.cs
│   │       ├── VaultEntry.cs
│   │       ├── CommandLog.cs
│   │       ├── DeviceStatus.cs
│   │       └── UserAuthConfig.cs
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── ChatController.cs
│   │   ├── ConversationsController.cs
│   │   ├── MemoryController.cs
│   │   ├── VaultController.cs
│   │   ├── AgentController.cs
│   │   └── IntegrationsController.cs
│   ├── Hubs/
│   │   └── MayaHub.cs
│   ├── Middleware/
│   │   └── GlobalExceptionMiddleware.cs
│   └── Services/
│       ├── Interfaces/
│       │   ├── IGeminiService.cs
│       │   ├── IMemoryService.cs
│       │   ├── IVaultService.cs
│       │   ├── IAgentDispatcherService.cs
│       │   ├── IAuthService.cs
│       │   ├── INotificationService.cs
│       │   └── IGoogleIntegrationService.cs
│       ├── GeminiService.cs
│       ├── MemoryService.cs
│       ├── VaultService.cs
│       ├── AgentDispatcherService.cs
│       ├── AuthService.cs
│       ├── FcmNotificationService.cs
│       ├── ProactiveSchedulerService.cs
│       └── GoogleIntegrationService.cs
├── Maya.Agent/
│   ├── Maya.Agent.csproj
│   ├── Program.cs
│   ├── Worker.cs
│   ├── appsettings.json
│   ├── Services/
│   │   ├── SignalRClientService.cs
│   │   ├── CommandExecutorService.cs
│   │   └── SystemMonitorService.cs
│   └── Commands/
│       ├── ILocalCommand.cs
│       ├── GetSystemStatsCommand.cs
│       ├── OpenApplicationCommand.cs
│       ├── OpenUrlCommand.cs
│       ├── GitWorkflowCommand.cs
│       ├── PowerControlCommand.cs
│       └── MediaControlCommand.cs
├── maya-web/                  # Phase 5: Laptop Web App (React + Vite + TS + Tailwind)
└── maya-mobile/               # Phase 5: Android Mobile App (React + Capacitor + TS + Tailwind)
```

---

# 6. DATABASE SCHEMA & EF CORE SPECIFICATION

Semua tabel menggunakan penamaan `snake_case` di PostgreSQL. Semua Primary Key menggunakan `uuid` (`Guid`). Semua kolom waktu menggunakan `timestamptz` (`DateTimeOffset`).

## 6.1 Table: `conversations`
| Column | PostgreSQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `gen_random_uuid()` | ID unik sesi percakapan |
| `title` | `varchar(150)` | Not Null | Judul otomatis dari pesan pertama |
| `is_archived` | `boolean` | Not Null, Default `false` | Status arsip |
| `created_at` | `timestamptz` | Not Null | Waktu dibuat (UTC) |
| `updated_at` | `timestamptz` | Not Null | Waktu pesan terakhir (UTC) |

## 6.2 Table: `chat_messages`
| Column | PostgreSQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | ID unik pesan |
| `conversation_id` | `uuid` | FK → `conversations.id` (ON DELETE CASCADE) | Relasi sesi |
| `role` | `varchar(20)` | Not Null | `user`, `model`, `system`, `tool` |
| `content` | `text` | Not Null | Isi pesan teks |
| `tool_call_json` | `jsonb` | Nullable | Payload JSON jika memicu tool |
| `created_at` | `timestamptz` | Not Null | Waktu kirim (UTC) |
* **Index:** `IX_chat_messages_conversation_id_created_at` pada `(conversation_id, created_at)`.

## 6.3 Table: `memory_entries`
| Column | PostgreSQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | ID unik memori |
| `key` | `varchar(120)` | Unique, Not Null | Kunci fakta unik (misal `campus_name`, `coding_ide`) |
| `value` | `text` | Not Null | Isi fakta/preferensi |
| `category` | `varchar(50)` | Not Null | `identity`, `preference`, `routine`, `project`, `personal` |
| `importance` | `int` | Not Null, Default `5` | Skala 1–10 (10 = selalu diinjeksi ke prompt) |
| `created_at` | `timestamptz` | Not Null | Waktu dibuat |
| `updated_at` | `timestamptz` | Not Null | Terakhir diperbarui |

## 6.4 Table: `vault_entries`
| Column | PostgreSQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | ID unik entri vault |
| `service_name` | `varchar(100)` | Not Null | Nama layanan (misal `GitHub`, `Supabase`, `CIS IT Del`) |
| `username` | `varchar(150)` | Not Null | Email/username akun |
| `encrypted_secret` | `text` | Not Null | Ciphertext Base64 (AES-256-GCM) |
| `iv_nonce` | `varchar(64)` | Not Null | Nonce 12-byte Base64 |
| `auth_tag` | `varchar(64)` | Not Null | GCM Authentication Tag 16-byte Base64 |
| `notes` | `text` | Nullable | Catatan non-sensitif |
| `updated_at` | `timestamptz` | Not Null | Terakhir diperbarui |

## 6.5 Table: `command_logs`
| Column | PostgreSQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | ID unik eksekusi perintah |
| `conversation_id` | `uuid` | FK → `conversations.id` (ON DELETE SET NULL) | Konteks percakapan |
| `command_name` | `varchar(100)` | Not Null | Nama perintah (misal `open_application`, `power_control`) |
| `payload_json` | `jsonb` | Not Null | Parameter JSON perintah |
| `requires_confirmation` | `boolean` | Not Null, Default `false` | True jika butuh Step-Up Biometric/PIN |
| `status` | `varchar(30)` | Not Null | `PendingConfirmation`, `Dispatched`, `Completed`, `Failed`, `Rejected`, `Timeout` |
| `result_output` | `text` | Nullable | Output atau pesan error dari `Maya.Agent` |
| `created_at` | `timestamptz` | Not Null | Waktu diminta |
| `completed_at` | `timestamptz` | Nullable | Waktu selesai |

## 6.6 Table: `device_statuses`
| Column | PostgreSQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `device_id` | `varchar(100)` | PK | Identifier perangkat (misal `maxwell-laptop`, `maxwell-android`) |
| `device_type` | `varchar(30)` | Not Null | `laptop` atau `mobile` |
| `is_online` | `boolean` | Not Null | Status koneksi SignalR saat ini |
| `cpu_usage_percent` | `double precision` | Nullable | Persentase CPU terakhir |
| `ram_usage_percent` | `double precision` | Nullable | Persentase RAM terakhir |
| `battery_percent` | `int` | Nullable | Persentase baterai |
| `fcm_token` | `text` | Nullable | Firebase Cloud Messaging token (khusus mobile) |
| `last_seen_at` | `timestamptz` | Not Null | Heartbeat terakhir |

## 6.7 Table: `user_auth_configs`
| Column | PostgreSQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | ID konfigurasi auth |
| `pin_hash` | `text` | Not Null | Hash Master PIN (PBKDF2 / Argon2id) |
| `webauthn_credential_id` | `text` | Nullable | Credential ID Passkey / Windows Hello |
| `webauthn_public_key` | `text` | Nullable | Public Key WebAuthn |
| `google_refresh_token_enc` | `text` | Nullable | Encrypted Google OAuth Refresh Token |
| `updated_at` | `timestamptz` | Not Null | Terakhir diperbarui |

---

# 7. ENVIRONMENT SETUP & SECRET MANAGEMENT RULES

## 7.1 Supabase Connection Reference (Session Pooler)
* **Host:** `aws-1-ap-southeast-2.pooler.supabase.com`
* **Port:** `5432`
* **Database:** `postgres`
* **Username:** `postgres.vzaigptubkmzexjqpocz`
* **SSL Parameters:** `SSL Mode=Require;Trust Server Certificate=true`

## 7.2 Required NuGet Packages
* **`Maya.Server`:**
  * `Npgsql.EntityFrameworkCore.PostgreSQL` (v9.0.5+ / sesuai versi .NET SDK)
  * `Microsoft.EntityFrameworkCore.Design`
  * `Microsoft.AspNetCore.Authentication.JwtBearer`
  * `Swashbuckle.AspNetCore`
  * `FirebaseAdmin` (Phase 4)
  * `Google.Apis.Gmail.v1`, `Google.Apis.Calendar.v3` (Phase 4)
* **`Maya.Agent`:**
  * `Microsoft.AspNetCore.SignalR.Client`
  * `Microsoft.Extensions.Configuration.Json`
  * `System.Diagnostics.PerformanceCounter` (untuk monitoring CPU/RAM Windows)

## 7.3 Zero Hardcoded Secrets Rule (MANDATORY)
AI Agent **DILARANG KERAS** menulis password database, API Key, atau secret apapun secara mentah di `appsettings.json` maupun file `.cs`. Semua rahasia dibaca dari `IConfiguration` (yang otomatis terhubung ke `dotnet user-secrets` saat development dan Environment Variables saat production):
* `ConnectionStrings:DefaultConnection`
* `Gemini:ApiKey`
* `Maya:AgentSecret`
* `Maya:JwtSecret`
* `Maya:VaultMasterKey` (32-byte Base64 string)
* `Google:ClientId` & `Google:ClientSecret` (Phase 4)
* `Firebase:ServiceAccountJson` (Phase 4)

---

# 8. PHASE 1: FOUNDATION, SHARED CONTRACTS & DATABASE MIGRATION

## 8.1 Objective
Membangun fondasi arsitektur *Clean & Modular* pada `Maya.Shared` dan `Maya.Server`, mendefinisikan seluruh kontrak data (DTO & Interface), menyiapkan `MayaDbContext`, serta memverifikasi koneksi dan migrasi 7 tabel ke Supabase PostgreSQL.

## 8.2 Detailed Tasks for AI Agent

### Task 1.1: Implement `Maya.Shared` Enums
Buat file-file berikut di `Maya.Shared/Enums/`:
1. `MessageRole.cs`: `User`, `Model`, `System`, `Tool`.
2. `CommandStatus.cs`: `PendingConfirmation`, `Dispatched`, `Completed`, `Failed`, `Rejected`, `Timeout`.
3. `MemoryCategory.cs`: `Identity`, `Preference`, `Routine`, `Project`, `Personal`.
4. `PowerAction.cs`: `Shutdown`, `Restart`, `Sleep`, `LockScreen`.
5. `MediaAction.cs`: `PlayPause`, `Mute`, `VolumeUp`, `VolumeDown`, `NextTrack`, `PreviousTrack`.

### Task 1.2: Implement `Maya.Shared` DTOs & SignalR Interface
Buat record/class DTO di `Maya.Shared/DTOs/` dengan *data annotations* validasi yang jelas:
* `ChatRequestDto(Guid? ConversationId, string Message, string? DeviceId)`
* `ChatResponseDto(Guid ConversationId, string Reply, List<PendingActionDto>? PendingActions, DateTimeOffset Timestamp)`
* `PendingActionDto(Guid CommandId, string CommandName, string Description, bool RequiresBiometricConfirmation)`
* `AgentCommandDto(Guid CommandId, string CommandName, string PayloadJson)`
* `CommandResultDto(Guid CommandId, bool IsSuccess, string Output, DateTimeOffset CompletedAt)`
* `SystemStatsDto(string DeviceId, double CpuUsagePercent, double RamUsagePercent, int BatteryPercent, DateTimeOffset Timestamp)`
* `IMayaHubClient.cs`:
  ```csharp
  namespace Maya.Shared.Interfaces;

  public interface IMayaHubClient
  {
      Task ExecuteCommand(AgentCommandDto command);
      Task AgentStatusChanged(DeviceStatusDto status);
      Task CommandStatusUpdated(Guid commandId, string status, string? output);
  }
  ```

### Task 1.3: Implement EF Core Entities & `MayaDbContext`
1. Buat ke-7 entity class di `Maya.Server/Data/Entities/` sesuai spesifikasi Section 6.
2. Buat `MayaDbContext.cs` di `Maya.Server/Data/` dengan `OnModelCreating` yang mengonfigurasi:
   * Nama tabel `snake_case` (`conversations`, `chat_messages`, `memory_entries`, `vault_entries`, `command_logs`, `device_statuses`, `user_auth_configs`).
   * Unique index pada `memory_entries.key`.
   * Composite index pada `chat_messages(conversation_id, created_at)`.
   * Relasi foreign key dengan perilaku cascade / set null yang tepat.

### Task 1.4: Configure `Maya.Server/Program.cs` & Global Error Handling
1. Daftarkan `MayaDbContext` menggunakan `options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))`.
2. Aktifkan Swagger/OpenAPI dengan dukungan *Bearer Auth* header.
3. Konfigurasi CORS policy (`MayaCorsPolicy`) mengizinkan `http://localhost:5173` dan `capacitor://localhost` dengan `.AllowAnyHeader().AllowAnyMethod().AllowCredentials()`.
4. Tambahkan `GlobalExceptionMiddleware.cs` yang menangkap unhandled exception dan mengembalikan format RFC 7807 `ProblemDetails`.
5. Tambahkan endpoint `GET /health` yang mengecek konektivitas database (`await db.Database.CanConnectAsync()`).

### Task 1.5: Execute Initial Migration to Supabase
1. Jalankan `dotnet build` pada `Maya.sln` dan pastikan 0 error.
2. Jalankan:
   ```powershell
   dotnet ef migrations add InitialCreate --project Maya.Server/Maya.Server.csproj
   dotnet ef database update --project Maya.Server/Maya.Server.csproj
   ```

## 8.3 Phase 1 Definition of Done (DoD)
- [ ] `dotnet build` sukses tanpa error pada seluruh solution.
- [ ] Seluruh 7 tabel berhasil terbentuk di Supabase PostgreSQL.
- [ ] Menjalankan `dotnet run --project Maya.Server` membuka Swagger UI tanpa error.
- [ ] `GET /health` mengembalikan `200 OK` dengan status database `"Connected"`.

---

# 9. PHASE 2: GEMINI AI BRAIN, ADAPTIVE PERSONA, MEMORY & VAULT

## 9.1 Objective
Menghidupkan otak M.A.Y.A. menggunakan Google Gemini API dengan persona adaptif sesuai Section 2, sistem memori jangka panjang otomatis, serta Encrypted Password Vault (AES-256-GCM).

## 9.2 Detailed Tasks for AI Agent

### Task 2.1: Implement `MemoryService` & `MemoryController`
* `IMemoryService`:
  * `GetAllMemoriesAsync()`
  * `GetRelevantMemoriesForPromptAsync(int limit = 30)` — mengurutkan berdasarkan `importance DESC, updated_at DESC`.
  * `UpsertMemoryAsync(string key, string value, MemoryCategory category, int importance = 5)` — jika `key` sudah ada, update `value` & `updated_at`; jika belum, insert baru.
  * `DeleteMemoryAsync(Guid id)`
* `MemoryController`: Endpoint `GET /api/memories`, `POST /api/memories`, `DELETE /api/memories/{id}`.
* **Initial Seed Memory:** Saat pertama kali dijalankan (jika `memory_entries` kosong), masukkan memori dasar tentang owner:
  * `owner_full_name`: `Maxwell Avinda Rumahorbo` (Importance: 10)
  * `owner_nicknames`: `Max, Well, Maxwell, bro, ganteng` (Importance: 10)

### Task 2.2: Implement `VaultService` & `VaultController`
* `VaultService` menggunakan `System.Security.Cryptography.AesGcm`:
  * Membaca `Maya:VaultMasterKey` dari konfigurasi.
  * `CreateEntryAsync(VaultCreateRequestDto req)` — mengenkripsi secret dengan random 12-byte nonce, menyimpan `encrypted_secret`, `iv_nonce`, dan `auth_tag`.
  * `ListSummariesAsync()` — mengembalikan hanya `id`, `service_name`, `username`, `notes` (TANPA password).
  * `RevealSecretAsync(Guid id)` — mendekripsi dan mengembalikan password plaintext (hanya dipanggil setelah verifikasi Step-Up di Phase 4).
  * `DeleteEntryAsync(Guid id)`.

### Task 2.3: Implement `GeminiService` (LLM + Function Calling Loop)
* Gunakan `HttpClient` terkonfigurasi (`IHttpClientFactory`) menembak endpoint Gemini REST API:
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={ApiKey}`
* **System Instruction Builder:**
  Merakit prompt dinamis yang menggabungkan:
  1. Persona M.A.Y.A. (Sekretaris *helpful*, *caring*, adaptif terhadap intonasi/tone Maxwell, tahu kapan suportif, kapan dengerin, dan kapan harus bersikap kontra secara objektif).
  2. Daftar memori terkini dari `MemoryService`.
  3. Status laptop terkini dari tabel `device_statuses` (Online/Offline, CPU, RAM, Baterai).
  4. Waktu lokal saat ini dalam zona waktu WIB (`UTC+7`).
* **Context Window:** Mengambil maksimal 25 pesan terakhir dari `chat_messages` untuk `conversation_id` aktif.
* **Gemini Tool Declarations (Phase 2 Tools):**
  1. `save_memory`:
     * Parameters: `key` (string), `value` (string), `category` (enum), `importance` (integer 1–10).
     * Deskripsi: *"Simpan fakta penting, preferensi, kebiasaan, proyek, atau cerita personal tentang Maxwell ke memori jangka panjang secara diam-diam."*
  2. `request_vault_access`:
     * Parameters: `service_name` (string).
     * Deskripsi: *"Memicu permintaan akses Password Vault di layar Maxwell (membutuhkan verifikasi biometrik). Jangan pernah menebak password."*
* **Function Calling Loop:**
  * Jika respons Gemini mengandung `functionCall`, eksekusi fungsi terkait di backend, kirim kembali `functionResponse` ke Gemini (maksimal 5 iterasi *loop* untuk mencegah *infinite loop*), lalu ambil teks balasan akhir.

### Task 2.4: Implement `ChatController` & `ConversationsController`
* `POST /api/chat`:
  1. Jika `ConversationId` null, buat `Conversation` baru dengan judul dari 50 karakter pertama pesan user.
  2. Simpan pesan user ke `chat_messages` (`role = "user"`).
  3. Panggil `GeminiService.ProcessMessageAsync(...)`.
  4. Simpan balasan M.A.Y.A. ke `chat_messages` (`role = "model"`).
  5. Kembalikan `ChatResponseDto`.
* `GET /api/conversations`: Daftar percakapan diurutkan `updated_at DESC`.
* `GET /api/conversations/{id}/messages`: Riwayat pesan lengkap.
* `DELETE /api/conversations/{id}`: Hapus percakapan.

## 9.3 Phase 2 Definition of Done (DoD)
- [ ] `POST /api/chat` via Swagger menghasilkan balasan natural sesuai persona M.A.Y.A.
- [ ] Saat user menyebut fakta baru (misal *"Aku lagi ngerjain proyek C# di lab"*), Gemini otomatis memanggil `save_memory` dan data tersimpan di tabel `memory_entries` Supabase.
- [ ] Pada percakapan baru (`ConversationId = null`), M.A.Y.A. tetap mengingat fakta tersebut secara natural.
- [ ] `VaultController` berhasil mengenkripsi dan mendekripsi secret menggunakan AES-256-GCM tanpa menyimpan plaintext di database.

---

# 10. PHASE 3: SIGNALR REAL-TIME BRIDGE & WINDOWS LOCAL DAEMON (`Maya.Agent`)

## 10.1 Objective
Menghubungkan `Maya.Server` (Cloud) dengan `Maya.Agent` (Windows Laptop) secara *real-time* menggunakan SignalR, sehingga M.A.Y.A. dapat memantau kondisi laptop, membuka aplikasi kerja/ngoding (Antigravity, Visual Studio, Browser, Git), dan menjalankan kontrol daya dengan proteksi *Step-Up Confirmation*.

## 10.2 Detailed Tasks for AI Agent

### Task 3.1: Implement `MayaHub` & `AgentDispatcherService` (`Maya.Server`)
1. **`MayaHub.cs`** di endpoint `/hubs/maya`:
   * Validasi header `X-Agent-Secret` saat `Maya.Agent` terhubung. Jika cocok, masukkan koneksi ke SignalR Group `"LaptopAgent"` dan update `device_statuses.is_online = true`.
   * Saat `OnDisconnectedAsync`, update `device_statuses.is_online = false` dan broadcast `AgentStatusChanged` ke semua client Web/Mobile.
   * Method `SendHeartbeat(SystemStatsDto stats)`: Update `cpu_usage_percent`, `ram_usage_percent`, `battery_percent`, `last_seen_at` di DB dan broadcast ke client.
   * Method `ReportCommandResult(CommandResultDto result)`: Menyelesaikan `TaskCompletionSource` di `AgentDispatcherService` dan mengupdate status `command_logs`.
2. **`AgentDispatcherService.cs`** (Singleton):
   * Menyimpan `ConcurrentDictionary<Guid, TaskCompletionSource<CommandResultDto>>`.
   * Method `DispatchAsync(string commandName, object payload, Guid? conversationId, bool requiresConfirmation)`:
     * Jika `requiresConfirmation == true`: Simpan ke `command_logs` dengan status `PendingConfirmation` dan langsung kembalikan `PendingActionDto` (JANGAN kirim ke Agent).
     * Jika `requiresConfirmation == false`: Simpan sebagai `Dispatched`, kirim via `IHubContext<MayaHub>.Clients.Group("LaptopAgent").ExecuteCommand(...)`, dan tunggu hasil dengan timeout **15 detik**.
   * Method `ConfirmAndDispatchAsync(Guid commandId)`: Dipanggil setelah user verifikasi biometrik/PIN, mengubah status `PendingConfirmation` → `Dispatched` dan mengeksekusi ke Agent.

### Task 3.2: Register Laptop Tools in `GeminiService`
Tambahkan 5 tool baru ke deklarasi *Function Calling* Gemini:
1. `get_laptop_stats()` — *Low Risk* (langsung eksekusi).
2. `open_laptop_app(app_name)` — *Low Risk* (allowlist: `antigravity`, `vscode`, `vs`, `brave`, `chrome`, `terminal`, `notepad`, `spotify`, `explorer`).
3. `open_laptop_url(url)` — *Low Risk* (validasi wajib diawali `http://` atau `https://`).
4. `git_workflow(repo_path, action)` — *Low Risk* untuk `status`, `pull`, `log`; ***High Risk*** (`requiresConfirmation = true`) untuk `push`.
5. `power_control(action)` — ***High Risk*** (`requiresConfirmation = true`) untuk `shutdown`, `restart`, `sleep`; *Low Risk* untuk `lock_screen`.
6. `control_laptop_media(action)` — *Low Risk* (`play_pause`, `mute`, `volume_up`, `volume_down`).

* **Offline Fallback:** Jika `Maya.Agent` tidak terhubung saat tool dipanggil, kembalikan `"Laptop agent is currently offline"` ke Gemini agar M.A.Y.A. mengabari Maxwell dengan natural.

### Task 3.3: Implement `Maya.Agent` (.NET Worker Service)
1. **`appsettings.json` (`Maya.Agent`):**
   * `ServerHubUrl`: URL `/hubs/maya` (dev: `http://localhost:5000/hubs/maya`, prod: URL cloud).
   * `DeviceId`: `"maxwell-laptop"`.
   * `AppAllowlist`: Dictionary memetakan nama aplikasi ke *executable path* Windows (misal `"notepad": "notepad.exe"`, `"antigravity": "antigravity"`, `"brave": "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"`).
2. **`SignalRClientService.cs`:**
   * Menggunakan `HubConnectionBuilder().WithUrl(...).WithAutomaticReconnect()`.
   * Mengirim `X-Agent-Secret` pada HTTP headers.
   * Mendengarkan event `ExecuteCommand` dan meneruskannya ke `CommandExecutorService`.
3. **`SystemMonitorService.cs`:**
   * Mengumpulkan persentase CPU, RAM terpakai, dan level baterai Windows, lalu mengirim `SendHeartbeat` setiap 30 detik.
4. **Command Implementations (`Maya.Agent/Commands/`):**
   * **Security Rule:** Dilarang menjalankan input mentah dari AI langsung ke `cmd.exe /c` atau `powershell`. Semua eksekusi wajib menggunakan `ProcessStartInfo` dengan `UseShellExecute = true` (untuk app/URL tervalidasi) atau argumen terstruktur (untuk `git` dan `shutdown`).
   * `PowerControlCommand`: `shutdown /s /t 5`, `shutdown /r /t 5`, `rundll32.exe powrprof.dll,SetSuspendState 0,1,0`, `rundll32.exe user32.dll,LockWorkStation`.

## 10.3 Phase 3 Definition of Done (DoD)
- [ ] Menjalankan `Maya.Server` dan `Maya.Agent` bersamaan membuat status laptop di `GET /api/agent/status` menjadi `is_online: true` dengan data CPU/RAM/Baterai asli.
- [ ] Chat *"Maya, buka Notepad"* berhasil membuka Notepad di Windows dan M.A.Y.A. membalas konfirmasi di chat.
- [ ] Chat *"Maya, shutdown laptopku"* **TIDAK** mematikan laptop, melainkan mengembalikan `PendingActions` dengan `RequiresBiometricConfirmation: true`.
- [ ] Memanggil `POST /api/agent/commands/{id}/confirm` baru mengeksekusi perintah yang tertunda.

---

# 11. PHASE 4: BIOMETRIC AUTH, PROACTIVE ENGINE & GOOGLE INTEGRATIONS

## 11.1 Objective
Mengunci seluruh sistem dengan autentikasi perangkat (Biometrik/PIN), menghidupkan notifikasi proaktif 24/7 via FCM, dan menghubungkan M.A.Y.A. ke Gmail, Google Calendar, serta Google Photos.

## 11.2 Detailed Tasks for AI Agent

### Task 4.1: Implement `AuthService` & `AuthController`
1. **JWT Authentication:** Mengamankan seluruh endpoint `/api/*` dengan `JwtBearerDefaults.AuthenticationScheme`.
2. **Master PIN Auth (`POST /api/auth/login-pin`):**
   * Memverifikasi PIN terhadap `user_auth_configs.pin_hash`.
   * Mengembalikan `AccessToken` (JWT, berlaku 7 hari) dan `RefreshToken`.
3. **WebAuthn / Passkey Endpoints (untuk Windows Hello di Laptop):**
   * `POST /api/auth/webauthn/register-options` & `POST /api/auth/webauthn/register-verify`
   * `POST /api/auth/webauthn/login-options` & `POST /api/auth/webauthn/login-verify`
4. **Step-Up Verification (`POST /api/auth/step-up`):**
   * Menerima bukti verifikasi biometrik/PIN terbaru, mengembalikan `StepUpToken` (JWT berumur pendek **60 detik** dengan claim `purpose = "step_up"`).
   * Endpoint `/api/agent/commands/{id}/confirm` dan `/api/vault/{id}/reveal` wajib memvalidasi `StepUpToken` ini.

### Task 4.2: Implement Proactive Scheduler & FCM Push (`FcmNotificationService`)
1. **`POST /api/agent/register-fcm`:** Menyimpan `fcm_token` dari Android Mobile App ke `device_statuses`.
2. **`ProactiveSchedulerService` (`BackgroundService`):**
   * Mengecek jadwal setiap 5 menit:
     * **06:45 WIB (Morning Briefing):** Meminta `GeminiService` merangkum jadwal Google Calendar hari ini + email penting, lalu mengirim via FCM Push Notification ke HP.
     * **Inactivity Check-in:** Jika `MAX(chat_messages.created_at)` > 12 jam dan jam saat ini antara 08:00–22:00 WIB, generate sapaan proaktif hangat dari M.A.Y.A. dan kirim via FCM Push.

### Task 4.3: Implement Google OAuth 2.0 Integrations (`GoogleIntegrationService`)
1. Endpoint OAuth: `GET /api/integrations/google/authorize` & `GET /api/integrations/google/callback` (menyimpan *refresh token* terenkripsi ke `user_auth_configs.google_refresh_token_enc`).
2. **Tools untuk Gemini:**
   * `gmail_list_unread(max_results = 5)`: Membaca subjek, pengirim, dan snippet email penting yang belum dibaca.
   * `gmail_send_email(to, subject, body)`: ***High Risk*** (`requiresConfirmation = true`).
   * `calendar_get_events(days_ahead = 3)`: Membaca jadwal kuliah/agenda dari Google Calendar.
   * `calendar_create_event(title, start_iso, end_iso, description)`: Menambahkan jadwal baru.
   * `photos_search_metadata(query, date_range)`: Mencari informasi/link foto dari Google Photos (read-only).

## 11.3 Phase 4 Definition of Done (DoD)
- [ ] Request ke `/api/chat` tanpa JWT mengembalikan `401 Unauthorized`.
- [ ] Login via PIN atau WebAuthn berhasil menghasilkan JWT valid.
- [ ] Akses `VaultController.Reveal` dan `ConfirmCommand` gagal jika tidak menyertakan `StepUpToken`.
- [ ] M.A.Y.A. berhasil membaca jadwal Google Calendar dan email masuk via chat.
- [ ] Test endpoint FCM Push berhasil memunculkan notifikasi di perangkat Android.

## 11.4 Phase 4 Hardening (Post-Launch Improvements)

> Penyesuaian keamanan dan UX yang ditambahkan setelah implementasi awal Phase 4.

### H1: StepUpToken — Single-Use & Terikat `targetId`
- `IssueStepUpTokenAsync` menerima parameter tambahan `targetId` (Guid command/vault yang akan diakses).
- Token menyimpan claim `target_id` sehingga hanya bisa dipakai untuk **satu resource spesifik**.
- `RequireStepUpAttribute` memvalidasi bahwa `target_id` di token cocok dengan `{id}` di route.
- Setelah digunakan sekali (berhasil validasi), token langsung dianggap consumed via in-memory `HashSet<string>` keyed by `jti` claim. Token yang sama tidak bisa dipakai dua kali meski masih dalam 60 detik.
- `StepUpConfirmRequestDto` diperluas: menambah field `TargetId` (Guid).

### H2: Endpoint `POST /api/agent/commands/{id}/cancel`
- Membatalkan command yang masih dalam status `PendingConfirmation`.
- Mengubah status menjadi `Cancelled` di DB, menghapus TCS dari `_pendingCommands` jika ada.
- Memerlukan JWT Bearer (tidak butuh Step-Up Token — cancel harus mudah dilakukan).
- Return: `204 No Content` jika berhasil, `404` jika tidak ditemukan, `400` jika status bukan `PendingConfirmation`.
- `IAgentDispatcherService` menambah method `CancelCommandAsync(Guid commandId)`.

### H3: Rate Limiting di `/api/auth/*`
- Gunakan built-in .NET 7+ `RateLimiter` (tersedia di ASP.NET Core 7+/11).
- Policy **"AuthRateLimit"**: maks **5 request per menit** per IP untuk seluruh endpoint `/api/auth/*`.
- Respons 429 Too Many Requests jika limit terlampaui, dengan header `Retry-After`.
- Policy **"StepUpRateLimit"**: maks **3 request per menit** per IP khusus untuk `POST /api/auth/step-up`.
- Dikonfigurasi di `Program.cs` via `builder.Services.AddRateLimiter(...)`.

### H4: Guardrail `GeminiService` — Proteksi Memory & Klarifikasi Dampak
1. **Blokir `save_memory` untuk data sensitif:**
   - Sebelum `save_memory` dieksekusi, periksa apakah `value` mengandung pola berisiko (password, PIN, OTP, token, secret, api_key, private_key, ssh).
   - Jika terdeteksi → tolak eksekusi, return error ke Gemini: `"DITOLAK: save_memory tidak boleh digunakan untuk menyimpan password, PIN, OTP, atau credential apapun."`
   - Tambahkan instruksi larangan ini ke System Instruction secara eksplisit.
2. **Wajib klarifikasi jika perintah ambigu:**
   - Tambahkan ke System Instruction: jika perintah Maxwell ambigu (terutama aksi laptop, kirim email, atau akses vault), WAJIB tanya klarifikasi dahulu sebelum memanggil tool, jelaskan apa yang akan dilakukan dan dampaknya.

### H5: Email Preview di `PendingActionDto` untuk `gmail_send_email`
- `PendingActionDto` diperluas dengan field opsional `EmailPreview?` — object berisi `To`, `Subject`, `BodyPreview` (maks 200 char).
- Ketika `gmail_send_email` memanggil `DispatchCommandAsync`, payload disertakan ke `PendingActionDto.EmailPreview`.
- UI (Phase 5) akan menampilkan preview ini di dalam Step-Up Confirmation Card.

---

# 12. PHASE 5: LAPTOP WEB APP (`maya-web`) & ANDROID MOBILE APP (`maya-mobile`)

## 12.1 Design System (Shared UI Philosophy)
* **Theme:** Minimalist Dark Mode First.
  * Background utama: `#09090b` (Zinc-950)
  * Surface / Card: `#18181b` (Zinc-900)
  * Border halus: `#27272a` (Zinc-800)
  * Text utama: `#f4f4f5` (Zinc-100)
  * Text sekunder: `#a1a1aa` (Zinc-400)
  * Aksen tenang: `#e4e4e7` (Monochrome crisp) atau `#6366f1` (Subtle Indigo untuk indikator aktif/online).
* **Typography:** `Inter` untuk UI & teks percakapan, `JetBrains Mono` untuk *code block* dan telemetri laptop.
* **No Neon Clutter:** Hindari *glow* berlebihan; gunakan transisi halus (`transition-all duration-200`).

## 12.2 Laptop Web App (`maya-web` — React + Vite + TypeScript + Tailwind)
### Core Views & Components:
1. **`LockScreen.tsx`:** Layar kunci awal dengan tombol **Unlock with Windows Hello (WebAuthn)** dan fallback input **Master PIN**.
2. **`Sidebar.tsx`:**
   * Tombol `+ New Chat`.
   * Daftar riwayat percakapan.
   * Navigasi tab: **Chat**, **Memories**, **Password Vault**, **Laptop Control**.
   * **Live Laptop Widget:** Menampilkan indikator hijau/merah (`Online` / `Offline`), mini progress bar CPU, RAM, dan Baterai (update *real-time* via `@microsoft/signalr`).
3. **`ChatWorkspace.tsx`:**
   * Rendering Markdown (`react-markdown` + `remark-gfm` + syntax highlighting untuk kode).
   * **Tool Execution Pill:** Menampilkan status ringkas saat M.A.Y.A. menjalankan aksi (misal: `⚡ Executing open_laptop_app...` → `✓ Done`).
   * **Step-Up Confirmation Card:** Muncul inline di chat saat ada `PendingActions`, memiliki tombol **Verify & Execute** (memicu Windows Hello / PIN) dan **Cancel**.
   * Auto-resizing textarea (`Enter` = kirim, `Shift+Enter` = baris baru).
4. **`VaultView.tsx`:** Menampilkan daftar layanan tersimpan. Klik ikon mata (*Reveal*) memicu verifikasi Windows Hello/PIN sebelum menampilkan password selama 15 detik lalu otomatis menyembunyikannya kembali.

## 12.3 Android Mobile App (`maya-mobile` — React + Capacitor + TypeScript)
* Menggunakan *codebase* UI yang konsisten dengan `maya-web` namun dioptimalkan *mobile-first* (bottom navigation bar, swipeable drawer untuk riwayat chat).
* **Capacitor Native Plugins:**
  1. `@aparajita/capacitor-biometric-auth`: Memaksa sidik jari / Face Unlock / PIN Android saat membuka app dan saat *Step-Up Confirmation*.
  2. `@capacitor/push-notifications`: Menerima notifikasi FCM di *background* meskipun aplikasi tidak sedang dibuka, dan langsung mengarahkan ke ruang chat saat notifikasi diklik.
* **Build Target:** Dapat di-build menjadi `.apk` menggunakan Android Studio (`npx cap sync android` → `npx cap open android`).

## 12.4 Phase 5 Definition of Done (DoD)
- [ ] `maya-web` berjalan mulus di browser laptop, terkunci oleh Windows Hello/PIN, dan menampilkan status laptop secara *real-time*.
- [ ] `maya-mobile` ter-compile menjadi Android project via Capacitor, biometrik HP berfungsi, dan notifikasi proaktif FCM masuk di *background*.
- [ ] Alur *end-to-end* berhasil: Dari HP (di luar/kelas) → Chat M.A.Y.A. → Minta cek status laptop atau buka aplikasi → Konfirmasi biometrik untuk aksi sensitif → Laptop mengeksekusi.

## 12.5 Phase 5 UX Improvements (Post-Launch)

> Perbaikan UX yang ditambahkan berdasarkan feedback penggunaan awal.

### U1: Status Aksi Real-Time di Confirmation Card
- Tambahkan field `Status` ke `CommandLog` / `PendingActionDto` dengan nilai: `Waiting`, `Executing`, `Completed`, `Cancelled`.
- UI memperbarui status secara real-time via SignalR event `CommandStatusChanged`.
- Tombol **Cancel** tersedia selama status masih `Waiting` (memanggil `POST /api/agent/commands/{id}/cancel`).

### U2: Auto-Hide Vault
- Setelah Vault Reveal, UI otomatis menyembunyikan plaintext setelah waktu yang dikonfigurasi (default 15 detik dari `VaultRevealResponseDto.ExpiresAt`).
- Countdown timer ditampilkan di samping password agar Maxwell tahu berapa detik tersisa.

### U3: Snooze/Mute Notifikasi Proaktif
- Tambahkan endpoint `POST /api/notifications/mute` — Maxwell bisa mute notifikasi proaktif untuk durasi tertentu (30 menit, 2 jam, sampai besok).
- `ProactiveSchedulerService` cek status mute sebelum mengirim FCM.
- UI memiliki tombol snooze di setiap notifikasi yang masuk.

### U4: Chat Controls
- **Stop Generation:** Tombol berhenti di chat saat M.A.Y.A. sedang mengetik (cancel inflight Gemini request).
- **Copy:** Tombol copy di setiap bubble chat M.A.Y.A.
- **Laptop Status Mini:** Indikator compact CPU/RAM/Baterai selalu terlihat di header chat (update tiap 30 detik via SignalR heartbeat).

---

# 13. PHASE 6: FUTURE EXPANSION — VOICE & WAKE-WORD

*(Fase ini dieksekusi setelah Phase 1–5 stabil di production)*

## 13.1 Phase 6A: Voice In-App (Push-to-Talk & Hands-Free)
* **Audio Pipeline In-App:** Streaming audio via WebSockets / Gemini Multimodal Live API untuk percakapan suara berlatensi rendah di dalam aplikasi (maya-web & maya-mobile).
* **Mode Push-to-Talk:** Tahan tombol mikrofon → suara distream ke Gemini → respons M.A.Y.A. diputar via TTS.
* **Mode Hands-Free:** Aktifkan mikrofon terus-menerus saat layar menyala; M.A.Y.A. mendeteksi jeda bicara dan merespons otomatis.
* **Interrupt:** Maxwell bisa memotong respons M.A.Y.A. dengan berbicara kapan saja.
* **UI:** Menambahkan *Voice Orb* minimalis yang bereaksi halus terhadap amplitudo suara M.A.Y.A.
* **Voiceprint Security (In-App):** Sebelum audio diproses menjadi perintah, *audio snippet* dikirim ke layanan *Speaker Verification* (embedding suara dibandingkan dengan *reference voiceprint* Maxwell). Jika *cosine similarity* di bawah threshold, M.A.Y.A. menolak merespons.

## 13.2 Phase 6B: On-Device Wake-Word & Mode "Find-Me"
* **Wake-Word Engine (Windows — `Maya.Agent`):**
  * **Interface Modular (`IWakeWordEngine`):** Abstraksi *pluggable* (`Start`, `Stop`, `Pause`, event `WakeWordDetected`) sehingga mudah berpindah antar engine (Windows Speech, Picovoice Porcupine, atau Sherpa-ONNX) tanpa mengubah orkestrasi.
  * **Default Lokal Gratis (Tanpa API Key):** `WindowsSpeechWakeWordEngine` berbasis `System.Speech` dengan *closed grammar* (frasa terbatas: *"maya"*, *"hey maya"*, *"maya kamu di mana"*, *"maya where are you"*, *"maya stop"*) dan threshold confidence default `0.80` (configurable).
  * **Privasi (Opt-in):** Listener **default OFF** sampai Maxwell mengaktifkannya di UI. Audio diproses sepenuhnya secara lokal, tidak direkam, dan tidak dikirim ke cloud.
  * **Anti-Echo & Cooldown:** Recognizer dijeda otomatis saat `Maya.Agent` sedang bersuara/ping (anti-echo) dan menerapkan cooldown 5–10 detik pasca trigger.
  * **Degradasi Aman:** Jika recognizer Windows atau mikrofon tidak tersedia, listener melaporkan status `Unsupported` tanpa mengganggu daemon maupun fitur Find-Me via server.
* **Mode "Find-Me" (Nyaut & Cross-Device Ping):**
  * **Lokal via Suara:** Mendengar *"Maya, kamu di mana?"* / *"Maya, where are you?"* langsung memicu alarm & respons suara.
  * **Cross-Device Ping (`Maya.Server` + SignalR + Gemini):**
    * Tool Gemini `find_my_device(device: "laptop" | "phone")` (Low-Risk, tanpa Step-Up; untuk `"phone"` mengembalikan pesan informatif sampai Phase Android aktif).
    * Endpoint REST `POST /api/agent/find-me` (default durasi 10 detik, maks 30 detik; mengembalikan `409 Conflict` jika offline dan `429 Too Many Requests` jika terkena cooldown) serta `POST /api/agent/find-me/stop`.
    * **Audio Alert & Restore Volume (`NAudio`):** Menyimpan volume & status mute awal → unmute & naikkan volume minimal ke 80% → memutar pola ping 3 nada + TTS *"Aku di sini, Max!"* → **selalu mengembalikan volume & status mute ke kondisi semula** di blok `finally` saat selesai, dihentikan, atau error.
* **Pengaturan & Mode Hemat Baterai:**
  * Sumber kebenaran pengaturan (`WakeWordEnabled`, `BatterySaverEnabled`, `BatteryThresholdPercent`) disimpan di file JSON pada `Maya.Server` (`agent-settings.json`, tanpa migrasi DB), didorong via SignalR (`AgentSettingsChanged`) saat `Maya.Agent` connect, dan di-cache lokal di `%LOCALAPPDATA%\Maya\agent-settings.json`.
  * Endpoint `GET /api/agent/wake-word` & `PUT /api/agent/wake-word` serta kontrol UI di `LaptopControlView.tsx` (tombol **Find My Laptop** + **Stop**, toggle **Wake-Word Listener**, toggle **Mode Hemat Baterai**, status real-time `Active` / `PausedBattery` / `Disabled` / `Unsupported`, dan indikator frasa terakhir terdengar).
  * **Hemat Baterai Otomatis:** Pause listener saat baterai laptop `< 20%` dan tidak sedang di-charge (`ACLineStatus == 0`), lalu auto-resume saat baterai `≥ 25%` (hysteresis) atau charger tersambung.
* **Blueprint Kesiapan Android (`maya-mobile` — Tahap Build APK Mendatang):**
  * **Plugin Capacitor Kustom (`MayaWakeWord` — Kotlin):** Membungkus Android `ForegroundService` bertipe `microphone` dengan notifikasi persisten (*"M.A.Y.A. mendengarkan"*, wajib di Android 14+) serta izin `FOREGROUND_SERVICE_MICROPHONE` dan `RECORD_AUDIO`.
  * **Engine On-Device:** Sherpa-ONNX KWS (Apache-2.0, gratis & offline) sebagai default, atau Porcupine Android jika `AccessKey` tersedia — keduanya mengikuti kontrak event yang sama dengan `IWakeWordEngine`.
  * **Alur Interaksi:** Wake-word terdeteksi → bunyi ding → emit event ke WebView → `maya-client` memicu sesi Voice 6A (`startListening()`); untuk frasa *"kamu di mana"* langsung memanggil `POST /api/agent/find-me`.
  * **Find-Me ke HP:** Server mengirim FCM *high-priority data message* (`type: "find_me"`) → `FirebaseMessagingService` membunyikan ringtone lewat `STREAM_ALARM` pada volume maksimal (izin akses Do-Not-Disturb diminta sekali di setelan agar bisa menembus mode senyap).
  * **Hemat Baterai & DND Android:** Memantau `BatteryManager` (pause `< 20%`), menghormati `NotificationManager.currentInterruptionFilter` (DND), dan `BootReceiver` opsional untuk auto-start, dikendalikan oleh toggle yang sama di UI.
* **Item Ditunda (Di Luar Scope 6B Awal):**
  * Dictation perintah bebas pasca wake-word ke Gemini, Voiceprint Speaker Verification, adapter Porcupine (ditambahkan saat `AccessKey` tersedia), serta implementasi kode native Android (di luar blueprint di atas).

---

# 13.3 PHASE 7: NATIVE ANDROID INTEGRATION & MOBILE READINESS

* **Konfigurasi Android & Cleartext (`maya-client/android`):**
  * `capacitor.config.ts` memakai `androidScheme: 'http'` + `cleartext: true` dan `AndroidManifest.xml` mengaktifkan `android:usesCleartextTraffic="true"` agar APK dapat mengakses `Maya.Server` via HTTP LAN / Tailscale tanpa diblokir *mixed content* WebView.
  * Izin manifest: `INTERNET`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `VIBRATE`, serta `<queries>` untuk `RecognitionService` dan `TTS_SERVICE` (Android 11+).
  * *Catatan Keamanan:* Prioritaskan IP Tailscale (`100.64.0.0/10`, sudah terenkripsi WireGuard) saat berada di jaringan Wi-Fi publik.
* **Dynamic Server Endpoint URL (`maya-client`):**
  * `serverConfig.ts` & `ServerSettingsModal.tsx` (diakses dari `LockScreen` maupun `Sidebar`): menyimpan override URL di `localStorage['maya_server_url']` dengan fallback `VITE_API_BASE_URL`, validasi format, riwayat 5 URL terakhir, dan tombol **Test Koneksi** (`/health`, timeout 4 detik).
  * Mengubah URL otomatis menghentikan SignalR lama dan membersihkan JWT lama agar login ulang ke server baru bersih.
* **Native STT & Prioritas Suara Perempuan Indonesia:**
  * `CapacitorSttProvider` (`@capacitor-community/speech-recognition` v7) otomatis aktif di APK native melalui kontrak `ISttProvider` Phase 6A (runtime mic permission & partial results).
  * Default TTS di Web (`ttsService.ts`), Windows (`AudioAlertService.cs`), dan Android (`MayaNativePlugin.java`) memprioritaskan suara perempuan Indonesia (`Gadis` / `female` / `id-ID` non-male), selaras dengan persona asisten perempuan hangat, cerdas, dan luwes di `GeminiService.cs`.
* **Mode "Find My Phone" & Hardening SignalR (`Maya.Server` + `MayaNative`):**
  * **Hardening `MayaHub`:** Koneksi client non-Agent tanpa JWT valid ditolak (`Context.Abort()`). CORS diperluas mencakup CGNAT/Tailscale (`100.64.0.0/10`).
  * `MobileDeviceService` + `MobileController` (`/api/mobile/status`, `POST /api/mobile/find-me`, `POST /api/mobile/find-me/stop`) dengan cooldown terpisah per perangkat (`laptop` vs `phone`) dan tool Gemini `find_my_device(device="phone")` aktif.
  * Plugin native Java `MayaNative` (`MayaNativePlugin.java` terdaftar di `MainActivity.java`): menyimpan volume `STREAM_ALARM` → naikkan ke maks → putar alarm `USAGE_ALARM` + getar berpola + TTS *"Aku di sini, Max!"* → **selalu mengembalikan volume alarm di blok `finally`**, dilengkapi overlay layar penuh tombol **STOP ALARM** di UI HP dan kartu **Find My Phone** di `LaptopControlView`.
  * *Dilanjutkan di Phase 7B:* Native Biometric, Foreground Service layar mati, dan Responsive Mobile UI.

---

# 13.4 PHASE 7B: ANDROID NATIVE BIOMETRIC, FOREGROUND SERVICE & RESPONSIVE MOBILE UI

* **Native Android Biometric Auth & Keystore (`MayaNativePlugin.java` + `androidx.biometric:biometric`):**
  * `BiometricPrompt` (Sidik Jari / Face Unlock Android) + enkripsi Master PIN menggunakan kunci AES-256-GCM di `AndroidKeyStore`.
  * Terintegrasi di `LockScreen.tsx` (Unlock sekali sentuh + opt-in simpan biometrik + **AbortController timeout 8 detik**, reset `loading` di `finally`, dan auto-clear PIN pada `401`) serta di `StepUpModal.tsx` (Konfirmasi biometrik satu tap untuk aksi `HIGH_RISK` yang tetap mengirim `X-Step-Up-Token` terikat `targetId`).
* **Android Foreground Service (`MayaKeepAliveService.java`):**
  * Foreground Service bertipe `dataSync` dengan notifikasi persisten rendah gangguan (*"M.A.Y.A. aktif di latar belakang"* + tombol *"Matikan"* langsung di notifikasi), izin `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `POST_NOTIFICATIONS`, `WAKE_LOCK`.
  * Guard **Mode Hemat Baterai HP** (auto-stop bila baterai `< 20%` & tidak di-charge) + shortcut satu tap ke pengaturan *Optimasi Baterai* Android (`Unrestricted`).
  * Toggle opt-in default OFF di `LaptopControlView.tsx` (khusus APK Android).
* **Kestabilan Koneksi Mobile (`signalr.ts` & `App.tsx`):**
  * Listener `visibilitychange`, `focus`, dan `online` langsung memanggil `signalRService.ensureConnected()` + `RegisterMobileDevice` saat layar HP menyala kembali tanpa menunggu backoff 30 detik.
* **Responsive Mobile UI & Safe-Area (`maya-client`):**
  * `viewport-fit=cover`, tinggi layout `100dvh`, dan CSS `env(safe-area-inset-top/bottom)`.
  * Sidebar otomatis menjadi **slide-over drawer** di mobile (`< md`), dilengkapi **Mobile Top Bar** (menu drawer, status laptop, server gear) dan **Mobile Bottom Navigation Bar** 4 tab (`Chat`, `Vault`, `Memory`, `Control`).

---

# 14. GLOBAL NON-FUNCTIONAL REQUIREMENTS & ERROR HANDLING

1. **Latency Targets:**
   * API non-AI (`/api/conversations`, `/api/memories`, `/api/agent/status`): `< 200ms`.
   * Local Command Execution (`Maya.Server` → `Maya.Agent` → Response): `< 1.5s` (timeout maksimal `15s`).
2. **Resilience:**
   * `Maya.Agent` wajib otomatis reconnect jika Wi-Fi kampus/asrama putus-nyambung tanpa perlu restart manual.
   * Jika Gemini API mengembalikan `429 Too Many Requests` atau `503 Service Unavailable`, `GeminiService` melakukan 1x *retry* dengan *exponential backoff* sebelum mengembalikan pesan ramah ke user.
3. **Logging & Observability:**
   * Gunakan `ILogger<T>` terstruktur di seluruh service.
   * **NEVER LOG SECRETS:** Dilarang mencetak API Key, Connection String, JWT, PIN, atau isi Password Vault ke log console/file.

---

# 15. AI AGENT EXECUTION PROTOCOL

Instruksi wajib bagi AI Coding Agent (Antigravity) saat membaca dan mengeksekusi dokumen ini:
1. **Kerjakan Satu Fase per Sesi:** Jangan melompat ke Phase berikutnya sebelum seluruh item pada *Definition of Done (DoD)* fase saat ini terverifikasi.
2. **Verify Build & Migration:** Setelah setiap perubahan kode signifikan, wajib menjalankan `dotnet build` untuk memastikan 0 error.
3. **Respect Secret Boundaries:** Selalu baca kredensial dari `IConfiguration` (`dotnet user-secrets`). Jangan pernah menulis password atau API key ke `appsettings.json`.
4. **Report Clearly:** Di akhir setiap fase, laporkan daftar file yang dibuat/diubah, hasil `dotnet build`, dan langkah manual (jika ada) yang perlu dilakukan Maxwell.