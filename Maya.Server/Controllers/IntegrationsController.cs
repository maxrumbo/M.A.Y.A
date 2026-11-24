using System.Net;
using Maya.Server.Services;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Controllers;

/// <summary>
/// Google OAuth 2.0 Integration + FCM Token Registration &amp; Test (Phase 8).
///
/// Google Calendar &amp; Gmail (butuh Google:ClientId &amp; Google:ClientSecret):
///   GET  /api/integrations/google/status         — { configured, connected }
///   GET  /api/integrations/google/authorize-url  — { authorizeUrl } (dibuka UI di browser; JWT-friendly)
///   GET  /api/integrations/google/callback       — Callback Google (anonim, state anti-CSRF single-use)
///   POST /api/integrations/google/disconnect     — Hapus refresh token tersimpan
///
/// FCM (butuh Firebase:ServiceAccountJson[Base64]):
///   GET  /api/integrations/fcm/status            — { configured, registeredDevices }
///   POST /api/integrations/fcm/test              — Kirim notifikasi uji ke semua HP terdaftar
///   POST /api/integrations/register-fcm          — Daftarkan FCM token dari Android app
/// </summary>
[ApiController]
[Route("api/integrations")]
[Produces("application/json")]
[Authorize]
public class IntegrationsController : ControllerBase
{
    private readonly IGoogleIntegrationService _googleService;
    private readonly IFcmNotificationService _fcmService;
    private readonly OAuthStateStore _stateStore;
    private readonly IConfiguration _config;
    private readonly ILogger<IntegrationsController> _logger;

    public IntegrationsController(
        IGoogleIntegrationService googleService,
        IFcmNotificationService fcmService,
        OAuthStateStore stateStore,
        IConfiguration config,
        ILogger<IntegrationsController> logger)
    {
        _googleService = googleService;
        _fcmService    = fcmService;
        _stateStore    = stateStore;
        _config        = config;
        _logger        = logger;
    }

    // ─── Google OAuth ─────────────────────────────────────────────────────────

