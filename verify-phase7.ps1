<#
.SYNOPSIS
    M.A.Y.A. Phase 7 Verification Script (Mobile Find-Me, CORS LAN/Tailscale & API Readiness).
.DESCRIPTION
    Menguji endpoint & konfigurasi Phase 7:
      1. Health check & Login PIN (JWT)
      2. GET /api/mobile/status (jumlah HP online & status Find-Me)
      3. POST /api/mobile/find-me (409 jika 0 HP online; atau 200 + 429 cooldown + /stop jika HP online)
      4. CORS Preflight (OPTIONS):
         - Diizinkan: http://localhost, https://localhost, capacitor://localhost, http://10.139.30.105:5173, http://100.80.1.2:5173
         - Ditolak  : http://evil.example.com
.EXAMPLE
    .\verify-phase7.ps1 -Pin "123456"
#>
param(
    [string]$BaseUrl = "http://localhost:5063",
    [Parameter(Mandatory = $false)]
    [string]$Pin = ""
)

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Pass($msg) {
    Write-Host "  [PASS] ${msg}" -ForegroundColor Green
    $script:passed++
}

function Fail($msg) {
    Write-Host "  [FAIL] ${msg}" -ForegroundColor Red
    $script:failed++
}

function Info($msg) {
    Write-Host "  [INFO] ${msg}" -ForegroundColor Cyan
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    $uri = "${BaseUrl}${Path}"
    $params = @{
        Uri         = $uri
        Method      = $Method
        Headers     = $Headers
        ContentType = "application/json"
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 5)
    }

    try {
        $resp = Invoke-WebRequest @params -UseBasicParsing
        $parsed = $null
        if ($resp.Content) {
            try { $parsed = $resp.Content | ConvertFrom-Json } catch { $parsed = $resp.Content }
        }
        return [PSCustomObject]@{ StatusCode = [int]$resp.StatusCode; Body = $parsed; Headers = $resp.Headers }
    }
    catch {
        $exResp = $_.Exception.Response
        if ($null -eq $exResp) { throw }
        $code = [int]$exResp.StatusCode
        $raw = ""
        try {
            $stream = $exResp.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $raw = $reader.ReadToEnd()
            }
        } catch {}
        $parsed = $raw
        if ($raw) {
            try { $parsed = $raw | ConvertFrom-Json } catch {}
        }
        return [PSCustomObject]@{ StatusCode = $code; Body = $parsed; Headers = $exResp.Headers }
    }
}

