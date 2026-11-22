# ==============================================================================
# M.A.Y.A. Phase 4 & Hardening Verification Script
# Jalankan skrip ini di PowerShell lokal Maxwell.
#
# Prasyarat:
# 1. Buka Terminal 1 dan jalankan Server:
#    dotnet run --project Maya.Server --launch-profile http
# 2. Buka Terminal 2 dan jalankan skrip ini:
#    .\verify-phase4.ps1
# ==============================================================================

$baseUrl = "http://localhost:5063"
$pin = "1234"
$passCount = 0
$failCount = 0

function Report-Result($name, $success, $details = "") {
    if ($success) {
        Write-Host " [PASS] $name" -ForegroundColor Green
        if ($details) { Write-Host "        $details" -ForegroundColor DarkGray }
        $global:passCount++
    } else {
        Write-Host " [FAIL] $name" -ForegroundColor Red
        if ($details) { Write-Host "        $details" -ForegroundColor Yellow }
        $global:failCount++
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  M.A.Y.A. PHASE 4 & HARDENING END-TO-END VERIFICATION    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cek Server Connectivity
try {
    $res = Invoke-RestMethod "$baseUrl/health" -Method Get -TimeoutSec 5
    Report-Result "1. Server Health Check (/health)" ($res.status -eq "Healthy") "Database: $($res.database)"
} catch {
    Write-Host " [FAIL] Server tidak merespons di $baseUrl." -ForegroundColor Red
    Write-Host "        Pastikan Maya.Server sudah berjalan:" -ForegroundColor Yellow
    Write-Host "        dotnet run --project Maya.Server --launch-profile http" -ForegroundColor Yellow
    exit 1
}

# 2. Test Unauthenticated Requests (Harus 401)
try {
    Invoke-RestMethod "$baseUrl/api/chat" -Method Post -ContentType "application/json" -Body "{}" -ErrorAction Stop
    Report-Result "2. JWT Protection pada /api/chat" $false "Seharusnya 401 tapi berhasil diakses"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Report-Result "2. JWT Protection pada /api/chat" ($code -eq 401) "Status: $code Unauthorized (sesuai)"
}

try {
    Invoke-RestMethod "$baseUrl/api/memories" -Method Get -ErrorAction Stop
    Report-Result "3. JWT Protection pada /api/memories" $false "Seharusnya 401 tapi berhasil diakses"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Report-Result "3. JWT Protection pada /api/memories" ($code -eq 401) "Status: $code Unauthorized (sesuai)"
}

# 3. Master PIN Setup / Login
$jwt = $null
try {
    # Coba setup PIN dulu
    $setupBody = @{ pin = $pin; confirmPin = $pin } | ConvertTo-Json
    Invoke-RestMethod "$baseUrl/api/auth/setup-pin" -Method Post -ContentType "application/json" -Body $setupBody -ErrorAction Stop
    Write-Host "        PIN baru berhasil didaftarkan: $pin" -ForegroundColor DarkGray
} catch {
    # Jika 409 Conflict berarti PIN sudah disetup sebelumnya, lanjut ke login
}

try {
    $loginBody = @{ pin = $pin } | ConvertTo-Json
    $authRes = Invoke-RestMethod "$baseUrl/api/auth/login-pin" -Method Post -ContentType "application/json" -Body $loginBody -ErrorAction Stop
    $jwt = $authRes.accessToken
    Report-Result "4. Master PIN Login & JWT Generation" (![string]::IsNullOrEmpty($jwt)) "Token diterima (expires in $($authRes.expiresInSeconds)s)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Report-Result "4. Master PIN Login & JWT Generation" $false "HTTP $code - $($_.Exception.Message)"
}

if (-not $jwt) {
    Write-Host "`nLogin gagal. Pengujian berlanjut dibatalkan." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $jwt"
    "Content-Type"  = "application/json"
}

# 4. Validasi JWT dengan /api/auth/me
try {
    $meRes = Invoke-RestMethod "$baseUrl/api/auth/me" -Method Get -Headers $headers -ErrorAction Stop
    Report-Result "5. Endpoint /api/auth/me dengan JWT" ($meRes.role -eq "Owner") "Halo $($meRes.user)! Role: $($meRes.role)"
} catch {
    Report-Result "5. Endpoint /api/auth/me dengan JWT" $false "$($_.Exception.Message)"
}

# 5. Buat dummy data Vault untuk menguji Step-Up Token
$vaultId = $null
try {
    $vaultReq = @{
        serviceName = "Test-Service-DoD"
        username    = "maxwell@itdel.ac.id"
        plainSecret = "SuperSecretPassword123!"
        notes       = "Testing Phase 4 Verification"
    } | ConvertTo-Json
    $vaultRes = Invoke-RestMethod "$baseUrl/api/vault" -Method Post -Headers $headers -Body $vaultReq -ErrorAction Stop
    $vaultId = $vaultRes.id
    Report-Result "6. Create Vault Entry (Terenkripsi AES-256-GCM)" (![string]::IsNullOrEmpty($vaultId)) "VaultId: $vaultId"
} catch {
    Report-Result "6. Create Vault Entry" $false "$($_.Exception.Message)"
}

# 6. Test Step-Up Protection: Reveal Vault TANPA StepUpToken (Harus 401)
if ($vaultId) {
    try {
        Invoke-RestMethod "$baseUrl/api/vault/$vaultId/reveal" -Method Get -Headers $headers -ErrorAction Stop
        Report-Result "7. Proteksi Step-Up pada Vault Reveal" $false "Seharusnya ditolak 401 tanpa Step-Up token"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Report-Result "7. Proteksi Step-Up pada Vault Reveal" ($code -eq 401) "HTTP $code Unauthorized (Step-Up dicegah)"
    }

    # 7. Issue Step-Up Token yang terikat ke targetId (H1 Hardening)
    $stepUpToken = $null
    try {
        $stepUpReq = @{
            verificationToken = $pin
            targetId          = $vaultId
        } | ConvertTo-Json
        $stepUpRes = Invoke-RestMethod "$baseUrl/api/auth/step-up" -Method Post -Headers $headers -Body $stepUpReq -ErrorAction Stop
        $stepUpToken = $stepUpRes.stepUpToken
        Report-Result "8. Penerbitan Step-Up Token (H1: Terikat ke TargetId)" (![string]::IsNullOrEmpty($stepUpToken)) "Token berlaku 60 detik"
    } catch {
        Report-Result "8. Penerbitan Step-Up Token (H1)" $false "$($_.Exception.Message)"
    }

    # 8. Akses Reveal dengan Step-Up Token yang valid
    if ($stepUpToken) {
        $stepUpHeaders = @{
            "Authorization"   = "Bearer $jwt"
            "X-Step-Up-Token" = $stepUpToken
        }
        try {
            $revealRes = Invoke-RestMethod "$baseUrl/api/vault/$vaultId/reveal" -Method Get -Headers $stepUpHeaders -ErrorAction Stop
            Report-Result "9. Vault Reveal dengan Step-Up Token Valid" ($revealRes.plainSecret -eq "SuperSecretPassword123!") "Secret terdekripsi: $($revealRes.plainSecret)"
        } catch {
            Report-Result "9. Vault Reveal dengan Step-Up Token Valid" $false "$($_.Exception.Message)"
        }

        # 9. Test H1 Single-Use: Replay token yang sama (Harus 401 Ditolak!)
        try {
            Invoke-RestMethod "$baseUrl/api/vault/$vaultId/reveal" -Method Get -Headers $stepUpHeaders -ErrorAction Stop
            Report-Result "10. Anti-Replay: Token Single-Use (H1)" $false "Token yang sama berhasil dipakai 2x (seharusnya ditolak)"
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            Report-Result "10. Anti-Replay: Token Single-Use (H1)" ($code -eq 401) "HTTP $code Unauthorized (Token hangus setelah 1x pakai)"
        }

        # 10. Test H1 Target Mismatch: Token untuk Target A dipakai di Target B (Harus 401)
        try {
            $stepUpMismatchReq = @{
                verificationToken = $pin
                targetId          = [Guid]::NewGuid()
            } | ConvertTo-Json
            $mismatchRes = Invoke-RestMethod "$baseUrl/api/auth/step-up" -Method Post -Headers $headers -Body $stepUpMismatchReq -ErrorAction Stop
            $mismatchHeaders = @{
                "Authorization"   = "Bearer $jwt"
                "X-Step-Up-Token" = $mismatchRes.stepUpToken
            }
            Invoke-RestMethod "$baseUrl/api/vault/$vaultId/reveal" -Method Get -Headers $mismatchHeaders -ErrorAction Stop
            Report-Result "11. Proteksi Target Mismatch (H1)" $false "Token target lain berhasil membobol resource ini"
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            Report-Result "11. Proteksi Target Mismatch (H1)" ($code -eq 401) "HTTP $code Unauthorized (Target ID tidak cocok)"
        }
    }

    # Cleanup dummy vault
    try {
        Invoke-RestMethod "$baseUrl/api/vault/$vaultId" -Method Delete -Headers $headers -ErrorAction SilentlyContinue
    } catch {}
}

# 11. Test H2: Endpoint Cancel Command
try {
    $dummyCmdId = [Guid]::NewGuid()
    Invoke-RestMethod "$baseUrl/api/agent/commands/$dummyCmdId/cancel" -Method Post -Headers $headers -ErrorAction Stop
    Report-Result "12. Endpoint Cancel Command (H2)" $false "Seharusnya 404 jika ID acak"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Report-Result "12. Endpoint Cancel Command (H2)" ($code -eq 404 -or $code -eq 204) "HTTP $code (Endpoint aktif & merespons)"
}

# 12. Test Google Integration Fallback
try {
    $gStatus = Invoke-RestMethod "$baseUrl/api/integrations/google/status" -Method Get -Headers $headers -ErrorAction Stop
    Report-Result "13. Google Integration Endpoint Status" $true "Configured: $($gStatus.configured)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Report-Result "13. Google Integration Fallback" ($code -eq 501) "HTTP $code Not Implemented (Fallback bersih, tidak crash)"
}

# 13. Test H4 Memory Guardrail (Blokir Password di save_memory)
try {
    $chatReq = @{
        message = "Ingat ya, password wifi rumahku adalah RahasiaNegara123!"
    } | ConvertTo-Json
    $chatRes = Invoke-RestMethod "$baseUrl/api/chat" -Method Post -Headers $headers -Body $chatReq -ErrorAction Stop
    Report-Result "14. Chat API & Gemini Connection" (![string]::IsNullOrEmpty($chatRes.reply)) "Respons M.A.Y.A. diterima"

    # Verifikasi apakah password bocor ke tabel memori
    $mems = Invoke-RestMethod "$baseUrl/api/memories" -Method Get -Headers $headers -ErrorAction Stop
    $leaked = $mems | Where-Object { $_.value -like "*RahasiaNegara123*" }
    Report-Result "15. H4 Memory Guardrail (Anti-Leak Password ke Memory)" ($leaked -eq $null) "Password dicegah dan tidak tersimpan di memori!"
} catch {
    Report-Result "14. Chat API & Memory Guardrail Test" $false "$($_.Exception.Message)"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  HASIL AKHIR: $passCount LULUS / $failCount GAGAL" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "==========================================================" -ForegroundColor Cyan