    /// <summary>
    /// Status integrasi Google: configured (ClientId/Secret ada) dan connected (refresh token tersimpan).
    /// </summary>
    [HttpGet("google/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGoogleStatus()
    {
        if (!_googleService.IsConfigured)
        {
            return Ok(new
            {
                configured = false,
                connected  = false,
                message    = "Google integration belum dikonfigurasi di server (Google:ClientId / Google:ClientSecret)."
            });
        }

        var connected = false;
        try
        {
            connected = await _googleService.IsConnectedAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Google status: gagal membaca status koneksi dari DB. {Msg}", ex.Message);
        }

        return Ok(new
        {
            configured = true,
            connected,
            message = connected
                ? "Google Calendar & Gmail terhubung."
                : "Belum terhubung. Tekan 'Hubungkan Google' untuk memulai OAuth."
        });
    }

    /// <summary>
    /// Mengembalikan URL consent Google (JSON) agar UI web/APK dapat membukanya di browser.
    /// Redirect URI = Google:CallbackUrl jika diset, selain itu diturunkan dari host request (mendukung reverse proxy).
    /// </summary>
    [HttpGet("google/authorize-url")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult GetGoogleAuthorizeUrl()
    {
        if (!_googleService.IsConfigured)
        {
            return StatusCode(501, new
            {
                error   = "Google integration belum dikonfigurasi.",
                message = "Set Google:ClientId dan Google:ClientSecret di server."
            });
        }

        var callbackUrl = _config["Google:CallbackUrl"];
        if (string.IsNullOrWhiteSpace(callbackUrl))
            callbackUrl = $"{Request.Scheme}://{Request.Host}/api/integrations/google/callback";

        var state = _stateStore.Create(callbackUrl);
        var url   = _googleService.GetAuthorizationUrl(state, callbackUrl);

        return Ok(new { authorizeUrl = url, callbackUrl });
    }

    /// <summary>
    /// Callback Google OAuth2 — validasi state (anti-CSRF), exchange code, simpan refresh token terenkripsi.
    /// Dipanggil Google lewat redirect browser; merespons halaman HTML sederhana.
    /// </summary>
    [HttpGet("google/callback")]
    [AllowAnonymous] // Google redirect tidak bawa JWT; keamanan dijaga oleh state single-use
    [Produces("text/html")]
    public async Task<IActionResult> HandleGoogleCallback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error)
    {
        if (!string.IsNullOrEmpty(error))
            return HtmlPage(false, "Akses Google ditolak", $"Google mengembalikan: {error}. Tidak ada yang disimpan.");

        var callbackUrl = _stateStore.TryConsume(state);
        if (callbackUrl is null)
            return HtmlPage(false, "Sesi OAuth tidak valid", "State tidak dikenal atau sudah kedaluwarsa. Ulangi dari tombol 'Hubungkan Google' di aplikasi.");

        if (string.IsNullOrEmpty(code))
            return HtmlPage(false, "Kode otorisasi hilang", "Google tidak mengirim authorization code.");

        try
        {
            await _googleService.HandleCallbackAsync(code, state!, callbackUrl);
            return HtmlPage(true, "Google terhubung!", "Google Calendar & Gmail berhasil terhubung ke M.A.Y.A. Kamu bisa menutup tab ini dan kembali ke aplikasi.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Google OAuth callback gagal.");
            return HtmlPage(false, "Koneksi Google gagal", ex.Message);
        }
    }

    /// <summary>
    /// Putuskan koneksi Google (hapus refresh token tersimpan).
    /// </summary>
    [HttpPost("google/disconnect")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DisconnectGoogle()
    {
        await _googleService.DisconnectAsync();
        return NoContent();
    }

    // ─── FCM ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// Status FCM: apakah Firebase Admin terkonfigurasi di server dan berapa HP yang terdaftar.
    /// </summary>
    [HttpGet("fcm/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFcmStatus()
    {
        var registered = 0;
        try
        {
            registered = await _fcmService.CountRegisteredDevicesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("FCM status: gagal menghitung device terdaftar. {Msg}", ex.Message);
        }

        return Ok(new { configured = _fcmService.IsConfigured, registeredDevices = registered });
    }

    /// <summary>
    /// Kirim notifikasi uji ke semua HP terdaftar. Selalu 200; field `sent` menunjukkan apakah benar-benar terkirim via FCM.
    /// </summary>
    [HttpPost("fcm/test")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SendFcmTest()
    {
        var registered = await _fcmService.CountRegisteredDevicesAsync();

        if (registered == 0)
        {
            return Ok(new
            {
                sent = false,
                configured = _fcmService.IsConfigured,
                registeredDevices = 0,
                message = "Belum ada HP terdaftar. Buka APK, login, lalu izinkan notifikasi."
            });
        }

        if (!_fcmService.IsConfigured)
        {
            return Ok(new
            {
                sent = false,
                configured = false,
                registeredDevices = registered,
                message = "Firebase belum dikonfigurasi di server (Firebase:ServiceAccountJson[Base64])."
            });
        }

        var sent = await _fcmService.SendNotificationAsync(
            "M.A.Y.A. 🔔 Tes Notifikasi",
            "Push notification berhasil! Halo Max, ini tes dari server M.A.Y.A.");

        return Ok(new
        {
            sent,
            configured = true,
            registeredDevices = registered,
            message = sent ? "Notifikasi uji terkirim ke HP." : "Pengiriman gagal. Cek log server."
        });
    }

    /// <summary>
    /// Daftarkan FCM token dari Android M.A.Y.A. App ke server.
    /// Panggil endpoint ini setiap kali app mobile startup atau token di-refresh Firebase.
    /// Jika Firebase belum dikonfigurasi di server, token tetap tersimpan ke DB.
    /// </summary>
    [HttpPost("register-fcm")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RegisterFcmToken([FromBody] RegisterFcmTokenDto req)
    {
        if (string.IsNullOrWhiteSpace(req.DeviceId) || string.IsNullOrWhiteSpace(req.FcmToken))
            return BadRequest(new { error = "DeviceId dan FcmToken wajib diisi." });

        await _fcmService.RegisterFcmTokenAsync(req.DeviceId, req.FcmToken);

        _logger.LogInformation(
            "FCM token terdaftar untuk device '{DeviceId}'. Firebase configured: {Configured}",
            req.DeviceId, _fcmService.IsConfigured);

        return NoContent();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private ContentResult HtmlPage(bool success, string title, string message)
    {
        var color = success ? "#34d399" : "#f87171";
        var icon  = success ? "&#10003;" : "&#10007;";
        var html =
            "<!doctype html><html lang=\"id\"><head><meta charset=\"utf-8\">" +
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
            "<title>M.A.Y.A. — Google</title></head>" +
            "<body style=\"margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;" +
            "background:#09090b;color:#f4f4f5;font-family:system-ui,sans-serif;\">" +
            "<div style=\"max-width:420px;padding:32px;border:1px solid #27272a;border-radius:20px;background:#18181b;text-align:center;\">" +
            $"<div style=\"font-size:40px;color:{color};\">{icon}</div>" +
            $"<h2 style=\"margin:12px 0 8px;\">{WebUtility.HtmlEncode(title)}</h2>" +
            $"<p style=\"color:#a1a1aa;line-height:1.5;\">{WebUtility.HtmlEncode(message)}</p>" +
            "</div></body></html>";

        return new ContentResult
        {
            Content     = html,
            ContentType = "text/html; charset=utf-8",
            StatusCode  = success ? 200 : 400
        };
    }
}
