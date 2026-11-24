# ==============================================================================
# M.A.Y.A. Mobile APK Versioned Builder
# ==============================================================================
# Script ini membangun APK Android, men-sinkronisasi Capacitor, dan menyimpan
# hasil render APK ke folder 'releases/' dengan penomoran versi otomatis (tanpa overwrite/cutover)
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

# 1. Baca versi dari package.json
$pkgJsonPath = Join-Path $clientDir "package.json"
$appVersion = "1.0.0"
if (Test-Path $pkgJsonPath) {
    $pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
    if ($pkg.version) { $appVersion = $pkg.version }
}

# 2. Hitung nomor build berikutnya berdasarkan riwayat di folder releases/
$pattern = "maya-v$appVersion-b([0-9]+).*\.apk"
$existingBuilds = Get-ChildItem -Path $releasesDir -Filter "maya-v$appVersion-b*.apk" -ErrorAction SilentlyContinue
$maxBuildNum = 0

foreach ($file in $existingBuilds) {
    if ($file.Name -match $pattern) {
        $num = [int]$matches[1]
        if ($num -gt $maxBuildNum) { $maxBuildNum = $num }
    }
}

$nextBuildNum = $maxBuildNum + 1
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$versionedFileName = "maya-v${appVersion}-b${nextBuildNum}-${BuildType}.apk"
$latestFileName = "maya-latest-${BuildType}.apk"

Write-Host "Target Versi : v$appVersion" -ForegroundColor Yellow
Write-Host "Build Number : #$nextBuildNum" -ForegroundColor Yellow
Write-Host "Output File  : releases/$versionedFileName" -ForegroundColor Yellow
Write-Host ""

# 3. Build Web Client (Vite)
Write-Host "[1/4] Membangun bundle web frontend (npm run build)..." -ForegroundColor Cyan
Set-Location $clientDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build web frontend gagal!" -ForegroundColor Red
    Set-Location $repoRoot
    exit 1
}

# 4. Sinkronisasi Capacitor Android
Write-Host ""
Write-Host "[2/4] Sinkronisasi aset ke project Android (cap sync)..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Capacitor sync gagal!" -ForegroundColor Red
    Set-Location $repoRoot
    exit 1
}

# 5. Build APK via Gradle
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

# 6. Cari hasil APK Gradle
$possibleApkPaths = @(
    (Join-Path $androidDir "app\build\outputs\apk\$BuildType\maya.apk"),
    (Join-Path $androidDir "app\build\outputs\apk\$BuildType\app-$BuildType.apk"),
    (Join-Path $androidDir "app\build\outputs\apk\$BuildType\app.apk")
)

$sourceApk = $null
foreach ($path in $possibleApkPaths) {
    if (Test-Path $path) {
        $sourceApk = $path
        break
    }
}

if (-not $sourceApk) {
    # Fallback cari sembarang file .apk di folder outputs
    $found = Get-ChildItem -Path (Join-Path $androidDir "app\build\outputs\apk") -Recurse -Filter "*.apk" | Select-Object -First 1
    if ($found) { $sourceApk = $found.FullName }
}

if (-not $sourceApk) {
    Write-Host "[ERROR] File APK hasil build Gradle tidak ditemukan di direktori output!" -ForegroundColor Red
    Set-Location $repoRoot
    exit 1
}

# 7. Salin ke folder releases (Versi Arsip + Latest Pointer)
Write-Host ""
Write-Host "[4/4] Mengarsipkan APK ke folder releases/..." -ForegroundColor Cyan
$destVersioned = Join-Path $releasesDir $versionedFileName
$destLatest = Join-Path $releasesDir $latestFileName

Copy-Item -Path $sourceApk -Destination $destVersioned -Force
Copy-Item -Path $sourceApk -Destination $destLatest -Force

Set-Location $repoRoot

$apkInfo = Get-Item $destVersioned
$apkSizeMB = [math]::Round($apkInfo.Length / 1MB, 2)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  BUILD APK SUKSES!                                       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  File Versi  : $destVersioned" -ForegroundColor White
Write-Host "  File Latest : $destLatest" -ForegroundColor White
Write-Host "  Ukuran      : $apkSizeMB MB ($($apkInfo.Length) bytes)" -ForegroundColor White
Write-Host "  Waktu       : $(Get-Date -Format 'dd-MM-yyyy HH:mm:ss')" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Riwayat build yang tersimpan di releases/:" -ForegroundColor Yellow
Get-ChildItem -Path $releasesDir -Filter "*.apk" | ForEach-Object {
    $mb = [math]::Round($_.Length / 1MB, 2)
    Write-Host " - $($_.Name) ($mb MB) - $($_.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))" -ForegroundColor Gray
}
Write-Host ""
