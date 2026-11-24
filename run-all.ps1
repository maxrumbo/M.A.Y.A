# ==============================================================================
# M.A.Y.A. All-In-One Launcher
# 1. Build seluruh solution sekali terlebih dahulu (cegah file lock CS2012)
# 2. Jalankan Maya.Server, Maya.Agent (--no-build), dan maya-client di terminal terpisah
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  M.A.Y.A. System Launcher" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 0. Build solution sekali di awal agar Maya.Server dan Maya.Agent tidak berebut compile Maya.Shared
Write-Host "[0/3] Membangun solution Maya.slnx..." -ForegroundColor Yellow
dotnet build Maya.slnx
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[FAIL] dotnet build Maya.slnx gagal (exit code ${LASTEXITCODE})." -ForegroundColor Red
    Write-Host "Pastikan tidak ada jendela Maya.Server / Maya.Agent lama yang masih berjalan, lalu coba lagi." -ForegroundColor Yellow
    exit $LASTEXITCODE
}
Write-Host "[OK] Build Maya.slnx sukses." -ForegroundColor Green
Write-Host ""

# 1. Jalankan Maya.Server (--no-build)
Write-Host "[1/3] Menjalankan Maya.Server (http://0.0.0.0:5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- Maya.Server ---' -ForegroundColor Cyan; dotnet run --no-build --project Maya.Server --launch-profile http"

# Tunggu 3 detik agar server mulai siap menerima koneksi
Start-Sleep -Seconds 3

# 2. Jalankan Maya.Agent (--no-build)
Write-Host "[2/3] Menjalankan Maya.Agent (SignalR Local Daemon)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- Maya.Agent ---' -ForegroundColor Green; dotnet run --no-build --project Maya.Agent"

# 3. Jalankan UI Frontend (maya-client)
Write-Host "[3/3] Menjalankan maya-client (http://0.0.0.0:5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- maya-client (Vite) ---' -ForegroundColor Magenta; Set-Location maya-client; npm run dev -- --host"

Write-Host ""
Write-Host "Semua service M.A.Y.A. telah dijalankan di window terminal terpisah!" -ForegroundColor Green
Write-Host "Buka di laptop:  http://localhost:5173" -ForegroundColor White
Write-Host "Buka di HP LAN:  http://<IP-LAN-LAPTOP>:5173 (misal http://10.139.30.105:5173)" -ForegroundColor White
Write-Host "Swagger API di:  http://localhost:5000/swagger" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