function Test-CorsOrigin {
    param(
        [string]$Origin,
        [bool]$ShouldAllow
    )
    $headers = @{
        "Origin"                        = $Origin
        "Access-Control-Request-Method" = "POST"
    }
    $res = Invoke-Api -Method "OPTIONS" -Path "/api/mobile/status" -Headers $headers
    $acao = $res.Headers["Access-Control-Allow-Origin"]
    $isAllowed = ($acao -eq $Origin)

    if ($ShouldAllow -and $isAllowed) {
        Pass "CORS preflight mengizinkan origin ${Origin}"
    }
    elseif (-not $ShouldAllow -and -not $isAllowed) {
        Pass "CORS preflight menolak origin tidak sah ${Origin}"
    }
    else {
        Fail "CORS preflight untuk ${Origin}: expectedAllowed=${ShouldAllow}, actualHeader='${acao}'"
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  M.A.Y.A. PHASE 7 VERIFICATION (ANDROID & FIND MY PHONE)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Health check
try {
    $health = Invoke-Api -Method "GET" -Path "/health"
    if ($health.StatusCode -eq 200) {
        $st = $health.Body.status
        Pass "Server merespons di ${BaseUrl} (Status: ${st})"
    } else {
        $hc = $health.StatusCode
        Fail "GET /health mengembalikan HTTP ${hc}"
        exit 1
    }
}
catch {
    Fail "Server tidak merespons di ${BaseUrl}. Pastikan Maya.Server sudah berjalan."
    exit 1
}

# 2. Login PIN -> JWT
if ([string]::IsNullOrWhiteSpace($Pin)) {
    $secPin = Read-Host "Masukkan Master PIN M.A.Y.A. Anda" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPin)
    $Pin = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$login = Invoke-Api -Method "POST" -Path "/api/auth/login-pin" -Body @{ pin = $Pin }
if ($login.StatusCode -ne 200 -or -not $login.Body.accessToken) {
    $lc = $login.StatusCode
    Fail "Login PIN gagal (HTTP ${lc})"
    exit 1
}
Pass "Login PIN berhasil - JWT diterima"
$token = $login.Body.accessToken
$authHeaders = @{ Authorization = "Bearer ${token}" }

# 3. GET /api/mobile/status
$mobStatus = Invoke-Api -Method "GET" -Path "/api/mobile/status" -Headers $authHeaders
$onlinePhones = 0
if ($mobStatus.StatusCode -eq 200) {
    $onlinePhones = [int]$mobStatus.Body.onlineDevices
    $activeFlag = $mobStatus.Body.isFindMeActive
    Pass "GET /api/mobile/status -> 200 OK (onlineDevices=${onlinePhones}, isFindMeActive=${activeFlag})"
} else {
    $mc = $mobStatus.StatusCode
    Fail "GET /api/mobile/status gagal (HTTP ${mc})"
}

# 4. POST /api/mobile/find-me
if ($onlinePhones -eq 0) {
    Info "Tidak ada HP online - menguji respons 409 Conflict..."
    $fmOff = Invoke-Api -Method "POST" -Path "/api/mobile/find-me" -Headers $authHeaders -Body @{ durationSeconds = 5 }
    if ($fmOff.StatusCode -eq 409) {
        Pass "POST /api/mobile/find-me saat 0 HP online -> 409 Conflict"
    } else {
        $fc = $fmOff.StatusCode
        Fail "POST /api/mobile/find-me saat 0 HP online seharusnya 409, dapat HTTP ${fc}"
    }
}
else {
    Info "Terdeteksi ${onlinePhones} HP online - menguji ping Find-Me, Cooldown 429, dan Stop..."
    $fm1 = Invoke-Api -Method "POST" -Path "/api/mobile/find-me" -Headers $authHeaders -Body @{ durationSeconds = 5 }
    if ($fm1.StatusCode -eq 200) {
        $fmsg = $fm1.Body.message
        Pass "POST /api/mobile/find-me -> 200 OK (${fmsg})"
    } else {
        $fc1 = $fm1.StatusCode
        Fail "POST /api/mobile/find-me gagal (HTTP ${fc1})"
    }

    $fm2 = Invoke-Api -Method "POST" -Path "/api/mobile/find-me" -Headers $authHeaders -Body @{ durationSeconds = 5 }
    if ($fm2.StatusCode -eq 429) {
        Pass "POST /api/mobile/find-me cepat kedua -> 429 Too Many Requests (Cooldown aktif)"
    } else {
        $fc2 = $fm2.StatusCode
        Fail "POST /api/mobile/find-me kedua seharusnya 429, dapat HTTP ${fc2}"
    }

    Start-Sleep -Seconds 2
    $fmStop = Invoke-Api -Method "POST" -Path "/api/mobile/find-me/stop" -Headers $authHeaders
    if ($fmStop.StatusCode -eq 200) {
        Pass "POST /api/mobile/find-me/stop -> 200 OK"
    } else {
        $fcs = $fmStop.StatusCode
        Fail "POST /api/mobile/find-me/stop gagal (HTTP ${fcs})"
    }
}

# 5. CORS Preflight Tests (Localhost, Capacitor, LAN, Tailscale, Evil)
Info "Menguji CORS preflight untuk origin Android, LAN, Tailscale, dan domain asing..."
Test-CorsOrigin -Origin "http://localhost" -ShouldAllow $true
Test-CorsOrigin -Origin "https://localhost" -ShouldAllow $true
Test-CorsOrigin -Origin "capacitor://localhost" -ShouldAllow $true
Test-CorsOrigin -Origin "http://10.139.30.105:5173" -ShouldAllow $true
Test-CorsOrigin -Origin "http://100.80.1.2:5173" -ShouldAllow $true
Test-CorsOrigin -Origin "http://evil.example.com" -ShouldAllow $false

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
$summaryColor = if ($failed -eq 0) { "Green" } else { "Red" }
Write-Host "  HASIL VERIFIKASI PHASE 7: PASS=${passed} | FAIL=${failed}" -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Catatan verifikasi manual di HP Android:" -ForegroundColor Yellow
Write-Host "  1. Install maya-client/android/app/build/outputs/apk/debug/app-debug.apk"
Write-Host "  2. Buka app -> ikon gear (Server) -> masukkan IP LAN/Tailscale -> Test Koneksi -> Simpan"
Write-Host "  3. Login PIN -> tes Mic (izinkan RECORD_AUDIO) -> pastikan voice STT & TTS perempuan ID bekerja"
Write-Host "  4. Dari laptop (tab Laptop Control / Chat: 'Maya, cari HP-ku') -> pastikan HP berbunyi, bergetar, overlay STOP muncul, dan volume alarm kembali normal."

if ($failed -gt 0) { exit 1 }
