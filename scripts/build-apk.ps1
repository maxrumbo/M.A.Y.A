# ==============================================================================
# M.A.Y.A. Mobile APK Versioned Builder
# ==============================================================================
# Script ini membangun APK Android, men-sinkronisasi Capacitor, dan menyimpan
# hasil build ke folder 'releases/' dengan format seragam maya-v{N}.apk (non-cutover)
# ==============================================================================

param(
    [string]$BuildType = "debug"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   M.A.Y.A. Android APK Versioned Builder                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$repoRoot = Split-Path -Parent $PSScriptRoot
$clientDir = Join-Path $repoRoot "maya-client"
$androidDir = Join-Path $clientDir "android"
$releasesDir = Join-Path $repoRoot "releases"

if (-not (Test-Path $releasesDir)) {
    New-Item -ItemType Directory -Path $releasesDir -Force | Out-Null
}

# 1. Hitung nomor versi berikutnya berdasarkan file maya-v{N}.apk di folder releases/
$pattern = "^maya-v([0-9]+)\.apk$"
$existingBuilds = Get-ChildItem -Path $releasesDir -Filter "maya-v*.apk" -ErrorAction SilentlyContinue
$maxVersionNum = 0

foreach ($file in $existingBuilds) {
    if ($file.Name -match $pattern) {
        $num = [int]$matches[1]
        if ($num -gt $maxVersionNum) { $maxVersionNum = $num }
    }
}

$nextVersionNum = $maxVersionNum + 1
$versionedFileName = "maya-v${nextVersionNum}.apk"

Write-Host "Target Versi : v$nextVersionNum" -ForegroundColor Yellow
Write-Host "Build Type   : $BuildType" -ForegroundColor Yellow
Write-Host "Output File  : releases/$versionedFileName" -ForegroundColor Yellow
Write-Host ""

# 2. Build Web Client (Vite)
Write-Host "[1/4] Membangun bundle web frontend (npm run build)..." -ForegroundColor Cyan
Set-Location $clientDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build web frontend gagal!" -ForegroundColor Red
    Set-Location $repoRoot
    exit 1
}

# 3. Sinkronisasi Capacitor Android
Write-Host ""
Write-Host "[2/4] Sinkronisasi aset ke project Android (cap sync)..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Capacitor sync gagal!" -ForegroundColor Red
    Set-Location $repoRoot
    exit 1
}

# 4. Build APK via Gradle
Write-Host ""
Write-Host "[3/4] Mengompilasi APK via Gradle ($BuildType)..." -ForegroundColor Cyan
Set-Location $androidDir
if ($BuildType -eq "release") {
    .\gradlew.bat assembleRelease
} else {
    .\gradlew.bat assembleDebug
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Gradle build APK gagal!" -ForegroundColor Red
    Set-Location $repoRoot
    exit 1
}

# 5. Cari hasil APK Gradle (prioritaskan app-$BuildType.apk atau file APK terbaru)
$apkOutputDir = Join-Path $androidDir "app\build\outputs\apk\$BuildType"
$preferredApk = Join-Path $apkOutputDir "app-$BuildType.apk"

$sourceApk = $null
if (Test-Path $preferredApk) {
    $sourceApk = $preferredApk
} else {
    $found = Get-ChildItem -Path (Join-Path $androidDir "app\build\outputs\apk") -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($found) { $sourceApk = $found.FullName }
}

if (-not $sourceApk) {
    Write-Host "[ERROR] File APK hasil build Gradle tidak ditemukan di direktori output!" -ForegroundColor Red
    Set-Location $repoRoot
    exit 1
}

# 6. Salin ke folder releases sebagai maya-v{N}.apk
Write-Host ""
Write-Host "[4/4] Mengarsipkan APK ke folder releases/..." -ForegroundColor Cyan
$destVersioned = Join-Path $releasesDir $versionedFileName
Copy-Item -Path $sourceApk -Destination $destVersioned -Force

Set-Location $repoRoot

$apkInfo = Get-Item $destVersioned
$apkSizeMB = [math]::Round($apkInfo.Length / 1MB, 2)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  BUILD APK SUKSES!                                       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Output File : $destVersioned" -ForegroundColor White
Write-Host "  Ukuran      : $apkSizeMB MB ($($apkInfo.Length) bytes)" -ForegroundColor White
Write-Host "  Waktu       : $(Get-Date -Format 'dd-MM-yyyy HH:mm:ss')" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Riwayat build yang tersimpan di releases/:" -ForegroundColor Yellow
Get-ChildItem -Path $releasesDir -Filter "maya-v*.apk" |
    Sort-Object { if ($_.Name -match '^maya-v([0-9]+)\.apk$') { [int]$matches[1] } else { 0 } } |
    ForEach-Object {
        $mb = [math]::Round($_.Length / 1MB, 2)
        Write-Host " - $($_.Name) ($mb MB) - $($_.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))" -ForegroundColor Gray
    }
Write-Host ""
