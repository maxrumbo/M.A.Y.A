# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────────────────────────────────────
# M.A.Y.A. — Maya.Server + maya-client (web) dalam SATU image.
# Kompatibel dengan Render / Koyeb / Azure Container Apps / Fly.io / VPS (Docker).
# Build context = root repo:   docker build -t maya-server .
# ──────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: build maya-client (React + Vite) ───────────────────────────────
FROM node:22-alpine AS web-build
WORKDIR /src/maya-client

COPY maya-client/package.json maya-client/package-lock.json ./
RUN npm ci --no-audit --no-fund

# .dockerignore mengecualikan android/, node_modules/, dist/, dan .env
# → VITE_API_BASE_URL kosong → klien memakai origin yang sama dengan server (lihat serverConfig.ts)
COPY maya-client/ ./
RUN npm run build

# ─── Stage 2: publish Maya.Server (.NET) ─────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:11.0 AS server-build
WORKDIR /src

# Restore dulu (layer cache) hanya dengan file .csproj
COPY Maya.Shared/Maya.Shared.csproj Maya.Shared/
COPY Maya.Server/Maya.Server.csproj Maya.Server/
RUN dotnet restore Maya.Server/Maya.Server.csproj

COPY Maya.Shared/ Maya.Shared/
COPY Maya.Server/ Maya.Server/
RUN dotnet publish Maya.Server/Maya.Server.csproj \
    -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ─── Stage 3: runtime (Debian — sudah termasuk ICU & tzdata untuk zona WIB) ──
FROM mcr.microsoft.com/dotnet/aspnet:11.0 AS final
WORKDIR /app

COPY --from=server-build /app/publish ./
# Hasil build web dilayani Maya.Server sebagai static files (wwwroot) + SPA fallback
COPY --from=web-build /src/maya-client/dist ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    Maya__TrustForwardedHeaders=true \
    Maya__DataDir=/app/data

# Folder tulis untuk agent-settings.json (mount persistent disk di sini bila platform mendukung)
USER root
RUN mkdir -p /app/data && chown -R $APP_UID /app/data
USER $APP_UID

# Platform PaaS menyuntik PORT (Render default 10000). Fallback 10000 untuk docker run lokal.
EXPOSE 10000
CMD ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-10000} exec dotnet Maya.Server.dll"]
