<#
.SYNOPSIS
    M.A.Y.A. Phase 6B End-to-End Verification Script (Wake-Word & Mode "Find-Me").
.DESCRIPTION
    Menguji endpoint API Phase 6B:
      1. Health & Auth login (JWT)
      2. GET /api/agent/wake-word (cek default OFF & status listener)
      3. PUT /api/agent/wake-word (toggle ON -> verifikasi -> kembalikan ke state awal)
      4. POST /api/agent/find-me (200 OK bila Agent online, atau 409 Conflict bila offline)
      5. POST /api/agent/find-me cepat kedua (429 Cooldown saat Agent online)
      6. POST /api/agent/find-me/stop (200 OK menghentikan alarm & mengembalikan volume)
      7. (Opsional) Chat tool find_my_device untuk "phone" (pesan fallback bersih tanpa crash)
.EXAMPLE
    .\verify-phase6b.ps1 -Pin "123456"
    .\verify-phase6b.ps1 -Pin "123456" -TestGeminiChat
#>
param(
    [string]$BaseUrl = "http://localhost:5063",
    [Parameter(Mandatory = $false)]
    [string]$Pin = "",
    [switch]$TestGeminiChat
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

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  M.A.Y.A. PHASE 6B VERIFICATION (WAKE-WORD & FIND-ME)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Cek Server Health
try {
    $health = Invoke-Api -Method "GET" -Path "/health"
    if ($health.StatusCode -eq 200) {
        $healthStatus = $health.Body.status
        Pass "Server merespons di ${BaseUrl} (Status: ${healthStatus})"
    } else {
        $hCode = $health.StatusCode
        Fail "Server mengembalikan HTTP ${hCode} di /health"
        exit 1
    }
}
catch {
    Fail "Server tidak merespons di ${BaseUrl}. Pastikan Maya.Server sudah berjalan: dotnet run --project Maya.Server --launch-profile http"
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
    $lCode = $login.StatusCode
    $lBody = $login.Body | ConvertTo-Json -Compress
    Fail "Login PIN gagal (HTTP ${lCode}): ${lBody}"
    exit 1
}
Pass "Login PIN berhasil - JWT diterima"
$accessToken = $login.Body.accessToken
$authHeaders = @{ Authorization = "Bearer ${accessToken}" }

# 3. Cek Status Agent
$agentStatus = Invoke-Api -Method "GET" -Path "/api/agent/status" -Headers $authHeaders
$isOnline = $false
if ($agentStatus.StatusCode -eq 200) {
    $isOnline = [bool]$agentStatus.Body.isOnline
    $batPct = $agentStatus.Body.batteryPercent
    Info "Status Maya.Agent: isOnline=${isOnline} | Bat=${batPct}%"
} else {
    $sCode = $agentStatus.StatusCode
    Fail "GET /api/agent/status gagal (HTTP ${sCode})"
}

# 4. GET /api/agent/wake-word
$wwGet = Invoke-Api -Method "GET" -Path "/api/agent/wake-word" -Headers $authHeaders
if ($wwGet.StatusCode -eq 200 -and $null -ne $wwGet.Body.settings -and $null -ne $wwGet.Body.status) {
    $origSettings = $wwGet.Body.settings
    $origEnabled = $origSettings.wakeWordEnabled
    $origSaver = $origSettings.batterySaverEnabled
    $wwState = $wwGet.Body.status.state
    $wwEngine = $wwGet.Body.status.engine
    Pass "GET /api/agent/wake-word OK (Enabled=${origEnabled}, Saver=${origSaver}, State=${wwState}, Engine=${wwEngine})"
} else {
    $wCode = $wwGet.StatusCode
    Fail "GET /api/agent/wake-word gagal (HTTP ${wCode})"
    exit 1
}

# 5. PUT /api/agent/wake-word (toggle lalu kembalikan ke nilai awal)
$toggledEnabled = -not [bool]$origSettings.wakeWordEnabled
$wwPut = Invoke-Api -Method "PUT" -Path "/api/agent/wake-word" -Headers $authHeaders -Body @{
    wakeWordEnabled         = $toggledEnabled
    batterySaverEnabled     = [bool]$origSettings.batterySaverEnabled
    batteryThresholdPercent = [int]$origSettings.batteryThresholdPercent
}
if ($wwPut.StatusCode -eq 200 -and ([bool]$wwPut.Body.settings.wakeWordEnabled -eq $toggledEnabled)) {
    Pass "PUT /api/agent/wake-word toggle berhasil (wakeWordEnabled -> ${toggledEnabled})"
} else {
    $pCode = $wwPut.StatusCode
    Fail "PUT /api/agent/wake-word gagal (HTTP ${pCode})"
}

# Tunggu sebentar agar Agent (bila online) sempat melaporkan status terbaru
Start-Sleep -Milliseconds 700
$wwAfter = Invoke-Api -Method "GET" -Path "/api/agent/wake-word" -Headers $authHeaders
$afterState = $wwAfter.Body.status.state
$afterEngine = $wwAfter.Body.status.engine
$afterReason = $wwAfter.Body.status.reason
Info "Status listener pasca toggle: State=${afterState} | Engine=${afterEngine} | Reason=${afterReason}"

# Kembalikan ke setting semula
$wwRestore = Invoke-Api -Method "PUT" -Path "/api/agent/wake-word" -Headers $authHeaders -Body @{
    wakeWordEnabled         = [bool]$origSettings.wakeWordEnabled
    batterySaverEnabled     = [bool]$origSettings.batterySaverEnabled
    batteryThresholdPercent = [int]$origSettings.batteryThresholdPercent
}
if ($wwRestore.StatusCode -eq 200) {
    $restoredVal = $origSettings.wakeWordEnabled
    Pass "Pengaturan wake-word dikembalikan ke kondisi awal (wakeWordEnabled=${restoredVal})"
} else {
    Fail "Gagal mengembalikan pengaturan wake-word awal"
}

# 6. Test Find-Me & Cooldown & Stop
if ($isOnline) {
    Info "Maya.Agent ONLINE - menguji Find-Me (durasi 5s), Cooldown 429, dan Stop..."

    $fm1 = Invoke-Api -Method "POST" -Path "/api/agent/find-me" -Headers $authHeaders -Body @{ durationSeconds = 5 }
    if ($fm1.StatusCode -eq 200) {
        $fm1Out = $fm1.Body.output
        Pass "POST /api/agent/find-me -> 200 OK (${fm1Out})"
    } else {
        $f1Code = $fm1.StatusCode
        $f1Body = $fm1.Body | ConvertTo-Json -Compress
        Fail "POST /api/agent/find-me seharusnya 200 OK, dapat HTTP ${f1Code}: ${f1Body}"
    }

    # Panggilan kedua langsung harus kena 429 Cooldown
    $fm2 = Invoke-Api -Method "POST" -Path "/api/agent/find-me" -Headers $authHeaders -Body @{ durationSeconds = 5 }
    if ($fm2.StatusCode -eq 429) {
        Pass "POST /api/agent/find-me cepat kedua -> 429 Too Many Requests (Cooldown berfungsi!)"
    } else {
        $f2Code = $fm2.StatusCode
        Fail "POST /api/agent/find-me cepat kedua seharusnya 429, dapat HTTP ${f2Code}"
    }

    Start-Sleep -Seconds 2

    # Hentikan alarm
    $fmStop = Invoke-Api -Method "POST" -Path "/api/agent/find-me/stop" -Headers $authHeaders
    if ($fmStop.StatusCode -eq 200) {
        $stopOut = $fmStop.Body.output
        Pass "POST /api/agent/find-me/stop -> 200 OK (${stopOut})"
    } else {
        $stCode = $fmStop.StatusCode
        Fail "POST /api/agent/find-me/stop gagal (HTTP ${stCode})"
    }
}
else {
    Info "Maya.Agent OFFLINE - menguji respons 409 Conflict..."
    $fmOff = Invoke-Api -Method "POST" -Path "/api/agent/find-me" -Headers $authHeaders -Body @{ durationSeconds = 5 }
    if ($fmOff.StatusCode -eq 409) {
        Pass "POST /api/agent/find-me saat Agent offline -> 409 Conflict (sesuai ekspektasi)"
    } else {
        $foCode = $fmOff.StatusCode
        Fail "POST /api/agent/find-me saat offline seharusnya 409, dapat HTTP ${foCode}"
    }
}

# 7. Opsional: Test Gemini Tool find_my_device ("phone" fallback)
if ($TestGeminiChat) {
    Info "Menguji tool Gemini find_my_device (device=phone) via POST /api/chat..."
    $chat = Invoke-Api -Method "POST" -Path "/api/chat" -Headers $authHeaders -Body @{
        message = "Maya, tolong bunyiin HP-ku dong, aku lupa naruh di mana."
    }
    if ($chat.StatusCode -eq 200 -and $chat.Body.reply) {
        $chatReply = $chat.Body.reply
        Pass "Chat find_my_device (phone) -> 200 OK. Balasan: ${chatReply}"
    } else {
        $cCode = $chat.StatusCode
        Fail "Chat find_my_device gagal (HTTP ${cCode})"
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
$summaryColor = if ($failed -eq 0) { "Green" } else { "Red" }
Write-Host "  HASIL VERIFIKASI PHASE 6B: PASS=${passed} | FAIL=${failed}" -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Catatan tes manual yang perlu didengar langsung:" -ForegroundColor Yellow
Write-Host "  1. Mute speaker laptop -> klik 'Find My Laptop' di UI -> pastikan bunyi ping + 'Aku di sini, Max!' terdengar, lalu speaker kembali mute."
Write-Host "  2. Aktifkan toggle 'Wake-Word Listener' di Laptop Control Hub -> ucapkan 'Hey Maya' atau 'Maya where are you'."
Write-Host "  3. Cabut charger saat baterai < 20% -> cek pill status berubah menjadi 'Dijeda (Baterai)'."

if ($failed -gt 0) { exit 1 }
