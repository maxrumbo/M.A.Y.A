# ==============================================================================
# M.A.Y.A. All-In-One Launcher
# Menjalankan Maya.Server, Maya.Agent, dan maya-client di terminal terpisah.
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  M.A.Y.A. System Launcher" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Jalankan Maya.Server
Write-Host "[1/3] Menjalankan Maya.Server (http://localhost:5063)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- Maya.Server ---' -ForegroundColor Cyan; dotnet run --project Maya.Server --launch-profile http"

# Tunggu 3 detik agar server mulai siap menerima koneksi
Start-Sleep -Seconds 3

# 2. Jalankan Maya.Agent
Write-Host "[2/3] Menjalankan Maya.Agent (SignalR Local Daemon)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- Maya.Agent ---' -ForegroundColor Green; dotnet run --project Maya.Agent"

# 3. Jalankan UI Frontend (maya-client)
Write-Host "[3/3] Menjalankan maya-client (http://localhost:5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- maya-client (Vite) ---' -ForegroundColor Magenta; Set-Location maya-client; npm run dev"

Write-Host ""
Write-Host "Semua service M.A.Y.A. telah dijalankan di window terminal terpisah!" -ForegroundColor Green
Write-Host "Buka browser di: http://localhost:5173" -ForegroundColor White
Write-Host "Swagger API di:  http://localhost:5063/swagger" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
